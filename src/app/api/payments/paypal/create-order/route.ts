import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createPaypalOrder, isPaypalConfigured } from "@/lib/paypal";
import { generateDepositReference } from "@/lib/crypto";
import { getGateway } from "@/lib/gateways";

const schema = z.object({
  amount: z.number().min(0.01).max(1000000),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paypalReady = await isPaypalConfigured();
  if (!paypalReady) {
    return NextResponse.json(
      { error: "PayPal gateway is not configured or is currently disabled." },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const firstError = Object.values(flat.fieldErrors).flat()[0];
      return NextResponse.json({ error: firstError || "Invalid deposit request" }, { status: 400 });
    }

    const { amount } = parsed.data;

    // Check minimum deposit requirement
    const setting = await prisma.marketSetting.findUnique({
      where: { id: "default" },
    });
    const globalMin = setting?.minDeposit ?? 5.0;

    const gateway = await getGateway("card");
    if (!gateway.enabled) {
      return NextResponse.json({ error: "Card / PayPal deposits are temporarily disabled." }, { status: 400 });
    }

    const effectiveMin = gateway.minDeposit !== null && gateway.minDeposit > 0 ? gateway.minDeposit : globalMin;
    if (amount < effectiveMin) {
      return NextResponse.json({ error: `Minimum deposit is $${effectiveMin.toFixed(2)}` }, { status: 400 });
    }

    if (gateway.maxDeposit !== null && gateway.maxDeposit > 0 && amount > gateway.maxDeposit) {
      return NextResponse.json({ error: `Maximum deposit is $${gateway.maxDeposit.toFixed(2)}` }, { status: 400 });
    }

    const reference = generateDepositReference();

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

    try {
      const order = await createPaypalOrder({ amount, referenceId: reference });

      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { metadata: JSON.stringify({ paypalOrderId: order.id }) },
      });

      return NextResponse.json({
        transactionId: transaction.id,
        orderId: order.id,
      });
    } catch (err) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: "failed" },
      });
      throw err;
    }
  } catch (err) {
    console.error("POST /api/payments/paypal/create-order error:", err);
    const message = err instanceof Error ? err.message : "Failed to start PayPal checkout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}