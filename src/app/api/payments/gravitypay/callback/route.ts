import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getGravityPaySettings,
  verifyGravityPaySignature,
} from "@/lib/gravitypay";
import { sendTelegramSecurityAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({
    status: "OK",
    webhook: "GravityPay Webhook Endpoint Active",
    platform: "OpenMarket",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const settings = await getGravityPaySettings();

  // 1. TIMING-SAFE CRYPTOGRAPHIC HMAC SIGNATURE VERIFICATION
  if (settings.webhookSecret) {
    const isValid = verifyGravityPaySignature(req, rawBody, settings.webhookSecret);
    if (!isValid) {
      console.warn("[GravityPay Webhook] HMAC Signature Verification Failed");
      await sendTelegramSecurityAlert({
        event: "GravityPay Webhook Signature Mismatch",
        severity: "CRITICAL",
        status: "BLOCKED",
        details: "An unauthenticated webhook with an invalid or spoofed HMAC signature was rejected.",
        req,
      }).catch(() => {});

      return NextResponse.json(
        { error: "Invalid cryptographic signature" },
        { status: 401 }
      );
    }
  }

  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const response = (
    typeof body.response === "object" && body.response !== null
      ? body.response
      : typeof body.data === "object" && body.data !== null
      ? body.data
      : body
  ) as Record<string, unknown>;

  const bodyBody = typeof body.Body === "object" && body.Body !== null ? (body.Body as Record<string, unknown>) : null;
  const respBody = typeof response.Body === "object" && response.Body !== null ? (response.Body as Record<string, unknown>) : null;

  const stkCb = (
    bodyBody?.stkCallback ||
    body.stkCallback ||
    respBody?.stkCallback ||
    response.stkCallback ||
    null
  ) as Record<string, unknown> | null;

  let resultCode: number | null = null;
  let checkoutRequestId = "";
  let mpesaReceipt = "";
  let rawAmount = 0;
  let externalRef = "";
  let rawStatus = "";
  let phone = "";

  if (stkCb) {
    resultCode = Number(stkCb.ResultCode);
    checkoutRequestId = String(stkCb.CheckoutRequestID || "").trim();
    const cbMeta = (typeof stkCb.CallbackMetadata === "object" && stkCb.CallbackMetadata !== null ? stkCb.CallbackMetadata : {}) as Record<string, unknown>;
    if (resultCode === 0 && Array.isArray(cbMeta.Item)) {
      for (const item of cbMeta.Item as Array<{ Name?: string; Value?: unknown }>) {
        if (item.Name === "Amount") rawAmount = Number(item.Value);
        if (item.Name === "MpesaReceiptNumber") mpesaReceipt = String(item.Value || "").trim();
        if (item.Name === "PhoneNumber") phone = String(item.Value || "").trim();
      }
    }
    rawStatus = resultCode === 0 ? "completed" : "failed";
  } else {
    resultCode = response.ResultCode !== undefined ? Number(response.ResultCode) : null;
    rawStatus = String(
      response.Status ||
      response.status ||
      response.PaymentStatus ||
      response.state ||
      ""
    ).toLowerCase().trim();

    checkoutRequestId = String(
      response.CheckoutRequestID ||
      response.checkoutRequestId ||
      response.checkout_request_id ||
      response.transactionId ||
      response.id ||
      ""
    ).trim();

    externalRef = String(
      response.ExternalReference ||
      response.external_reference ||
      response.accountReference ||
      response.account_reference ||
      response.reference ||
      response.orderId ||
      ""
    ).trim();

    mpesaReceipt = String(
      response.MpesaReceiptNumber ||
      response.mpesaReceiptNumber ||
      response.mpesa_receipt ||
      response.receipt ||
      response.transaction_code ||
      ""
    ).trim();

    rawAmount = Number(response.Amount || response.amount || response.paid_amount || 0);
    phone = String(response.PhoneNumber || response.phoneNumber || response.phone || "").trim();
  }

  const successValues = [
    "success",
    "successful",
    "completed",
    "complete",
    "paid",
    "confirmed",
    "ok",
  ];
  const failValues = [
    "failed",
    "failure",
    "cancelled",
    "canceled",
    "rejected",
    "timeout",
    "expired",
    "error",
  ];

  const isSuccess =
    resultCode === 0 ||
    (successValues.includes(rawStatus) && (resultCode === null || resultCode === 0));

  const isFailure =
    (resultCode !== null && resultCode !== 0) || failValues.includes(rawStatus);

  // 2. LOCATE PENDING TRANSACTION
  const lookupKeys = [externalRef, checkoutRequestId].filter(Boolean);
  let transaction = null;

  if (lookupKeys.length > 0) {
    transaction = await prisma.transaction.findFirst({
      where: {
        method: "mpesa",
        OR: [
          ...lookupKeys.map((k) => ({ externalRef: k })),
          ...lookupKeys.map((k) => ({ id: k })),
          ...lookupKeys.map((k) => ({ metadata: { contains: k } })),
        ],
      },
      include: { user: true },
    });
  }

  // 3. IDEMPOTENCY CHECK
  if (transaction && transaction.status === "completed") {
    console.log(`[GravityPay Webhook] Duplicate notification ignored for completed transaction ${transaction.id}`);
    return NextResponse.json({
      status: "OK",
      message: "Transaction already processed and credited",
      receipt: mpesaReceipt,
    });
  }

  // 4. PROCESS COMPLETED DEPOSIT
  if (isSuccess && transaction && transaction.status === "pending") {
    const existingMeta = transaction.metadata ? JSON.parse(transaction.metadata) : {};
    const updatedMeta = {
      ...existingMeta,
      mpesaReceipt,
      checkoutRequestId: checkoutRequestId || existingMeta.checkoutRequestId,
      resolvedVia: "gravitypay_webhook",
      creditedAt: new Date().toISOString(),
      rawResponse: response,
    };

    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "completed",
          metadata: JSON.stringify(updatedMeta),
        },
      }),
      prisma.user.update({
        where: { id: transaction.userId },
        data: {
          balance: { increment: transaction.amount },
        },
      }),
    ]);

    // Add confirmation message for user Messages / SMS notification
    try {
      const kesStr = rawAmount > 0 ? `Ksh ${rawAmount.toLocaleString()}` : `$${transaction.amount.toFixed(2)}`;
      await prisma.message.create({
        data: {
          userId: transaction.userId,
          title: "MPESA",
          body: `${mpesaReceipt || "ZM" + Date.now().toString().slice(-6)} Confirmed. Received ${kesStr} top-up into your trading wallet. Available balance updated.`,
          read: false,
        },
      });
    } catch (msgErr) {
      console.warn("Could not insert confirmation message in gravitypay callback:", msgErr);
    }

    // Dispatch real-time Telegram alert
    sendTelegramSecurityAlert({
      event: "GravityPay Deposit Verified",
      severity: "INFO",
      status: "SUCCESS",
      operator: transaction.user.email,
      details: `• Amount: $${transaction.amount.toFixed(2)} (KES ${rawAmount})\n• Receipt: \`${mpesaReceipt || "N/A"}\`\n• Reference: \`${transaction.externalRef || "N/A"}\`\n• Account: \`${transaction.user.email}\``,
      req,
    }).catch(() => {});

    return NextResponse.json({
      status: "OK",
      success: true,
      message: "Payment confirmed and wallet credited",
      receipt: mpesaReceipt,
    });
  }

  // 5. PROCESS FAILED OR CANCELLED DEPOSIT
  if (isFailure && transaction && transaction.status === "pending") {
    const existingMeta = transaction.metadata ? JSON.parse(transaction.metadata) : {};
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: "failed",
        metadata: JSON.stringify({
          ...existingMeta,
          rawStatus,
          resultCode,
          failedAt: new Date().toISOString(),
        }),
      },
    });

    return NextResponse.json({
      status: "OK",
      message: "Payment failure recorded",
    });
  }

  return NextResponse.json({
    status: "OK",
    received: true,
    note: transaction ? "Processed" : "No matching pending transaction found",
  });
}
