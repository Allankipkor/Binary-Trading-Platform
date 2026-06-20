import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("type") ?? "all"; // all | trades | transactions
  const limit = Math.min(200, parseInt(searchParams.get("limit") ?? "100", 10) || 100);

  const [trades, transactions] = await Promise.all([
    filter === "transactions"
      ? Promise.resolve([])
      : prisma.trade.findMany({
          where: { userId: session.user.id, status: { in: ["won", "lost"] } },
          orderBy: { settledAt: "desc" },
          take: limit,
        }),
    filter === "trades"
      ? Promise.resolve([])
      : prisma.transaction.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
  ]);

  const tradeItems = trades.map((t) => ({
    kind: "trade" as const,
    id: t.id,
    label: `${t.contractType.split("|")[0]} — ${t.assetName}`,
    amount: t.profit ?? 0,
    status: t.status,
    date: t.settledAt ?? t.createdAt,
  }));

  const transactionItems = transactions.map((tx) => ({
    kind: "transaction" as const,
    id: tx.id,
    label: `${tx.type === "deposit" ? "Deposit" : "Withdrawal"} — ${tx.method}`,
    amount: tx.type === "deposit" ? tx.amount : -tx.amount,
    status: tx.status,
    date: tx.createdAt,
  }));

  const combined = [...tradeItems, ...transactionItems].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return NextResponse.json({ items: combined.slice(0, limit) });
}