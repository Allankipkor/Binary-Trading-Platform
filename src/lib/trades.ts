import { prisma } from "./prisma";
import { getPrice, tickPrice } from "./prices";

export async function settleExpiredTrades(userId?: string) {
  const now = new Date();
  const openTrades = await prisma.trade.findMany({
    where: {
      status: "open",
      expiresAt: { lte: now },
      ...(userId ? { userId } : {}),
    },
  });

  for (const trade of openTrades) {
    const closePrice = await getPrice(trade.assetId);
    const won =
      trade.direction === "up"
        ? closePrice > trade.openPrice
        : closePrice < trade.openPrice;
    const profit = won ? trade.stake * (trade.payout / 100) : -trade.stake;

    await prisma.$transaction([
      prisma.trade.update({
        where: { id: trade.id },
        data: {
          status: won ? "won" : "lost",
          closePrice,
          profit,
          settledAt: now,
        },
      }),
      ...(won
        ? [
            prisma.user.update({
              where: { id: trade.userId },
              data: { balance: { increment: trade.stake + profit } },
            }),
          ]
        : []),
    ]);
  }
}

export async function settleAndFetchTrades(userId: string) {
  await settleExpiredTrades(userId);
  return prisma.trade.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export { tickPrice };
