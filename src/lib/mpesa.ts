import axios from "axios";

/**
 * Format Kenyan phone number to 2547XXXXXXXX
 */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.startsWith("7")) return `254${digits}`;
  return digits;
}

interface GravityPayStkResponse {
  success: boolean;
  message: string;
  data: {
    transactionId: string;
    checkoutRequestId: string;
    merchantRequestId: string;
    status: string;
  };
}

/**
 * INITIATE GRAVITYPAY STK PUSH
 *
 * Real response shape confirmed via direct testing (2026-06-19):
 * {
 *   "success": true,
 *   "message": "Success. Request accepted for processing",
 *   "data": {
 *     "transactionId": "...",
 *     "checkoutRequestId": "ws_CO_...",
 *     "merchantRequestId": "...",
 *     "status": "pending"
 *   }
 * }
 */
export async function initiateStkPush(params: {
  phone: string;
  amountKes: number;
  accountReference: string;
  transactionDesc: string;
}) {
  const secret = process.env.GRAVITYPAY_SECRET_KEY;
  const publicKey = process.env.GRAVITYPAY_PUBLIC_KEY;

  if (!secret || !publicKey) {
    throw new Error("GravityPay credentials not configured");
  }

  const response = await axios.post<GravityPayStkResponse>(
    "https://gravitypayserver.vercel.app/api/v1/stk/push",
    {
      phoneNumber: formatPhone(params.phone),
      amount: Math.ceil(params.amountKes),
      reference: params.accountReference?.slice(0, 12) ?? "OPENMARKET",
      description: params.transactionDesc?.slice(0, 50) ?? "Deposit",
    },
    {
      headers: {
        Authorization: `Bearer ${secret}`,
        "x-api-key": publicKey,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.data.success) {
    throw new Error(response.data.message || "STK push failed");
  }

  // Normalize to the field names the rest of our app expects, so callers
  // (deposit route, status polling) don't need to know GravityPay's exact shape.
  return {
    transactionId: response.data.data.transactionId,
    checkoutRequestId: response.data.data.checkoutRequestId,
    merchantRequestId: response.data.data.merchantRequestId,
    status: response.data.data.status,
    CustomerMessage: response.data.message,
  };
}

interface GravityPayStatusResponse {
  success: boolean;
  error?: string;
  data?: {
    transactionId: string;
    checkoutRequestId: string;
    status: string; // "pending" | "success" | "failed" (confirm exact values when you see one resolve)
    amount?: number;
    mpesaReceipt?: string;
    phoneNumber?: string;
    resultDesc?: string;
  };
}

/**
 * CHECK STK PUSH STATUS — used for polling fallback while webhooks are
 * unreliable. Pass the checkoutRequestId returned by initiateStkPush.
 */
export async function checkStkStatus(checkoutRequestId: string): Promise<GravityPayStatusResponse> {
  const secret = process.env.GRAVITYPAY_SECRET_KEY;
  const publicKey = process.env.GRAVITYPAY_PUBLIC_KEY;

  if (!secret || !publicKey) {
    throw new Error("GravityPay credentials not configured");
  }

  const response = await axios.get<GravityPayStatusResponse>(
    `https://api.gravitypayapp.com/api/v1/stk/status/${checkoutRequestId}`,
    {
      headers: {
        Authorization: `Bearer ${secret}`,
        "x-api-key": publicKey,
      },
      validateStatus: () => true, // we want to inspect 404/error bodies ourselves
    }
  );

  return response.data;
}

/**
 * USD → KES conversion
 */
export function usdToKes(usd: number): number {
  const rate = parseFloat(process.env.USD_TO_KES ?? "130");
  return Math.ceil(usd * rate);
}

/**
 * Check if GravityPay is configured
 */
export function isMpesaConfigured(): boolean {
  return !!(
    process.env.GRAVITYPAY_SECRET_KEY &&
    process.env.GRAVITYPAY_PUBLIC_KEY
  );
}