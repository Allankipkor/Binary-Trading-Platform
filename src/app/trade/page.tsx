import { TradingPlatform } from "@/components/trade/TradingPlatform";

export default async function TradePage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const params = await searchParams;
  const isDemo = params.demo === "true";
  return <TradingPlatform forceDemo={isDemo} />;
}
