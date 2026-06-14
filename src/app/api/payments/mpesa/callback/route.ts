import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body?.type !== "PAYMENT_SUCCESS") {
      return NextResponse.json({ received: true });
    }

    const data = body.data;

    if (!data?.checkoutRequestId) {
      return NextResponse.json({ received: true });
    }

    const tx = await prisma.transaction.findFirst({
      where: {
        method: "mpesa",
        status: "pending",
        metadata: {
          contains: data.checkoutRequestId,
        },
      },
    });

    if (!tx) return NextResponse.json({ received: true });

    if (tx.status === "completed") {
      return NextResponse.json({ received: true });
    }

    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: "completed",
          metadata: JSON.stringify({
            ...(tx.metadata ? JSON.parse(tx.metadata) : {}),
            mpesaReceipt: data.mpesaReceipt,
            mpesaAmount: data.amount,
            phoneNumber: data.phoneNumber,
            paidAt: data.paidAt,
          }),
        },
      }),

      prisma.user.update({
        where: { id: tx.userId },
        data: {
          balance: { increment: tx.amount },
        },
      }),
    ]);

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ received: true });
  }
}