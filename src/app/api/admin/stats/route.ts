import { requireAdmin, unauthorized } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const [
    totalUsers,
    activeUsers,
    suspendedUsers,
    totalTrades,
    totalDeposits,
    totalWithdrawals,
    pendingDeposits,
    pendingWithdrawals,
    recentUsers,
    recentTrades,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { suspended: false, role: "user" } }),
    prisma.user.count({ where: { suspended: true } }),
    prisma.trade.count(),
    prisma.transaction.aggregate({ where: { type: "deposit", status: "completed" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: "withdrawal", status: "completed" }, _sum: { amount: true } }),
    prisma.transaction.count({ where: { type: "deposit", status: "pending" } }),
    prisma.transaction.count({ where: { type: "withdrawal", status: "pending" } }),
    prisma.user.findMany({ where: { role: "user" }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, email: true, name: true, balance: true, createdAt: true, suspended: true } }),
    prisma.trade.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { user: { select: { email: true, name: true } } } }),
  ]);

  return NextResponse.json({
    totalUsers,
    activeUsers,
    suspendedUsers,
    totalTrades,
    totalDeposits: totalDeposits._sum.amount ?? 0,
    totalWithdrawals: totalWithdrawals._sum.amount ?? 0,
    pendingDeposits,
    pendingWithdrawals,
    recentUsers,
    recentTrades,
  });
}
