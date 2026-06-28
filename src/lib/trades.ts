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

    // Claim this trade atomically before doing anything else. updateMany
    // with `status: "open"` in the WHERE clause means only the first caller
    // to reach this line actually updates a row — if another request
    // (e.g. a second browser tab/device polling the same account) already
    // settled this same trade a moment earlier, count will be 0 here and we
    // skip it entirely. Without this guard, two overlapping calls to
    // settleExpiredTrades (easy to trigger with multiple tabs open, since
    // syncFromApi() polls on every price tick) could both see the trade as
    // still "open", both proceed, and on a win both credit the payout —
    // double-crediting a single win, which is what was actually happening
    // here, not a sign error in the profit math itself.
    const claim = await prisma.trade.updateMany({
      where: { id: trade.id, status: "open" },
      data: {
        status: won ? "won" : "lost",
        closePrice,
        profit,
        settledAt: now,
      },
    });

    if (claim.count === 0) {
      // Another concurrent call already claimed and settled this trade.
      // Don't touch balance — that already happened (exactly once) there.
      continue;
    }

    if (won) {
      await prisma.user.update({
        where: { id: trade.userId },
        data: { balance: { increment: trade.stake + profit } },
      });
    }
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