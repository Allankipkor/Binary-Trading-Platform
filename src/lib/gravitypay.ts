import crypto from "crypto";
import axios from "axios";
import { getGateway, type MpesaConfig } from "./gateways";

export interface GravityPaySettings {
  apiKey: string;
  secretKey: string;
  webhookSecret: string;
  callbackUrl: string;
  usdToKes: number;
}

/**
 * Format Kenyan phone number to 2547XXXXXXXX
 */
export function formatGravityPayPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.startsWith("7") || digits.startsWith("1")) return `254${digits}`;
  return digits;
}

/**
 * Generate strictly <= 12 characters reference starting with ZM for GravityPay & Daraja compatibility
 */
export function generateGravityPayRef(): string {
  const timeSuffix = Date.now().toString().slice(-8);
  const randSuffix = Math.floor(Math.random() * 90 + 10).toString();
  return `ZM${timeSuffix}${randSuffix}`.slice(0, 12);
}

/**
 * Fetch effective GravityPay settings from Gateway DB record or process.env
 */
export async function getGravityPaySettings(): Promise<GravityPaySettings> {
  let apiKey = (process.env.GRAVITYPAY_API_KEY || "").trim();
  let secretKey = (process.env.GRAVITYPAY_SECRET_KEY || "").trim();
  let webhookSecret = (process.env.GRAVITYPAY_WEBHOOK_SECRET || process.env.GRAVITYPAY_SIGNING_SECRET || "").trim();
  let callbackUrl = (process.env.GRAVITYPAY_CALLBACK_URL || "").trim();
  let usdToKes = parseFloat(process.env.USD_TO_KES || "130");

  try {
    const gw = await getGateway("mpesa");
    const cfg = gw.parsedConfig as MpesaConfig;

    if (cfg.gravitypayApiKey) apiKey = cfg.gravitypayApiKey.trim();
    if (cfg.gravitypaySecretKey) secretKey = cfg.gravitypaySecretKey.trim();
    if (cfg.gravitypayWebhookSecret) webhookSecret = cfg.gravitypayWebhookSecret.trim();
    if (cfg.gravitypayCallbackUrl) callbackUrl = cfg.gravitypayCallbackUrl.trim();
    if (cfg.usdToKes && cfg.usdToKes > 0) usdToKes = cfg.usdToKes;
  } catch (err) {
    console.warn("Could not read gateway settings from DB in getGravityPaySettings:", err);
  }

  if (!callbackUrl) {
    const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://shabikimarket.com";
    callbackUrl = `${appUrl.replace(/\/$/, "")}/api/payments/gravitypay/callback`;
  }

  return {
    apiKey,
    secretKey,
    webhookSecret,
    callbackUrl,
    usdToKes,
  };
}

export async function isGravityPayConfigured(): Promise<boolean> {
  const { apiKey, secretKey } = await getGravityPaySettings();
  return Boolean(apiKey && secretKey);
}

/**
 * Initiate STK push request via GravityPay API (api.gravitypayapp.com)
 */
export async function initiateGravityPayStkPush(params: {
  phone: string;
  amountKes: number;
  reference?: string;
  userId?: string;
  username?: string;
}): Promise<{
  success: boolean;
  reference: string;
  checkoutRequestId: string;
  message: string;
  raw: any;
}> {
  const settings = await getGravityPaySettings();

  if (!settings.apiKey || !settings.secretKey) {
    throw new Error(
      "GravityPay API Key and Secret Key are not configured. Please configure them in Admin Settings."
    );
  }

  const formattedPhone = formatGravityPayPhone(params.phone);
  const finalRef = (params.reference || generateGravityPayRef()).slice(0, 12);
  const roundAmount = Math.round(params.amountKes);

  const payload = {
    phoneNumber: formattedPhone,
    phone: formattedPhone,
    amount: roundAmount,
    reference: finalRef,
    accountReference: finalRef,
    AccountReference: finalRef,
    account_reference: finalRef,
    externalReference: finalRef,
    external_reference: finalRef,
    transactionReference: finalRef,
    transaction_reference: finalRef,
    orderId: finalRef,
    order_id: finalRef,
    description: "Account Topup",
    transactionDesc: "Account Topup",
    TransactionDesc: "Account Topup",
    callbackUrl: settings.callbackUrl,
    callBackUrl: settings.callbackUrl,
    callback_url: settings.callbackUrl,
    metadata: {
      userId: params.userId || "",
      username: params.username || "Trader",
      phone: formattedPhone,
      app: "openmarket",
      deposit_ref: finalRef,
      reference: finalRef,
      account_reference: finalRef,
    },
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (settings.secretKey) headers["Authorization"] = `Bearer ${settings.secretKey}`;
  if (settings.apiKey) headers["x-api-key"] = settings.apiKey;
  if (!settings.secretKey && settings.apiKey) headers["Authorization"] = `Bearer ${settings.apiKey}`;
  if (!settings.apiKey && settings.secretKey) headers["x-api-key"] = settings.secretKey;

  let response;
  try {
    response = await axios.post("https://api.gravitypayapp.com/api/v1/stk/push", payload, {
      headers,
      timeout: 15000,
    });
  } catch (netErr: any) {
    if (axios.isAxiosError(netErr) && netErr.response?.data) {
      const resData = netErr.response.data as any;
      const errMsg =
        resData.data?.message ||
        resData.message ||
        resData.error ||
        resData.data?.error ||
        "GravityPay STK push declined by payment gateway.";
      throw new Error(errMsg);
    }
    throw new Error(netErr.message || "Payment gateway connection timed out.");
  }

  const resData = response.data || {};
  const isOk = response.status >= 200 && response.status < 300;
  const isSuccess =
    isOk &&
    (resData.success === true ||
      resData.status === "pending" ||
      resData.data?.status === "pending");

  if (!isSuccess) {
    const errMsg =
      resData.data?.message ||
      resData.message ||
      resData.error ||
      resData.data?.error ||
      "Payment gateway declined request.";
    throw new Error(errMsg);
  }

  const checkoutRequestId = (
    resData.data?.checkoutRequestId ||
    resData.checkoutRequestId ||
    resData.data?.CheckoutRequestID ||
    resData.CheckoutRequestID ||
    resData.data?.transactionId ||
    resData.transactionId ||
    resData.data?.id ||
    resData.id ||
    finalRef
  )
    .toString()
    .trim();

  return {
    success: true,
    reference: finalRef,
    checkoutRequestId,
    message: `STK prompt sent to ${formattedPhone}! Please enter your M-Pesa PIN on your phone.`,
    raw: resData,
  };
}

/**
 * Timing-safe HMAC verification for incoming GravityPay webhook callbacks
 */
export function verifyGravityPaySignature(
  req: Request,
  rawBody: string,
  secret: string
): boolean {
  if (!secret) {
    return true; // No secret configured in settings, permit processing
  }

  const sigHeader =
    req.headers.get("x-webhook-signature") ||
    req.headers.get("x-signature") ||
    req.headers.get("x-hub-signature-256") ||
    req.headers.get("x-gravitypay-signature") ||
    req.headers.get("x-api-key") ||
    req.headers.get("authorization") ||
    "";

  if (!sigHeader) {
    return false;
  }

  const cleanSig = sigHeader
    .replace(/^sha256=/i, "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  try {
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    if (cleanSig.length !== expectedSig.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(cleanSig, "utf-8"),
      Buffer.from(expectedSig, "utf-8")
    );
  } catch (err) {
    return false;
  }
}
