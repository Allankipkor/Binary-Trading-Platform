export const ASSETS = [
  { id: "volatility_10", name: "Volatility 10 Index", payout: 95 },
  { id: "volatility_25", name: "Volatility 25 Index", payout: 92 },
  { id: "volatility_50", name: "Volatility 50 Index", payout: 90 },
  { id: "volatility_75", name: "Volatility 75 Index", payout: 88 },
  { id: "volatility_100", name: "Volatility 100 Index", payout: 85 },
  { id: "jump_10", name: "Jump 10 Index", payout: 93 },
  { id: "jump_25", name: "Jump 25 Index", payout: 91 },
  { id: "jump_50", name: "Jump 50 Index", payout: 89 },
  { id: "step_10", name: "Step Index 10", payout: 94 },
  { id: "step_25", name: "Step Index 25", payout: 92 },
  { id: "range_break", name: "Range Break 100", payout: 87 },
  { id: "crash_500", name: "Crash 500 Index", payout: 86 },
] as const;

export type Asset = (typeof ASSETS)[number];

export function getAsset(id: string) {
  return ASSETS.find((a) => a.id === id);
}

export function getVolatility(assetId: string) {
  if (assetId.includes("100")) return 3;
  if (assetId.includes("75")) return 2.5;
  return 2;
}
