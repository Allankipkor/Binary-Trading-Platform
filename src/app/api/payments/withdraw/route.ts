import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  method: z.enum(["mpesa", "crypto"]),
  amount: z.number().min(50).max(150000),
  phone: z.string().optional(),
  walletAddress: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { balance: true, phone: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    balance: user.balance,
    phone: user.phone,
    kycStatus: "not_submitted" as const,
  });
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
      return NextResponse.json({ error: firstError || "Invalid withdrawal request" }, { status: 400 });
    }

    const { method, amount, phone, walletAddress } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.balance < amount) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }

    if (method === "mpesa" && !phone && !user.phone) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }
    if (method === "crypto" && !walletAddress) {
      return NextResponse.json({ error: "Wallet address required" }, { status: 400 });
    }

    const [, transaction] = await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: { balance: { decrement: amount } },
      }),
      prisma.transaction.create({
        data: {
          userId: session.user.id,
          type: "withdrawal",
          method,
          amount,
          status: "pending",
          metadata: JSON.stringify({
            phone: phone ?? user.phone,
            walletAddress,
            kycStatus: "not_submitted",
          }),
        },
      }),
    ]);

    const updatedUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { balance: true },
    });

    return NextResponse.json({
      transactionId: transaction.id,
      status: "pending",
      balance: updatedUser?.balance,
      requiresKyc: true,
      message: "Withdrawal request submitted. It will be processed after KYC verification.",
    });
  } catch (err) {
    console.error("POST /api/payments/withdraw error:", err);
    const message = err instanceof Error ? err.message : "Withdrawal failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
