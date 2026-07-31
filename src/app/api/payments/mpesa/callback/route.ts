import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkStkStatus } from "@/lib/mpesa";

// PayHero's webhook does not require signature checks by default, but we support
// the verifySignature placeholder for future improvements.
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

  // Handle both nested inside 'response' and flat properties
  const data = body.response || body;
  const reference = data.ExternalReference || data.external_reference || data.MerchantRequestID || data.reference;

  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  // Find the pending transaction we created when initiating the STK push.
  const transaction = await prisma.transaction.findFirst({
    where: { externalRef: reference, status: "pending" },
  });

  if (!transaction) {
    console.warn(`PayHero webhook: no pending transaction found for reference ${reference}`);
    return NextResponse.json({ ok: true, note: "No matching pending transaction" });
  }

  const existingMeta = transaction.metadata ? JSON.parse(transaction.metadata) : {};

  const statusStr = (data.Status || data.status || "").toUpperCase().trim();
  const resultCode = data.ResultCode !== undefined ? Number(data.ResultCode) : null;
  const isSuccess = statusStr === "SUCCESS" || statusStr === "SUCCESSFUL" || (resultCode === 0 && statusStr !== "FAILED");
  const isPending = statusStr === "QUEUED" || statusStr === "PENDING";

  if (isPending) {
    console.log(`PayHero webhook: transaction ${reference} is queued/pending.`);
    return NextResponse.json({ ok: true, note: "Transaction is pending/queued" });
  }

  const checkoutRequestId = data.CheckoutRequestID || data.checkoutRequestID || data.checkout_request_id || existingMeta.checkoutRequestId || reference;
  const mpesaReceipt = data.MpesaReceiptNumber || data.Reference || data.reference || data.transaction_code || "";

  if (isSuccess) {
    // Corroborate with PayHero's status API to prevent webhook spoofing
    let corroborated = false;
    try {
      const statusResult = await checkStkStatus(checkoutRequestId);
      console.log(`[mpesa-callback] corroboration raw response for ${checkoutRequestId}=`, JSON.stringify(statusResult));
      const remoteStatus = statusResult.data?.response?.Status?.toLowerCase().trim();
      corroborated = statusResult.success === true && remoteStatus === "success";
    } catch (err) {
      console.error(`PayHero webhook: corroboration check failed for ${checkoutRequestId}`, err);
    }

    if (!corroborated) {
      console.warn(
        `PayHero webhook: REJECTED uncorroborated success claim for reference ${reference} ` +
        `(checkoutRequestId=${checkoutRequestId}) — callback claimed success but PayHero's ` +
        `status API did not independently confirm it. Leaving transaction pending.`
      );
      return NextResponse.json({ ok: true, note: "Not corroborated, left pending" });
    }

    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "completed",
          metadata: JSON.stringify({
            ...existingMeta,
            mpesaReceipt: mpesaReceipt || existingMeta.mpesaReceipt,
            checkoutRequestId: checkoutRequestId,
            resolvedVia: "webhook-corroborated",
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
      }),
    },
  });

  console.log(`Deposit failed: ${reference} (${failureReason})`);
  return NextResponse.json({ ok: true });
}