"use client";

import { useEffect, useState } from "react";
import { Check, X, ChevronLeft, ChevronRight } from "lucide-react";

interface Transaction {
  id: string;
  type: string;
  method: string;
  amount: number;
  currency: string;
  status: string;
  externalRef: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null };
}

export default function AdminTransactionsPage() {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [msg, setMsg] = useState("");

  const fetchTxs = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (statusFilter) params.set("status", statusFilter);
    params.set("page", String(page));

    const res = await fetch(`/api/admin/transactions?${params}`);
    const data = await res.json();
    setTxs(data.transactions);
    setTotal(data.total);
    setTotalPages(data.totalPages);
    setLoading(false);
  };

  useEffect(() => { fetchTxs(); }, [page, typeFilter, statusFilter]);

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const handleApprove = async (id: string) => {
    const res = await fetch(`/api/admin/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    if (res.ok) { showMsg("Transaction approved"); fetchTxs(); }
    else showMsg("Failed to approve");
  };

  const handleReject = async (id: string) => {
    const res = await fetch(`/api/admin/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "failed" }),
    });
    if (res.ok) { showMsg("Transaction rejected"); fetchTxs(); }
    else showMsg("Failed to reject");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Transactions</h1>
        <p className="text-sm text-gray-500 mt-1">{total} total transactions</p>
      </div>

      {msg && <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-sm text-emerald-400">{msg}</div>}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="bg-[#141822] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#833ab4]/50">
          <option value="">All Types</option>
          <option value="deposit">Deposits</option>
          <option value="withdrawal">Withdrawals</option>
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-[#141822] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#833ab4]/50">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#0d0f17] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] text-left text-[11px] text-gray-500 font-semibold uppercase tracking-wider">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12"><div className="w-6 h-6 border-[3px] border-[#833ab4] border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
              ) : txs.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-500 text-sm">No transactions found</td></tr>
              ) : (
                txs.map((tx) => (
                  <tr key={tx.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-semibold text-white truncate max-w-[150px]">{tx.user.name || tx.user.email}</p>
                      <p className="text-xs text-gray-500">{tx.user.email}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-bold uppercase ${tx.type === "deposit" ? "text-emerald-400" : "text-rose-400"}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-400">{tx.method || "—"}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-bold text-white">${tx.amount.toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                        tx.status === "completed" ? "bg-emerald-500/10 text-emerald-400" :
                        tx.status === "pending" ? "bg-amber-500/10 text-amber-400" :
                        "bg-rose-500/10 text-rose-400"
                      }`}>{tx.status}</span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {tx.status === "pending" && (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleApprove(tx.id)}
                            className="p-2 rounded-lg hover:bg-white/5 text-emerald-400 hover:text-emerald-300" title="Approve">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleReject(tx.id)}
                            className="p-2 rounded-lg hover:bg-white/5 text-rose-400 hover:text-rose-300" title="Reject">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.07]">
            <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 text-gray-400"><ChevronLeft className="w-4 h-4" /></button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 text-gray-400"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
