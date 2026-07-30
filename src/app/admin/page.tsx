"use client";

import { useEffect, useState } from "react";
import { Users, TrendingUp, DollarSign, Clock, ArrowUpRight } from "lucide-react";
import Link from "next/link";

interface RecentUser {
  id: string;
  email: string;
  name: string | null;
  balance: number;
  suspended: boolean;
}

interface RecentTrade {
  id: string;
  assetName: string;
  direction: string;
  status: string;
  stake: number;
  user: { name: string | null; email: string };
}

interface Stats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  totalTrades: number;
  totalDeposits: number;
  totalWithdrawals: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  recentUsers: RecentUser[];
  recentTrades: RecentTrade[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-[3px] border-[#833ab4] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) return <p className="text-gray-500">Failed to load stats.</p>;

  const cards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "#833ab4", href: "/admin/users" },
    { label: "Active Users", value: stats.activeUsers, icon: TrendingUp, color: "#22c55e", href: "/admin/users" },
    { label: "Total Trades", value: stats.totalTrades, icon: TrendingUp, color: "#3b82f6", href: "#" },
    { label: "Deposits", value: `$${(stats.totalDeposits).toLocaleString()}`, icon: DollarSign, color: "#22c55e", href: "/admin/transactions?type=deposit" },
    { label: "Withdrawals", value: `$${(stats.totalWithdrawals).toLocaleString()}`, icon: ArrowUpRight, color: "#ef4444", href: "/admin/transactions?type=withdrawal" },
    { label: "Pending", value: stats.pendingDeposits + stats.pendingWithdrawals, icon: Clock, color: "#f59e0b", href: "/admin/transactions?status=pending" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of SmartDollarFX platform</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-[#0d0f17] border border-white/[0.07] rounded-2xl p-4 hover:border-white/[0.15] transition"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${card.color}15` }}>
                <card.icon className="w-5 h-5" style={{ color: card.color }} />
              </div>
              <span className="text-2xl font-extrabold text-white">{card.value}</span>
            </div>
            <p className="text-xs text-gray-500">{card.label}</p>
          </Link>
        ))}
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent users */}
        <div className="bg-[#0d0f17] border border-white/[0.07] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white">Recent Users</h2>
            <Link href="/admin/users" className="text-xs text-[#833ab4] hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {stats.recentUsers.length === 0 ? (
              <p className="text-xs text-gray-500">No users yet</p>
            ) : (
              stats.recentUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center text-xs font-bold shrink-0">
                      {(u.name || u.email)[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{u.name || "N/A"}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold ${u.suspended ? "text-rose-400" : "text-emerald-400"}`}>
                    ${u.balance.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent trades */}
        <div className="bg-[#0d0f17] border border-white/[0.07] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white">Recent Trades</h2>
          </div>
          <div className="space-y-3">
            {stats.recentTrades.length === 0 ? (
              <p className="text-xs text-gray-500">No trades yet</p>
            ) : (
              stats.recentTrades.map((t) => (
                <div key={t.id} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{t.assetName}</p>
                    <p className="text-xs text-gray-500 truncate">{t.user.name || t.user.email} · {t.direction}</p>
                  </div>
                  <span className={`text-xs font-bold ${t.status === "won" ? "text-emerald-400" : t.status === "lost" ? "text-rose-400" : "text-amber-400"}`}>
                    ${t.stake.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
