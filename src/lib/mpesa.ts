const SANDBOX_BASE = "https://sandbox.safaricom.co.ke";
const PROD_BASE = "https://api.safaricom.co.ke";

function baseUrl() {
  return process.env.MPESA_ENV === "production" ? PROD_BASE : SANDBOX_BASE;
}
function getTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);
}
async function getAccessToken(): Promise<string> {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) {
    throw new Error("M-Pesa credentials not configured");
  }

  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!res.ok) throw new Error("Failed to get M-Pesa access token");
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.startsWith("7")) return `254${digits}`;
  return digits;
}

function generatePassword(timestamp: string): string {
  const shortcode = process.env.MPESA_SHORTCODE ?? "";
  const passkey = process.env.MPESA_PASSKEY ?? "";
  const str = shortcode + passkey + timestamp;
  return Buffer.from(str).toString("base64");
}

export interface StkPushResult {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export async function initiateStkPush(params: {
  phone: string;
  amountKes: number;
  accountReference: string;
  transactionDesc: string;
}): Promise<StkPushResult> {
  const token = await getAccessToken();
  const timestamp = getTimestamp();
const password = generatePassword(timestamp);
const shortcode = process.env.MPESA_TILL_NUMBER ?? process.env.MPESA_SHORTCODE;

if (!shortcode) {
  throw new Error("M-Pesa shortcode not configured");
}
const callbackUrl = process.env.MPESA_CALLBACK_URL;

if (!callbackUrl) {
  throw new Error("MPESA_CALLBACK_URL not configured");
}
  const body = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerBuyGoodsOnline",
    Amount: Math.ceil(params.amountKes),
    PartyA: formatPhone(params.phone),
    PartyB: process.env.MPESA_TILL_NUMBER,
    PhoneNumber: formatPhone(params.phone),
    CallBackURL: callbackUrl,
    AccountReference: params.accountReference?.slice(0, 12) ?? "OpenMarket",
    TransactionDesc: params.transactionDesc?.slice(0, 13) ?? "Deposit",
  };

  const res = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.errorMessage ?? data.error ?? "STK push failed");
  }
  return data as StkPushResult;
}

export function usdToKes(usd: number): number {
  const rate = parseFloat(process.env.USD_TO_KES ?? "130");
  return Math.ceil(usd * rate);
}

export function isMpesaConfigured(): boolean {
  return !!(process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET);
}
