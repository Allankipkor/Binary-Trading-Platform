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

/**
 * INITIATE GRAVITYPAY STK PUSH
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

  const response = await axios.post(
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
