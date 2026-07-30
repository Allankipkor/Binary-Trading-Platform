"use client";

import { useEffect, useState } from "react";
import { Search, Plus, UserPlus, DollarSign, Ban, Trash2, Target, X, ChevronLeft, ChevronRight } from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  balance: number;
  demoBalance: number;
  role: string;
  suspended: boolean;
  winRate: number | null;
  createdAt: string;
  _count: { trades: number; transactions: number };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");

  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [showBalance, setShowBalance] = useState<{ id: string; name: string; balance: number } | null>(null);
  const [showWinRate, setShowWinRate] = useState<{ id: string; name: string; winRate: number | null } | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const [newUser, setNewUser] = useState({ email: "", password: "", name: "", phone: "" });
  const [balanceForm, setBalanceForm] = useState({ balance: 0 });
  const [winRateForm, setWinRateForm] = useState({ winRate: "" });
  const [actionMsg, setActionMsg] = useState("");

  const fetchUsers = async (p: number, q: string) => {
    setLoading(true);
    const res = await fetch(`/api/admin/users?page=${p}&q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setUsers(data.users);
    setTotal(data.total);
    setPage(data.page);
    setTotalPages(data.totalPages);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers(page, query);
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(searchInput);
    setPage(1);
  };

  const showMsg = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 3000);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    if (res.ok) {
      setShowAdd(false);
      setNewUser({ email: "", password: "", name: "", phone: "" });
      showMsg("User created!");
      fetchUsers(page, query);
    } else {
      const err = await res.json();
      showMsg(err.error || "Failed to create user");
    }
  };

  const handleUpdateBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showBalance) return;
    const res = await fetch(`/api/admin/users/${showBalance.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ balance: balanceForm.balance }),
    });
    if (res.ok) {
      setShowBalance(null);
      showMsg("Balance updated!");
      fetchUsers(page, query);
    }
  };

  const handleUpdateWinRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showWinRate) return;
    const res = await fetch(`/api/admin/users/${showWinRate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winRate: winRateForm.winRate === "" ? null : winRateForm.winRate }),
    });
    if (res.ok) {
      setShowWinRate(null);
      showMsg("Win rate updated!");
      fetchUsers(page, query);
    }
  };

  const handleToggleSuspend = async (user: User) => {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended: !user.suspended }),
    });
    if (res.ok) {
      showMsg(user.suspended ? "User unsuspended" : "User suspended");
      fetchUsers(page, query);
    }
  };

  const handleDeleteUser = async () => {
    if (!showConfirmDelete) return;
    const res = await fetch(`/api/admin/users/${showConfirmDelete.id}`, { method: "DELETE" });
    if (res.ok) {
      setShowConfirmDelete(null);
      showMsg("User deleted");
      fetchUsers(page, query);
    } else {
      const err = await res.json();
      showMsg(err.error || "Failed to delete user");
      setShowConfirmDelete(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Users</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total users</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-brand text-white text-sm font-bold transition">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {actionMsg && <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-sm text-emerald-400">{actionMsg}</div>}

      {/* Search */}
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by email, name, or phone..."
          className="w-full bg-[#141822] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-sm text-white outline-none focus:border-[#833ab4]/50 transition"
        />
      </form>

      {/* Table */}
      <div className="bg-[#0d0f17] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] text-left text-[11px] text-gray-500 font-semibold uppercase tracking-wider">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Trades</th>
                <th className="px-4 py-3">Win Rate</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12"><div className="w-6 h-6 border-[3px] border-[#833ab4] border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-500 text-sm">No users found</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center text-xs font-bold shrink-0">
                          {(u.name || u.email)[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{u.name || "N/A"}</p>
                          <p className="text-xs text-gray-500 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-bold text-white">${u.balance.toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-gray-400">{u._count.trades}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-sm font-semibold ${u.winRate !== null ? "text-emerald-400" : "text-gray-500"}`}>
                        {u.winRate !== null ? `${u.winRate}%` : "Default"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {u.suspended ? (
                        <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg">Suspended</span>
                      ) : (
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setShowBalance({ id: u.id, name: u.name || u.email, balance: u.balance }); setBalanceForm({ balance: u.balance }); }}
                          className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-emerald-400" title="Set Balance">
                          <DollarSign className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setShowWinRate({ id: u.id, name: u.name || u.email, winRate: u.winRate }); setWinRateForm({ winRate: u.winRate !== null ? String(u.winRate) : "" }); }}
                          className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-[#833ab4]" title="Win Rate">
                          <Target className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleToggleSuspend(u)}
                          className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-amber-400" title={u.suspended ? "Unsuspend" : "Suspend"}>
                          <Ban className="w-4 h-4" />
                        </button>
                        {u.role !== "admin" && (
                          <button onClick={() => setShowConfirmDelete({ id: u.id, name: u.name || u.email })}
                            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-rose-400" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.07]">
            <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 text-gray-400">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 text-gray-400">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Add User Modal ── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-[#0d0f17] border border-white/[0.07] rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white flex items-center gap-2"><UserPlus className="w-4 h-4" /> Add User</h2>
              <button onClick={() => setShowAdd(false)} className="p-1 rounded-lg hover:bg-white/5"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleAddUser} className="space-y-3">
              <input value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="Email" required className="w-full bg-[#141822] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#833ab4]/50" />
              <input value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} type="password" placeholder="Password" required className="w-full bg-[#141822] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#833ab4]/50" />
              <input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder="Name (optional)" className="w-full bg-[#141822] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#833ab4]/50" />
              <input value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} placeholder="Phone (optional)" className="w-full bg-[#141822] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#833ab4]/50" />
              <button type="submit" className="w-full h-11 rounded-xl bg-gradient-brand text-white text-sm font-bold transition">Create User</button>
            </form>
          </div>
        </div>
      )}

      {/* ── Balance Modal ── */}
      {showBalance && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowBalance(null)}>
          <div className="bg-[#0d0f17] border border-white/[0.07] rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white flex items-center gap-2"><DollarSign className="w-4 h-4" /> Set Balance</h2>
              <button onClick={() => setShowBalance(null)} className="p-1 rounded-lg hover:bg-white/5"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4">{showBalance.name}</p>
            <form onSubmit={handleUpdateBalance} className="space-y-3">
              <input type="number" step="0.01" value={balanceForm.balance} onChange={(e) => setBalanceForm({ balance: parseFloat(e.target.value) || 0 })}
                className="w-full bg-[#141822] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#833ab4]/50" />
              <button type="submit" className="w-full h-11 rounded-xl bg-gradient-brand text-white text-sm font-bold transition">Update Balance</button>
            </form>
          </div>
        </div>
      )}

      {/* ── Win Rate Modal ── */}
      {showWinRate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowWinRate(null)}>
          <div className="bg-[#0d0f17] border border-white/[0.07] rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white flex items-center gap-2"><Target className="w-4 h-4" /> Win Rate</h2>
              <button onClick={() => setShowWinRate(null)} className="p-1 rounded-lg hover:bg-white/5"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4">{showWinRate.name} · Leave empty for default</p>
            <form onSubmit={handleUpdateWinRate} className="space-y-3">
              <input type="number" step="0.1" value={winRateForm.winRate} onChange={(e) => setWinRateForm({ winRate: e.target.value })}
                placeholder="e.g. 60 (percentage)" className="w-full bg-[#141822] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#833ab4]/50" />
              <button type="submit" className="w-full h-11 rounded-xl bg-gradient-brand text-white text-sm font-bold transition">Update Win Rate</button>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm Delete ── */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowConfirmDelete(null)}>
          <div className="bg-[#0d0f17] border border-white/[0.07] rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold text-white mb-2">Delete User</h2>
            <p className="text-sm text-gray-400 mb-5">Are you sure you want to delete <strong className="text-white">{showConfirmDelete.name}</strong>? This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmDelete(null)} className="flex-1 h-11 rounded-xl border border-white/[0.08] text-sm font-semibold text-gray-400 hover:bg-white/5 transition">Cancel</button>
              <button onClick={handleDeleteUser} className="flex-1 h-11 rounded-xl bg-rose-500 text-white text-sm font-bold transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
