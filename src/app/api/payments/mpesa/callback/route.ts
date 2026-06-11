import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface MpesaCallbackBody {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: {
        Item?: Array<{ Name: string; Value?: string | number }>;
      };
    };
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as MpesaCallbackBody;
    const callback = body.Body?.stkCallback;

    if (!callback) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const { CheckoutRequestID, ResultCode, CallbackMetadata } = callback;

    if (ResultCode !== 0) {
      if (CheckoutRequestID) {
        const transactions = await prisma.transaction.findMany({
          where: { method: "mpesa", status: "pending" },
        });
        for (const tx of transactions) {
          const meta = tx.metadata ? JSON.parse(tx.metadata) : {};
          if (meta.checkoutRequestId === CheckoutRequestID) {
            await prisma.transaction.update({
              where: { id: tx.id },
              data: { status: "failed" },
            });
          }
        }
      }
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const amountItem = CallbackMetadata?.Item?.find((i) => i.Name === "Amount");
    const mpesaReceipt = CallbackMetadata?.Item?.find(
      (i) => i.Name === "MpesaReceiptNumber"
    )?.Value;

    const transactions = await prisma.transaction.findMany({
      where: { method: "mpesa", status: "pending" },
    });

    for (const tx of transactions) {
      const meta = tx.metadata ? JSON.parse(tx.metadata) : {};
      if (meta.checkoutRequestId === CheckoutRequestID) {
        await prisma.$transaction([
          prisma.transaction.update({
            where: { id: tx.id },
            data: {
              status: "completed",
              metadata: JSON.stringify({
                ...meta,
                mpesaReceipt,
                mpesaAmount: amountItem?.Value,
              }),
            },
          }),
          prisma.user.update({
            where: { id: tx.userId },
            data: { balance: { increment: tx.amount } },
          }),
        ]);
        break;
      }
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch {
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
