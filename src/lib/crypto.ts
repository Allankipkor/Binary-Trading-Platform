import { getGateway, type CryptoConfig } from "./gateways";

export async function getCryptoSettings(): Promise<{
  enabled: boolean;
  address: string | null;
  network: string;
  tronGridApiKey: string | null;
  autoConfirm: boolean;
}> {
  try {
    const gw = await getGateway("crypto");
    const cfg = gw.parsedConfig as CryptoConfig;

    return {
      enabled: gw.enabled,
      address: cfg.address || process.env.CRYPTO_USDT_ADDRESS || null,
      network: cfg.network || "TRC20",
      tronGridApiKey: cfg.tronGridApiKey || process.env.TRONGRID_API_KEY || null,
      autoConfirm: cfg.autoConfirm !== undefined ? cfg.autoConfirm : process.env.CRYPTO_AUTO_CONFIRM === "true",
    };
  } catch {
    return {
      enabled: true,
      address: process.env.CRYPTO_USDT_ADDRESS || null,
      network: "TRC20",
      tronGridApiKey: process.env.TRONGRID_API_KEY || null,
      autoConfirm: process.env.CRYPTO_AUTO_CONFIRM === "true",
    };
  }
}

export async function getUsdtDepositAddress(): Promise<string | null> {
  const settings = await getCryptoSettings();
  return settings.address;
}

export async function isCryptoConfigured(): Promise<boolean> {
  const settings = await getCryptoSettings();
  return !!(settings.address && settings.enabled);
}

export async function isAutoConfirmEnabled(): Promise<boolean> {
  const settings = await getCryptoSettings();
  return settings.autoConfirm;
}

export function generateDepositReference(): string {
  return `OM${Date.now().toString(36).toUpperCase()}`;
}

// Official USDT TRC20 contract address on TRON mainnet.
const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const USDT_DECIMALS = 6;

const TRONGRID_BASE_URL = "https://api.trongrid.io";

interface TronGridTrc20Transfer {
  transaction_id: string;
  token_info: {
    symbol: string;
    address: string;
    decimals: number;
    name: string;
  };
  block_timestamp: number;
  from: string;
  to: string;
  type: string;
  value: string;
}

interface TronGridTrc20Response {
  success: boolean;
  data: TronGridTrc20Transfer[];
}

export interface VerifyUsdtTransferResult {
  verified: boolean;
  reason?: string;
  amount?: number;
  from?: string;
}

/**
 * Verifies that a given transaction hash corresponds to a REAL, on-chain
 * USDT (TRC20) transfer of at least `minAmount` to our own deposit address.
 */
export async function verifyUsdtTransfer(params: {
  txHash: string;
  minAmount: number;
}): Promise<VerifyUsdtTransferResult> {
  const settings = await getCryptoSettings();
  const ourAddress = settings.address;

  if (!ourAddress) {
    return { verified: false, reason: "Crypto deposits not configured" };
  }

  const apiKey = settings.tronGridApiKey || process.env.TRONGRID_API_KEY;

  try {
    const url = new URL(`${TRONGRID_BASE_URL}/v1/accounts/${ourAddress}/transactions/trc20`);
    url.searchParams.set("only_to", "true");
    url.searchParams.set("only_confirmed", "true");
    url.searchParams.set("contract_address", USDT_TRC20_CONTRACT);
    url.searchParams.set("limit", "50");

    const res = await fetch(url.toString(), {
      headers: apiKey ? { "TRON-PRO-API-KEY": apiKey } : {},
    });

    if (!res.ok) {
      return { verified: false, reason: "Could not reach the TRON network to verify this transaction" };
    }

    const data: TronGridTrc20Response = await res.json();
    if (!data.success) {
      return { verified: false, reason: "TRON network lookup failed" };
    }

    const match = data.data.find((t) => t.transaction_id === params.txHash);
    if (!match) {
      return {
        verified: false,
        reason: "Transaction not found among confirmed USDT transfers to our address. If you just sent it, wait a minute and try again.",
      };
    }

    if (match.token_info.address !== USDT_TRC20_CONTRACT) {
      return { verified: false, reason: "Transaction is not a USDT TRC20 transfer" };
    }

    const decimals = match.token_info.decimals ?? USDT_DECIMALS;
    const amount = Number(match.value) / Math.pow(10, decimals);

    if (!Number.isFinite(amount) || amount <= 0) {
      return { verified: false, reason: "Could not parse the on-chain transfer amount" };
    }

    if (amount < params.minAmount - 0.000001) {
      return {
        verified: false,
        reason: `On-chain amount (${amount} USDT) is less than the requested deposit (${params.minAmount} USDT)`,
      };
    }

    return { verified: true, amount, from: match.from };
  } catch (err) {
    console.error("verifyUsdtTransfer error:", err);
    return { verified: false, reason: "Error verifying transaction on-chain" };
  }
}