import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkStkStatus } from "@/lib/mpesa";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    return NextResponse.json(
      {
        status: transaction.status,
        amount: transaction.amount,
        balance: user?.balance,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  }

  // Still pending in DB — query PayHero directly for latest status
  if (transaction.method === "mpesa") {
    let meta: { checkoutRequestId?: string } = {};
    if (transaction.metadata) {
      try {
        meta = JSON.parse(transaction.metadata);
      } catch {
        // malformed metadata
      }
    }

    const queryReference = meta.checkoutRequestId || transaction.externalRef || transaction.id;

    if (queryReference) {
      try {
        const result = await checkStkStatus(queryReference);
        console.log(`[deposit-status-poll] queryRef=${queryReference} raw=`, JSON.stringify(result));

        const response = result.data?.response;

        if (result.success && response) {
          const remoteStatus = response.Status?.toLowerCase().trim();
          const successValues = ["success", "successful", "completed", "complete", "paid", "confirmed", "ok"];
          const failureValues = ["failed", "failure", "cancelled", "canceled", "rejected", "timeout", "expired", "error"];

          const succeeded = Boolean(remoteStatus && successValues.includes(remoteStatus));

          if (succeeded) {
            const existingMeta = transaction.metadata ? JSON.parse(transaction.metadata) : {};

            await prisma.$transaction([
              prisma.transaction.update({
                where: { id: transaction.id },
                data: {
                  status: "completed",
                  metadata: JSON.stringify({
                    ...existingMeta,
                    mpesaReceipt: response.MpesaReceiptNumber,
                    resolvedVia: "poll",
                    rawStatus: remoteStatus,
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

            return NextResponse.json(
              {
                status: "completed",
                amount: transaction.amount,
                balance: user?.balance,
              },
              {
                headers: {
                  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                },
              }
            );
          }

          if (remoteStatus && failureValues.includes(remoteStatus)) {
            const existingMeta = transaction.metadata ? JSON.parse(transaction.metadata) : {};
            await prisma.transaction.update({
              where: { id: transaction.id },
              data: {
                status: "failed",
                metadata: JSON.stringify({
                  ...existingMeta,
                  resultDesc: response.ResultDesc,
                  resolvedVia: "poll",
                  rawStatus: remoteStatus,
                }),
              },
            });
            return NextResponse.json(
              { status: "failed", amount: transaction.amount },
              {
                headers: {
                  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                },
              }
            );
          }
        }
      } catch (err) {
        console.error("checkStkStatus error:", err);
      }
    }
  }

  return NextResponse.json(
    { status: "pending", amount: transaction.amount },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    }
  );
}