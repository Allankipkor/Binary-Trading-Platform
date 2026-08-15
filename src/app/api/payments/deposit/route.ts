import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { initiateStkPush, isMpesaConfigured, usdToKes } from "@/lib/mpesa";
import {
  generateDepositReference,
  getUsdtDepositAddress,
  isAutoConfirmEnabled,
  isCryptoConfigured,
} from "@/lib/crypto";
import { isPaypalConfigured } from "@/lib/paypal";
import { getGateway, getPublicGateways } from "@/lib/gateways";

const schema = z.object({
  method: z.enum(["mpesa", "crypto", "card"]),
  amount: z.number().min(0.01).max(1000000),
  phone: z.string().optional(),
});

export async function GET() {
  try {
    const setting = await prisma.marketSetting.findUnique({
      where: { id: "default" },
    });
    const globalMin = setting?.minDeposit ?? 5.0;
    const gateways = await getPublicGateways(globalMin);

    return NextResponse.json({
      minDeposit: globalMin,
      gateways,
    });
  } catch (error) {
    console.error("Failed to fetch deposit settings:", error);
    return NextResponse.json({ minDeposit: 5.0, gateways: [] });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const firstError = Object.values(flat.fieldErrors).flat()[0];
      return NextResponse.json(
        { error: firstError || "Invalid deposit request", details: flat },
        { status: 400 }
      );
    }

    const { method, amount, phone } = parsed.data;

    // Fetch gateway & global settings
    const setting = await prisma.marketSetting.findUnique({
      where: { id: "default" },
    });
    const globalMin = setting?.minDeposit ?? 5.0;

    const gateway = await getGateway(method);
    if (!gateway.enabled) {
      return NextResponse.json(
        { error: `${gateway.name} is currently unavailable for deposits.` },
        { status: 400 }
      );
    }

    const effectiveMin = gateway.minDeposit !== null && gateway.minDeposit > 0
      ? gateway.minDeposit
      : globalMin;

    if (amount < effectiveMin) {
      return NextResponse.json(
        { error: `Minimum deposit for ${gateway.name} is $${effectiveMin.toFixed(2)}` },
        { status: 400 }
      );
    }

    if (gateway.maxDeposit !== null && gateway.maxDeposit > 0 && amount > gateway.maxDeposit) {
      return NextResponse.json(
        { error: `Maximum deposit for ${gateway.name} is $${gateway.maxDeposit.toFixed(2)}` },
        { status: 400 }
      );
    }

    const reference = generateDepositReference();

    if (method === "mpesa") {
      const mpesaReady = await isMpesaConfigured();
      if (!mpesaReady) {
        return NextResponse.json(
          { error: "M-Pesa payment gateway is not properly configured." },
          { status: 503 }
        );
      }

      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      const mpesaPhone = phone ?? user?.phone;
      if (!mpesaPhone) {
        return NextResponse.json({ error: "Phone number required for M-Pesa" }, { status: 400 });
      }

      const amountKes = await usdToKes(amount);
      if (amountKes < 1) {
        return NextResponse.json(
          { error: "Amount is too small to convert to a valid M-Pesa charge" },
          { status: 400 }
        );
      }

      const transaction = await prisma.transaction.create({
        data: {
          userId: session.user.id,
          type: "deposit",
          method: "mpesa",
          amount,
          currency: "USD",
          status: "pending",
          externalRef: reference,
          metadata: JSON.stringify({ amountKes, phone: mpesaPhone }),
        },
      });

      try {
        const stk = await initiateStkPush({
          phone: mpesaPhone,
          amountKes,
          accountReference: reference,
          transactionDesc: "ShabikiMarket deposit",
        });

        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            metadata: JSON.stringify({
              amountKes,
              phone: mpesaPhone,
              checkoutRequestId: stk.checkoutRequestId,
              merchantRequestId: stk.merchantRequestId,
            }),
          },
        });

        return NextResponse.json({
          transactionId: transaction.id,
          method: "mpesa",
          message: stk.CustomerMessage,
          amountKes,
          checkoutRequestId: stk.checkoutRequestId,
        });
      } catch (err) {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: "failed" },
        });
        throw err;
      }
    }

    if (method === "crypto") {
      const cryptoReady = await isCryptoConfigured();
      const address = await getUsdtDepositAddress();
      if (!cryptoReady || !address) {
        return NextResponse.json(
          { error: "Crypto USDT deposit gateway is not configured." },
          { status: 503 }
        );
      }

      const autoConfirm = await isAutoConfirmEnabled();

      const transaction = await prisma.transaction.create({
        data: {
          userId: session.user.id,
          type: "deposit",
          method: "crypto",
          amount,
          currency: "USD",
          status: "pending",
          externalRef: reference,
          metadata: JSON.stringify({ network: "TRC20", token: "USDT" }),
        },
      });

      if (autoConfirm) {
        await prisma.$transaction([
          prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: "completed", metadata: JSON.stringify({ autoConfirmed: true }) },
          }),
          prisma.user.update({
            where: { id: session.user.id },
            data: { balance: { increment: amount } },
          }),
        ]);

        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { balance: true },
        });

        return NextResponse.json({
          transactionId: transaction.id,
          method: "crypto",
          address,
          amount,
          network: "TRC20",
          reference,
          status: "completed",
          balance: user?.balance,
          message: "Deposit auto-confirmed (dev mode)",
        });
      }

      return NextResponse.json({
        transactionId: transaction.id,
        method: "crypto",
        address,
        amount,
        network: "TRC20",
        reference,
        status: "pending",
        message: "Send USDT to the address, then confirm with your transaction hash",
      });
    }

    // Card / PayPal
    const cardReady = await isPaypalConfigured();
    if (!cardReady) {
      return NextResponse.json(
        { error: "Card / PayPal gateway is not configured." },
        { status: 503 }
      );
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId: session.user.id,
        type: "deposit",
        method: "card",
        amount,
        currency: "USD",
        status: "pending",
        externalRef: reference,
      },
    });

    return NextResponse.json({
      transactionId: transaction.id,
      method: "card",
      status: "pending",
      message: "Card deposit initiated.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Deposit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}