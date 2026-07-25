import axios from "axios";

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

const PAYHERO_BASE_URL = process.env.PAYHERO_BASE_URL ?? "https://backend.payhero.co.ke/api/v2";

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
  const username = process.env.PAYHERO_USERNAME;
  const password = process.env.PAYHERO_PASSWORD;
  const channelId = process.env.PAYHERO_CHANNEL_ID;

  if (!username || !password || !channelId) {
    throw new Error("PayHero credentials not configured");
  }

  const callbackUrl = process.env.MPESA_CALLBACK_URL;
  if (!callbackUrl) {
    throw new Error("MPESA_CALLBACK_URL not configured");
  }

  const externalReference = params.accountReference?.slice(0, 32) ?? "OPENMARKET";
  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

  let response;
  try {
    response = await axios.post(
      `${PAYHERO_BASE_URL}/payments`,
      {
        amount: Math.ceil(params.amountKes),
        phone_number: formatPhone(params.phone),
        channel_id: parseInt(channelId),
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
  const username = process.env.PAYHERO_USERNAME;
  const password = process.env.PAYHERO_PASSWORD;

  if (!username || !password) {
    throw new Error("PayHero credentials not configured");
  }

  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

  const response = await axios.get(
    `${PAYHERO_BASE_URL}/transaction-status`,
    {
      params: { reference: checkoutRequestId },
      headers: {
        Authorization: authHeader,
      },
      validateStatus: () => true, // we want to inspect error status codes/bodies ourselves
    }
  );

  const rawData = response.data;

  // PayHero uses SUCCESS, FAILED, QUEUED status strings
  const statusStr = (rawData.status || rawData.Status || "").toUpperCase().trim();
  const innerData = rawData.data || rawData.response || rawData;

  const isSuccess = statusStr === "SUCCESS" || innerData.status === "SUCCESS" || innerData.Status === "SUCCESS";
  const isFailed = statusStr === "FAILED" || innerData.status === "FAILED" || innerData.Status === "FAILED";
  const isPending = statusStr === "QUEUED" || innerData.status === "QUEUED" || innerData.Status === "QUEUED";

  let normalizedStatus = "Pending";
  if (isSuccess) normalizedStatus = "Success";
  else if (isFailed) normalizedStatus = "Failed";

  const amount = innerData.Amount || innerData.amount || 0;
  const externalRef = innerData.ExternalReference || innerData.external_reference || innerData.reference || checkoutRequestId;
  const receipt = innerData.MpesaReceiptNumber || innerData.reference || innerData.transaction_code || "";
  const resultDesc = rawData.message || rawData.ResultDesc || rawData.result_desc || "";

  return {
    success: isSuccess || isFailed || isPending,
    message: rawData.message,
    data: {
      response: {
        Status: normalizedStatus,
        Amount: amount,
        ExternalReference: externalRef,
        MpesaReceiptNumber: receipt,
        ResultDesc: resultDesc,
        CheckoutRequestID: checkoutRequestId,
      }
    }
  };
}

/**
 * USD → KES conversion
 */
export function usdToKes(usd: number): number {
  const rate = parseFloat(process.env.USD_TO_KES ?? "130");
  return Math.ceil(usd * rate);
}

/**
 * Check if PayHero M-Pesa is configured
 */
export function isMpesaConfigured(): boolean {
  return !!(
    process.env.PAYHERO_USERNAME &&
    process.env.PAYHERO_PASSWORD &&
    process.env.PAYHERO_CHANNEL_ID
  );
}