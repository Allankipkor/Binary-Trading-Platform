export function getUsdtDepositAddress(): string | null {
  return process.env.CRYPTO_USDT_ADDRESS ?? null;
}

export function isCryptoConfigured(): boolean {
  return !!getUsdtDepositAddress();
}

export function isAutoConfirmEnabled(): boolean {
  return process.env.CRYPTO_AUTO_CONFIRM === "true";
}

export function generateDepositReference(): string {
  return `OM${Date.now().toString(36).toUpperCase()}`;
}
