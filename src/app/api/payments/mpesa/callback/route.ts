import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkStkStatus } from "@/lib/mpesa";

interface LipiaCallbackBody {
  status: boolean;
  message?: string;
  response: {
    Amount: number;
    ExternalReference: string;
    MerchantRequestID: string;
    CheckoutRequestID: string;
    MpesaReceiptNumber: string;
    Phone: string;
    ResultCode: number;
    ResultDesc: string;
    Metadata?: Record<string, unknown>;
    Status: "Success" | "Failed" | string;
  };
}

// Lipia Online's docs confirm there is no webhook signature header or
// shared secret to verify against — their guidance for testing callbacks
// is just "expose your local server with ngrok," nothing about
// authenticating the request. This route is therefore unauthenticated by
// the provider's own design, not as a gap on our side.
//
// Because of that, this route does NOT trust the callback body's own claim
// of success. Anyone who discovers this URL and a live ExternalReference
// (e.g. by starting a real deposit, then forging a "Success" POST here
// instead of actually paying) could otherwise get credited without ever
// sending money. To close that, a "Success" callback is only acted on after
// independently asking Lipia's own status API (checkStkStatus) to confirm
// the same checkoutRequestId — an attacker can forge a POST to us, but they
// can't forge what Lipia's own servers report back when we ask them directly.
function verifySignature(_req: Request, _rawBody: string): boolean {
  return true;
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  if (!verifySignature(req, rawBody)) {
    console.warn("Lipia webhook: signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let body: LipiaCallbackBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { response } = body;
  const reference = response?.ExternalReference;

  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  // Find the pending transaction we created when initiating the STK push.
  // We stored our reference as `externalRef` on the Transaction row, and
  // sent it to Lipia as `external_reference` in the STK push request.
  const transaction = await prisma.transaction.findFirst({
    where: { externalRef: reference, status: "pending" },
  });

  if (!transaction) {
    // Either already processed (duplicate webhook delivery — Lipia may
    // retry) or we never created this transaction. Respond 200 either way
    // so they don't keep retrying a transaction we can't do anything with.
    console.warn(`Lipia webhook: no pending transaction found for reference ${reference}`);
    return NextResponse.json({ ok: true, note: "No matching pending transaction" });
  }

  const existingMeta = transaction.metadata ? JSON.parse(transaction.metadata) : {};

  if (response.Status === "Success" && response.ResultCode === 0) {
    // Don't credit on the callback body's say-so alone — corroborate with
    // Lipia's own status API first. A forged callback can claim anything;
    // it can't make Lipia's servers also report success for the same
    // checkoutRequestId.
    const checkoutRequestId = response.CheckoutRequestID;
    let corroborated = false;
    try {
      const statusResult = await checkStkStatus(checkoutRequestId);
      const remoteStatus = statusResult.data?.response?.Status?.toLowerCase().trim();
      corroborated =
        statusResult.success === true &&
        (remoteStatus === "success" || statusResult.data?.response?.ResultCode === 0);
    } catch (err) {
      console.error(`Lipia webhook: corroboration check failed for ${checkoutRequestId}`, err);
    }

    if (!corroborated) {
      console.warn(
        `Lipia webhook: REJECTED uncorroborated success claim for reference ${reference} ` +
        `(checkoutRequestId=${checkoutRequestId}) — callback claimed success but Lipia's ` +
        `status API did not independently confirm it. Leaving transaction pending.`
      );
      // Don't mark as failed — a real payment may still be in flight and the
      // status-poll fallback (or a later, legitimate callback retry) can
      // still resolve it. Just decline to act on this particular callback.
      return NextResponse.json({ ok: true, note: "Not corroborated, left pending" });
    }

    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "completed",
          metadata: JSON.stringify({
            ...existingMeta,
            mpesaReceipt: response.MpesaReceiptNumber,
            checkoutRequestId: response.CheckoutRequestID,
            merchantRequestId: response.MerchantRequestID,
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

  // Anything else (Status === "Failed", or a non-zero ResultCode) is treated
  // as a failed payment — Lipia's docs only document Success/Failed, no
  // separate "cancelled" state, so ResultDesc is kept for diagnosis.
  await prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      status: "failed",
      metadata: JSON.stringify({
        ...existingMeta,
        failureReason: response.ResultDesc ?? response.Status,
      }),
    },
  });

  console.log(`Deposit failed: ${reference} (${response.ResultDesc ?? response.Status})`);
  return NextResponse.json({ ok: true });
}