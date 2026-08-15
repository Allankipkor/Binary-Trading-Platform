import { prisma } from "@/lib/prisma";

export interface MpesaConfig {
  username?: string;
  password?: string;
  channelId?: string;
  usdToKes?: number;
  callbackUrl?: string;
}

export interface CryptoConfig {
  address?: string;
  network?: string;
  tronGridApiKey?: string;
  autoConfirm?: boolean;
}

export interface PaypalConfig {
  clientId?: string;
  clientSecret?: string;
  payeeEmail?: string;
  env?: "sandbox" | "live";
}

export type GatewayConfig = MpesaConfig | CryptoConfig | PaypalConfig;

export interface GatewayRecord {
  id: string; // "mpesa" | "crypto" | "card"
  name: string;
  enabled: boolean;
  minDeposit: number | null;
  maxDeposit: number | null;
  config: string | null;
  instructions: string | null;
  parsedConfig: GatewayConfig;
}

export interface GatewayPublicInfo {
  id: string;
  name: string;
  enabled: boolean;
  minDeposit: number;
  maxDeposit: number | null;
  instructions: string | null;
  clientConfig?: {
    paypalClientId?: string;
    paypalEnv?: string;
    cryptoAddress?: string;
    cryptoNetwork?: string;
    usdToKes?: number;
  };
}

let tableEnsured = false;
async function ensureGatewayTable() {
  if (tableEnsured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PaymentGateway" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "enabled" BOOLEAN NOT NULL DEFAULT true,
        "minDeposit" DOUBLE PRECISION,
        "maxDeposit" DOUBLE PRECISION,
        "config" TEXT,
        "instructions" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    tableEnsured = true;
  } catch (e) {
    console.error("ensureGatewayTable error:", e);
  }
}

/**
 * Returns default fallback config values from process.env for a given gateway id.
 */
export function getDefaultGatewayConfig(id: string): {
  name: string;
  enabled: boolean;
  minDeposit: number | null;
  maxDeposit: number | null;
  instructions: string | null;
  parsedConfig: GatewayConfig;
} {
  if (id === "mpesa") {
    return {
      name: "M-Pesa (PayHero)",
      enabled: true,
      minDeposit: null, // Inherits global minDeposit if null
      maxDeposit: 150000,
      instructions: "Enter your phone number to receive an instant M-Pesa STK prompt on your device.",
      parsedConfig: {
        username: process.env.PAYHERO_USERNAME || "",
        password: process.env.PAYHERO_PASSWORD || "",
        channelId: process.env.PAYHERO_CHANNEL_ID || "",
        usdToKes: parseFloat(process.env.USD_TO_KES || "130"),
        callbackUrl: process.env.MPESA_CALLBACK_URL || "",
      },
    };
  }

  if (id === "crypto") {
    return {
      name: "USDT (TRC20)",
      enabled: true,
      minDeposit: null,
      maxDeposit: 50000,
      instructions: "Transfer USDT via TRC20 network to the address provided and submit the transaction hash.",
      parsedConfig: {
        address: process.env.CRYPTO_USDT_ADDRESS || "",
        network: "TRC20",
        tronGridApiKey: process.env.TRONGRID_API_KEY || "",
        autoConfirm: process.env.CRYPTO_AUTO_CONFIRM === "true",
      },
    };
  }

  // "card" / PayPal
  return {
    name: "Credit / Debit Card (PayPal)",
    enabled: true,
    minDeposit: null,
    maxDeposit: 10000,
    instructions: "Pay securely with Visa, Mastercard, or your PayPal wallet.",
    parsedConfig: {
      clientId: process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "",
      clientSecret: process.env.PAYPAL_CLIENT_SECRET || "",
      payeeEmail: process.env.PAYPAL_PAYEE_EMAIL || "",
      env: (process.env.PAYPAL_ENV as "sandbox" | "live") || "live",
    },
  };
}

/**
 * Fetch a single gateway by ID with fallback to .env and database seeding.
 */
export async function getGateway(id: "mpesa" | "crypto" | "card" | string): Promise<GatewayRecord> {
  const defaults = getDefaultGatewayConfig(id);
  await ensureGatewayTable();

  try {
    const record = await (prisma as any).paymentGateway.findUnique({
      where: { id },
    });

    if (!record) {
      // Seed default record in the background
      const created = await (prisma as any).paymentGateway.create({
        data: {
          id,
          name: defaults.name,
          enabled: defaults.enabled,
          minDeposit: defaults.minDeposit,
          maxDeposit: defaults.maxDeposit,
          config: JSON.stringify(defaults.parsedConfig),
          instructions: defaults.instructions,
        },
      });

      return {
        id: created.id,
        name: created.name,
        enabled: created.enabled,
        minDeposit: created.minDeposit,
        maxDeposit: created.maxDeposit,
        config: created.config,
        instructions: created.instructions,
        parsedConfig: defaults.parsedConfig,
      };
    }

    let parsedConfig: GatewayConfig = defaults.parsedConfig;
    if (record.config) {
      try {
        const stored = JSON.parse(record.config);
        parsedConfig = { ...defaults.parsedConfig, ...stored };
      } catch (err) {
        console.error(`Failed to parse gateway config for ${id}:`, err);
      }
    }

    return {
      id: record.id,
      name: record.name,
      enabled: record.enabled,
      minDeposit: record.minDeposit,
      maxDeposit: record.maxDeposit,
      config: record.config,
      instructions: record.instructions,
      parsedConfig,
    };
  } catch (error) {
    console.error(`Failed to fetch gateway ${id} from database, using defaults:`, error);
    return {
      id,
      name: defaults.name,
      enabled: defaults.enabled,
      minDeposit: defaults.minDeposit,
      maxDeposit: defaults.maxDeposit,
      config: JSON.stringify(defaults.parsedConfig),
      instructions: defaults.instructions,
      parsedConfig: defaults.parsedConfig,
    };
  }
}

/**
 * Fetch all registered gateways.
 */
export async function getAllGateways(): Promise<GatewayRecord[]> {
  const gatewayIds: ("mpesa" | "crypto" | "card")[] = ["mpesa", "crypto", "card"];
  const list: GatewayRecord[] = [];

  for (const id of gatewayIds) {
    const gw = await getGateway(id);
    list.push(gw);
  }

  return list;
}

/**
 * Fetch public gateway details for client/deposit modal.
 */
export async function getPublicGateways(globalMinDeposit: number = 5.0): Promise<GatewayPublicInfo[]> {
  const all = await getAllGateways();

  return all.map((gw) => {
    const effectiveMin = gw.minDeposit !== null && gw.minDeposit !== undefined && gw.minDeposit > 0
      ? gw.minDeposit
      : globalMinDeposit;

    const publicInfo: GatewayPublicInfo = {
      id: gw.id,
      name: gw.name,
      enabled: gw.enabled,
      minDeposit: effectiveMin,
      maxDeposit: gw.maxDeposit,
      instructions: gw.instructions,
    };

    if (gw.id === "card") {
      const paypalCfg = gw.parsedConfig as PaypalConfig;
      publicInfo.clientConfig = {
        paypalClientId: paypalCfg.clientId || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "",
        paypalEnv: paypalCfg.env || process.env.PAYPAL_ENV || "live",
      };
    } else if (gw.id === "crypto") {
      const cryptoCfg = gw.parsedConfig as CryptoConfig;
      publicInfo.clientConfig = {
        cryptoAddress: cryptoCfg.address || "",
        cryptoNetwork: cryptoCfg.network || "TRC20",
      };
    } else if (gw.id === "mpesa") {
      const mpesaCfg = gw.parsedConfig as MpesaConfig;
      publicInfo.clientConfig = {
        usdToKes: mpesaCfg.usdToKes || 130,
      };
    }

    return publicInfo;
  });
}
