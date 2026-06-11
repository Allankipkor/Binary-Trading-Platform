import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  method: z.enum(["mpesa", "crypto"]),
  amount: z.number().min(5).max(10000),
  phone: z.string().optional(),
  walletAddress: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
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

    const [transaction] = await prisma.$transaction([
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
          }),
        },
      }),
    ]);

    return NextResponse.json({
      transactionId: transaction.id,
      status: "pending",
      message: "Withdrawal request submitted. Processing within 24 hours.",
    });
  } catch {
    return NextResponse.json({ error: "Withdrawal failed" }, { status: 500 });
  }
}
