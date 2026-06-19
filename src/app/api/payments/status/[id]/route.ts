import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkStkStatus } from "@/lib/mpesa";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const transaction = await prisma.transaction.findUnique({ where: { id } });
  if (!transaction || transaction.userId !== session.user.id) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // Already resolved (e.g. webhook beat us to it, or a previous poll resolved it)
  if (transaction.status !== "pending") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { balance: true },
    });
    return NextResponse.json({
      status: transaction.status,
      amount: transaction.amount,
      balance: user?.balance,
    });
  }

  // Still pending in our DB — ask GravityPay directly for the latest status.
  // Only meaningful for M-Pesa transactions that have a checkoutRequestId saved.
  if (transaction.method === "mpesa" && transaction.metadata) {
    let meta: { checkoutRequestId?: string } = {};
    try {
      meta = JSON.parse(transaction.metadata);
    } catch {
      // malformed metadata, fall through to returning pending
    }

    if (meta.checkoutRequestId) {
      try {
        const result = await checkStkStatus(meta.checkoutRequestId);

        if (result.success && result.data) {
          const remoteStatus = result.data.status?.toLowerCase();

          if (remoteStatus === "success" || remoteStatus === "completed") {
            const existingMeta = transaction.metadata ? JSON.parse(transaction.metadata) : {};

            await prisma.$transaction([
              prisma.transaction.update({
                where: { id: transaction.id },
                data: {
                  status: "completed",
                  metadata: JSON.stringify({
                    ...existingMeta,
                    mpesaReceipt: result.data.mpesaReceipt,
                    resolvedVia: "poll",
                  }),
                },
              }),
              prisma.user.update({
                where: { id: transaction.userId },
                data: { balance: { increment: transaction.amount } },
              }),
            ]);

            const user = await prisma.user.findUnique({
              where: { id: session.user.id },
              select: { balance: true },
            });

            return NextResponse.json({
              status: "completed",
              amount: transaction.amount,
              balance: user?.balance,
            });
          }

          if (remoteStatus === "failed" || remoteStatus === "cancelled") {
            const existingMeta = transaction.metadata ? JSON.parse(transaction.metadata) : {};
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: {
                status: "failed",
                metadata: JSON.stringify({
                  ...existingMeta,
                  resultDesc: result.data.resultDesc,
                  resolvedVia: "poll",
                }),
              },
            });
            return NextResponse.json({ status: "failed", amount: transaction.amount });
          }
        }
        // result.success === false (e.g. "Transaction not found" because GravityPay
        // hasn't finished processing yet) — treat as still pending, don't error out.
      } catch (err) {
        console.error("checkStkStatus error:", err);
        // Network/API error talking to GravityPay — don't fail the poll request,
        // just report pending and let the client try again shortly.
      }
    }
  }

  return NextResponse.json({ status: "pending", amount: transaction.amount });
}