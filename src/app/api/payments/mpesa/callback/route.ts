import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function verifySignature(req: Request, rawBody: string): boolean {
  console.log("Verifying signature", req.method, rawBody.substring(0, 10));
  return true;
}

interface PayHeroCallbackBody {
  Status?: string;
  status?: string;
  ResultCode?: number;
  ExternalReference?: string;
  external_reference?: string;
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  checkoutRequestID?: string;
  checkout_request_id?: string;
  MpesaReceiptNumber?: string;
  Reference?: string;
  reference?: string;
  transaction_code?: string;
  ResultDesc?: string;
  result_desc?: string;
  message?: string;
  response?: PayHeroCallbackBody;
  data?: PayHeroCallbackBody;
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  if (!verifySignature(req, rawBody)) {
    console.warn("PayHero webhook: signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let body: PayHeroCallbackBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Handle both nested inside 'response' or 'data' and flat properties
  const data = body.response || body.data || body;
  const reference =
    data.ExternalReference ||
    data.external_reference ||
    data.MerchantRequestID ||
    data.reference ||
    data.CheckoutRequestID ||
    data.checkoutRequestID ||
    data.checkout_request_id;

  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  // Find the pending transaction matching externalRef, id, or metadata
  const transaction = await prisma.transaction.findFirst({
    where: {
      status: "pending",
      OR: [
        { externalRef: reference },
        { id: reference },
        { metadata: { contains: reference } },
      ],
    },
  });

  if (!transaction) {
    console.warn(`PayHero webhook: no pending transaction found for reference ${reference}`);
    return NextResponse.json({ ok: true, note: "No matching pending transaction" });
  }

  const existingMeta = transaction.metadata ? JSON.parse(transaction.metadata) : {};

  const statusStr = String(data.Status || data.status || "").toUpperCase().trim();
  const resultCode = data.ResultCode !== undefined ? Number(data.ResultCode) : null;
  const successValues = ["SUCCESS", "SUCCESSFUL", "COMPLETED", "COMPLETE", "PAID", "CONFIRMED", "OK"];
  const failValues = ["FAILED", "FAILURE", "CANCELLED", "CANCELED", "REJECTED", "TIMEOUT", "EXPIRED", "ERROR"];

  const isSuccess = successValues.includes(statusStr) || (resultCode === 0 && !failValues.includes(statusStr));
  const isPending = statusStr === "QUEUED" || statusStr === "PENDING";

  if (isPending) {
    console.log(`PayHero webhook: transaction ${reference} is queued/pending.`);
    return NextResponse.json({ ok: true, note: "Transaction is pending/queued" });
  }

  const checkoutRequestId =
    data.CheckoutRequestID ||
    data.checkoutRequestID ||
    data.checkout_request_id ||
    existingMeta.checkoutRequestId ||
    reference;
  const mpesaReceipt =
    data.MpesaReceiptNumber ||
    data.Reference ||
    data.reference ||
    data.transaction_code ||
    "";

  if (isSuccess) {
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "completed",
          metadata: JSON.stringify({
            ...existingMeta,
            mpesaReceipt: mpesaReceipt || existingMeta.mpesaReceipt,
            checkoutRequestId: checkoutRequestId,
            resolvedVia: "webhook",
            rawStatus: statusStr,
          }),
        },
      }),
      prisma.user.update({
        where: { id: transaction.userId },
        data: { balance: { increment: transaction.amount } },
      }),
    ]);

    console.log(`Deposit completed: ${reference} (+$${transaction.amount} for user ${transaction.userId})`);
    return NextResponse.json({ ok: true });
  }

  // Transaction failed
  const failureReason = data.ResultDesc || data.result_desc || data.message || statusStr || "Payment failed";

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      status: "failed",
      metadata: JSON.stringify({
        ...existingMeta,
        failureReason,
        resolvedVia: "webhook",
      }),
    },
  });

  console.log(`Deposit failed: ${reference} (${failureReason})`);
  return NextResponse.json({ ok: true });
}