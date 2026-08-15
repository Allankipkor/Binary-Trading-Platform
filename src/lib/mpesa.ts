import axios from "axios";
import { getGateway, type MpesaConfig } from "./gateways";

/**
 * Format Kenyan phone number to 2547XXXXXXXX
 */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.startsWith("7") || digits.startsWith("1")) return `254${digits}`;
  return digits;
}

function cleanVal(val: string | undefined | null): string {
  if (!val) return "";
  let clean = val.trim();
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.slice(1, -1);
  }
  return clean.trim();
}

const PAYHERO_BASE_URL = process.env.PAYHERO_BASE_URL ?? "https://backend.payhero.co.ke/api/v2";

/**
 * Get effective Mpesa configuration (DB settings overriding .env defaults)
 */
export async function getMpesaSettings(): Promise<{
  enabled: boolean;
  username: string;
  password: string;
  channelId: string;
  usdToKes: number;
  callbackUrl: string;
}> {
  try {
    const gw = await getGateway("mpesa");
    const cfg = gw.parsedConfig as MpesaConfig;

    return {
      enabled: gw.enabled,
      username: cleanVal(cfg.username) || cleanVal(process.env.PAYHERO_USERNAME),
      password: cleanVal(cfg.password) || cleanVal(process.env.PAYHERO_PASSWORD),
      channelId: cleanVal(cfg.channelId) || cleanVal(process.env.PAYHERO_CHANNEL_ID),
      usdToKes: cfg.usdToKes && cfg.usdToKes > 0 ? cfg.usdToKes : parseFloat(process.env.USD_TO_KES ?? "130"),
      callbackUrl: cleanVal(cfg.callbackUrl) || cleanVal(process.env.MPESA_CALLBACK_URL),
    };
  } catch {
    return {
      enabled: true,
      username: cleanVal(process.env.PAYHERO_USERNAME),
      password: cleanVal(process.env.PAYHERO_PASSWORD),
      channelId: cleanVal(process.env.PAYHERO_CHANNEL_ID),
      usdToKes: parseFloat(process.env.USD_TO_KES ?? "130"),
      callbackUrl: cleanVal(process.env.MPESA_CALLBACK_URL),
    };
  }
}

/**
 * INITIATE PAYHERO STK PUSH
 *
 * Per PayHero's docs: POST {PAYHERO_BASE_URL}/payments
 * Auth: Basic auth using PAYHERO_USERNAME and PAYHERO_PASSWORD
 */
export async function initiateStkPush(params: {
  phone: string;
  amountKes: number;
  accountReference: string;
  transactionDesc: string;
}) {
  const settings = await getMpesaSettings();

  if (!settings.username || !settings.password || !settings.channelId) {
    throw new Error("PayHero credentials not configured. Please configure in Admin Settings.");
  }

  const callbackUrl = settings.callbackUrl || process.env.MPESA_CALLBACK_URL;
  if (!callbackUrl) {
    throw new Error("MPESA_CALLBACK_URL not configured");
  }

  const externalReference = params.accountReference?.slice(0, 32) ?? "OPENMARKET";
  const authHeader = `Basic ${Buffer.from(`${settings.username}:${settings.password}`).toString("base64")}`;

  let response;
  try {
    response = await axios.post(
      `${PAYHERO_BASE_URL}/payments`,
      {
        amount: Math.ceil(params.amountKes),
        phone_number: formatPhone(params.phone),
        channel_id: parseInt(settings.channelId),
        provider: "m-pesa",
        external_reference: externalReference,
        callback_url: callbackUrl,
      },
      {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data) {
      const data = err.response.data as {
        error_message?: string;
        message?: string;
        error?: string;
      };
      const errMsg = data.error_message || data.message || data.error || "STK push failed";
      throw new Error(errMsg);
    }
    throw err;
  }

  const data = response.data;
  if (!data.success) {
    throw new Error(data.message || data.error || "STK push failed");
  }

  const checkoutRequestId = data.CheckoutRequestID || data.checkoutRequestID || data.checkout_request_id || externalReference;

  return {
    transactionId: checkoutRequestId,
    checkoutRequestId: checkoutRequestId,
    merchantRequestId: checkoutRequestId,
    status: "pending",
    CustomerMessage: data.CustomerMessage || data.message || "Request accepted for processing",
  };
}

export interface PayHeroStatusResponse {
  success: boolean;
  message?: string;
  data: {
    response: {
      Status: string;
      Amount: number;
      ExternalReference: string;
      MpesaReceiptNumber: string;
      ResultDesc: string;
      CheckoutRequestID: string;
    };
  };
}

/**
 * CHECK STK PUSH STATUS
 *
 * Per PayHero's docs: GET {PAYHERO_BASE_URL}/transaction-status
 */
export async function checkStkStatus(checkoutRequestId: string): Promise<PayHeroStatusResponse> {
  const settings = await getMpesaSettings();

  if (!settings.username || !settings.password) {
    throw new Error("PayHero credentials not configured");
  }

  const authHeader = `Basic ${Buffer.from(`${settings.username}:${settings.password}`).toString("base64")}`;

  const response = await axios.get(
    `${PAYHERO_BASE_URL}/transaction-status`,
    {
      params: { reference: checkoutRequestId },
      headers: {
        Authorization: authHeader,
      },
      validateStatus: () => true,
    }
  );

  const rawData = response.data || {};

  // PayHero uses SUCCESS, SUCCESSFUL, COMPLETED, PAID, FAILED, QUEUED status strings
  const statusStr = String(rawData.status || rawData.Status || "").toUpperCase().trim();
  const innerData = rawData.data || rawData.response || rawData || {};
  const innerStatusStr = String(innerData.status || innerData.Status || "").toUpperCase().trim();

  const successValues = ["SUCCESS", "SUCCESSFUL", "COMPLETED", "COMPLETE", "PAID", "CONFIRMED", "OK"];
  const failValues = ["FAILED", "FAILURE", "CANCELLED", "CANCELED", "REJECTED", "TIMEOUT", "EXPIRED", "ERROR"];

  const hasSuccessStatus = successValues.includes(statusStr) || successValues.includes(innerStatusStr);
  const hasZeroResultCode = (rawData.ResultCode === 0 || innerData.ResultCode === 0) && !failValues.includes(statusStr) && !failValues.includes(innerStatusStr);
  const isSuccess = hasSuccessStatus || hasZeroResultCode;

  const isFailed = failValues.includes(statusStr) || failValues.includes(innerStatusStr);
  const isPending = !isSuccess && !isFailed;

  let normalizedStatus = "Pending";
  if (isSuccess) normalizedStatus = "Success";
  else if (isFailed) normalizedStatus = "Failed";

  const amount = Number(innerData.Amount || innerData.amount || rawData.Amount || rawData.amount || 0);
  const externalRef = innerData.ExternalReference || innerData.external_reference || innerData.reference || rawData.ExternalReference || checkoutRequestId;
  const receipt = innerData.MpesaReceiptNumber || innerData.reference || innerData.transaction_code || rawData.MpesaReceiptNumber || "";
  const resultDesc = rawData.message || rawData.ResultDesc || rawData.result_desc || innerData.ResultDesc || innerData.message || "";

  return {
    success: isSuccess || isFailed || isPending,
    message: rawData.message || resultDesc,
    data: {
      response: {
        Status: normalizedStatus,
        Amount: amount,
        ExternalReference: String(externalRef),
        MpesaReceiptNumber: String(receipt),
        ResultDesc: String(resultDesc),
        CheckoutRequestID: checkoutRequestId,
      }
    }
  };
}

/**
 * USD → KES conversion
 */
export async function usdToKes(usd: number): Promise<number> {
  const settings = await getMpesaSettings();
  return Math.ceil(usd * settings.usdToKes);
}

/**
 * Check if PayHero M-Pesa is configured
 */
export async function isMpesaConfigured(): Promise<boolean> {
  const settings = await getMpesaSettings();
  return !!(settings.username && settings.password && settings.channelId && settings.enabled);
}