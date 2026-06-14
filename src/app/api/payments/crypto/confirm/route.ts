import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  transactionId: z.string(),
  txHash: z.string().min(10),
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

    const { transactionId, txHash } = parsed.data;

    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId: session.user.id,
        method: "crypto",
        type: "deposit",
        status: "pending",
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const meta = transaction.metadata ? JSON.parse(transaction.metadata) : {};

    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "completed",
          metadata: JSON.stringify({ ...meta, txHash, confirmedAt: new Date().toISOString() }),
        },
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: { balance: { increment: transaction.amount } },
      }),
    ]);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { balance: true },
    });

    return NextResponse.json({
      status: "completed",
      balance: user?.balance,
      message: "Crypto deposit confirmed",
    });
  } catch {
    return NextResponse.json({ error: "Confirmation failed" }, { status: 500 });
  }
}
