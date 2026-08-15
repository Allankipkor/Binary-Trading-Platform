// PayPal REST API integration (Orders v2 API + OAuth client-credentials).
// Used by the "card" tab in DepositModal — PayPal's hosted button covers
// both PayPal-balance payments and debit/credit cards in one integration.

import { getGateway, type PaypalConfig } from "./gateways";

export async function getPaypalSettings(): Promise<{
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  payeeEmail?: string;
  env: "sandbox" | "live";
  apiBase: string;
}> {
  try {
    const gw = await getGateway("card");
    const cfg = gw.parsedConfig as PaypalConfig;

    const clientId = cfg.clientId || process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";
    const clientSecret = cfg.clientSecret || process.env.PAYPAL_CLIENT_SECRET || "";
    const payeeEmail = cfg.payeeEmail || process.env.PAYPAL_PAYEE_EMAIL || undefined;
    const env = cfg.env || (process.env.PAYPAL_ENV as "sandbox" | "live") || "live";

    const apiBase = env === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

    return {
      enabled: gw.enabled,
      clientId,
      clientSecret,
      payeeEmail,
      env,
      apiBase,
    };
  } catch {
    const clientId = process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET || "";
    const payeeEmail = process.env.PAYPAL_PAYEE_EMAIL || undefined;
    const env = (process.env.PAYPAL_ENV as "sandbox" | "live") || "live";
    const apiBase = env === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

    return {
      enabled: true,
      clientId,
      clientSecret,
      payeeEmail,
      env,
      apiBase,
    };
  }
}

export async function isPaypalConfigured(): Promise<boolean> {
  const settings = await getPaypalSettings();
  return !!(settings.clientId && settings.clientSecret && settings.enabled);
}

let cachedToken: { value: string; expiresAt: number; clientId: string } | null = null;

/**
 * Exchanges our client ID + secret for a short-lived OAuth access token.
 */
async function getAccessToken(): Promise<string> {
  const settings = await getPaypalSettings();
  const { clientId, clientSecret, apiBase } = settings;

  if (cachedToken && cachedToken.expiresAt > Date.now() && cachedToken.clientId === clientId) {
    return cachedToken.value;
  }

  if (!clientId || !clientSecret) {
    throw new Error("PayPal not configured. Configure in Admin Settings or set in .env");
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal OAuth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    clientId,
  };
  return cachedToken.value;
}

export interface CreateOrderResult {
  id: string;
}

/**
 * Creates a PayPal order for the given USD amount.
 */
export async function createPaypalOrder(params: {
  amount: number;
  referenceId: string;
}): Promise<CreateOrderResult> {
  const settings = await getPaypalSettings();
  const token = await getAccessToken();
  const payeeEmail = settings.payeeEmail;

  const res = await fetch(`${settings.apiBase}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: params.referenceId,
          amount: {
            currency_code: "USD",
            value: params.amount.toFixed(2),
          },
          ...(payeeEmail ? { payee: { email_address: payeeEmail } } : {}),
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal create order failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return { id: data.id };
}

export interface CaptureOrderResult {
  status: string;
  amount: number;
  currency: string;
  captureId: string;
  payerEmail?: string;
  payeeEmail?: string;
}

/**
 * Captures a previously-created and buyer-approved order.
 */
export async function capturePaypalOrder(orderId: string): Promise<CaptureOrderResult> {
  const settings = await getPaypalSettings();
  const token = await getAccessToken();

  const res = await fetch(`${settings.apiBase}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal capture failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const purchaseUnit = data.purchase_units?.[0];
  const capture = purchaseUnit?.payments?.captures?.[0];

  if (!capture || data.status !== "COMPLETED") {
    throw new Error(`PayPal order not completed (status: ${data.status})`);
  }

  return {
    status: data.status,
    amount: parseFloat(capture.amount?.value ?? "0"),
    currency: capture.amount?.currency_code ?? "USD",
    captureId: capture.id,
    payerEmail: data.payer?.email_address,
    payeeEmail: purchaseUnit?.payee?.email_address,
  };
}