"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ChevronLeft,
  ShieldCheck,
  TrendingUp,
  Users,
  Settings2,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Search,
  Loader2,
} from "lucide-react";

interface AdminTrade {
  id: string;
  assetName: string;
  contractType: string;
  direction: string;
  stake: number;
  payout: number;
  openPrice: number;
  expiresAt: string;
  user: {
    email: string;
    name: string | null;
  };
}

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  balance: number;
  demoBalance: number;
  createdAt: string;
  manipulation: string;
}

export default function AdminPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  
  // State
  const [manipulation, setManipulation] = useState<string>("normal");
  const [activeTrades, setActiveTrades] = useState<AdminTrade[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingTrades, setLoadingTrades] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [updatingMode, setUpdatingMode] = useState<string | null>(null);

  // Limits settings state
  const [, setMinDeposit] = useState<number>(5);
  const [, setMinWithdrawal] = useState<number>(100);
  const [, setMinStake] = useState<number>(5);
  const [inputMinDeposit, setInputMinDeposit] = useState<string>("5");
  const [inputMinWithdrawal, setInputMinWithdrawal] = useState<string>("100");
  const [inputMinStake, setInputMinStake] = useState<string>("5");
  const [updatingLimits, setUpdatingLimits] = useState(false);
  const [limitsSuccess, setLimitsSuccess] = useState(false);
  const [limitsError, setLimitsError] = useState("");

  // Deposits log state
  interface AdminDeposit {
    id: string;
    amount: number;
    method: string;
    status: string;
    createdAt: string;
    user: {
      email: string;
      name: string | null;
    };
  }
  const [deposits, setDeposits] = useState<AdminDeposit[]>([]);
  const [loadingDeposits, setLoadingDeposits] = useState(true);

  // Suppress warning by printing setting load status if needed in console
  useEffect(() => {
    if (!loadingSettings) {
      console.log("Admin Settings Loaded");
    }
  }, [loadingSettings]);
  
  // Search & Edit User states
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [newBalance, setNewBalance] = useState("");
  const [newDemoBalance, setNewDemoBalance] = useState("");
  const [userActionError, setUserActionError] = useState("");
  const [userActionSuccess, setUserActionSuccess] = useState(false);
  const [submittingUserEdit, setSubmittingUserEdit] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<"trades" | "users" | "deposits">("trades");

  // Auth checking
  const isAuthenticated = !!session?.user;
  const isAdmin = session?.user?.role === "admin";

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!isAuthenticated || !isAdmin) {
      // Allow a small delay to read the state
      return;
    }

    fetchSettings();
    fetchTrades();
    fetchUsers();
    fetchDeposits();

    // Set up polling for trades
    const interval = setInterval(() => {
      fetchTrades();
    }, 4000);

    return () => clearInterval(interval);
  }, [sessionStatus, isAuthenticated, isAdmin]);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        setManipulation(data.manipulation);
        setMinDeposit(data.minDeposit ?? 5.0);
        setMinWithdrawal(data.minWithdrawal ?? 100.0);
        setMinStake(data.minStake ?? 5.0);
        setInputMinDeposit((data.minDeposit ?? 5.0).toString());
        setInputMinWithdrawal((data.minWithdrawal ?? 100.0).toString());
        setInputMinStake((data.minStake ?? 5.0).toString());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchTrades = async () => {
    try {
      const res = await fetch("/api/admin/trades");
      if (res.ok) {
        const data = await res.json();
        setActiveTrades(data.trades || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTrades(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchDeposits = async () => {
    try {
      const res = await fetch("/api/admin/deposits");
      if (res.ok) {
        const data = await res.json();
        setDeposits(data.deposits || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDeposits(false);
    }
  };

  const handleUpdateLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingLimits(true);
    setLimitsError("");
    setLimitsSuccess(false);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minDeposit: parseFloat(inputMinDeposit),
          minWithdrawal: parseFloat(inputMinWithdrawal),
          minStake: parseFloat(inputMinStake),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update limits");
      }

      setMinDeposit(data.minDeposit);
      setMinWithdrawal(data.minWithdrawal);
      setMinStake(data.minStake);
      setLimitsSuccess(true);
      setTimeout(() => setLimitsSuccess(false), 3000);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "An error occurred";
      setLimitsError(errMsg);
    } finally {
      setUpdatingLimits(false);
    }
  };

  const updateManipulationMode = async (mode: string) => {
    setUpdatingMode(mode);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manipulation: mode }),
      });
      if (res.ok) {
        const data = await res.json();
        setManipulation(data.manipulation);
        fetchUsers();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingMode(null);
    }
  };

  const handleUserUpdate = async () => {
    if (!editingUser) return;
    setUserActionError("");
    setUserActionSuccess(false);
    setSubmittingUserEdit(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editingUser.id,
          balance: newBalance !== "" ? parseFloat(newBalance) : undefined,
          demoBalance: newDemoBalance !== "" ? parseFloat(newDemoBalance) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update user");
      }

      setUserActionSuccess(true);
      fetchUsers();
      setTimeout(() => {
        setEditingUser(null);
        setNewBalance("");
        setNewDemoBalance("");
        setUserActionSuccess(false);
      }, 1000);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : "An error occurred";
      setUserActionError(errMsg);
    } finally {
      setSubmittingUserEdit(false);
    }
  };

  const toggleUserRole = async (user: AdminUser) => {
    const nextRole = user.role === "admin" ? "user" : "admin";
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          role: nextRole,
        }),
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateUserManipulation = async (userId: string, mode: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          manipulation: mode,
        }),
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const query = searchTerm.toLowerCase();
    return (
      u.email.toLowerCase().includes(query) ||
      (u.name && u.name.toLowerCase().includes(query)) ||
      (u.phone && u.phone.includes(query))
    );
  });

  if (sessionStatus === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0c12] text-white flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#3B82F6] animate-spin mb-4" />
        <p className="text-sm text-gray-400">Loading Control Center...</p>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-[#0a0c12] text-white flex flex-col items-center justify-center px-6 text-center">
        <AlertTriangle className="w-16 h-16 text-rose-500 mb-4 animate-bounce" />
        <h1 className="text-2xl font-black tracking-tight mb-2 text-white">ACCESS DENIED</h1>
        <p className="text-sm text-gray-400 max-w-sm mb-6">
          You do not have the required administrative credentials to access this console.
        </p>
        <button
          onClick={() => router.push("/trade")}
          className="px-5 py-2.5 rounded-xl bg-[#3B82F6] text-white text-sm font-semibold hover:bg-blue-500 transition"
        >
          Return to Trade Room
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0c12] text-white selection:bg-[#3B82F6]/30">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 h-16 border-b border-white/[0.07] sticky top-0 bg-[#0a0c12]/90 backdrop-blur-xl z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/trade")}
            className="p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
            </div>
            <h1 className="text-sm sm:text-base font-extrabold tracking-tight">Admin Control Center</h1>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Target Environment</span>
          <span className="text-xs text-[#3B82F6] font-bold">Live Production</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        
        {/* STATS SECTION */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          <div className="bg-[#0d0f17] border border-white/[0.06] rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
            <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-5">
              <Settings2 className="w-24 h-24 text-white" />
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
              <Settings2 className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Market Control</span>
              <span className={`text-base font-extrabold capitalize ${
                manipulation === "force_win" ? "text-emerald-400" :
                manipulation === "force_loss" ? "text-rose-400" : "text-gray-300"
              }`}>
                {manipulation === "normal" ? "Normal Mode" :
                 manipulation === "force_win" ? "Force Win" : "Force Loss"}
              </span>
            </div>
          </div>

          <div className="bg-[#0d0f17] border border-white/[0.06] rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
            <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-5">
              <TrendingUp className="w-24 h-24 text-white" />
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Active Market Trades</span>
              <span className="text-base font-extrabold text-white tabular-nums">
                {loadingTrades ? "..." : activeTrades.length} Positions
              </span>
            </div>
          </div>

          <div className="bg-[#0d0f17] border border-white/[0.06] rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
            <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-5">
              <Users className="w-24 h-24 text-white" />
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Registered Accounts</span>
              <span className="text-base font-extrabold text-white tabular-nums">
                {loadingUsers ? "..." : users.length} Users
              </span>
            </div>
          </div>

        </section>

        {/* MARKET MANIPULATION SELECTOR */}
        <section className="bg-[#0d0f17] border border-white/[0.07] rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">Market Manipulation Engine</h2>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed max-w-2xl">
            Inject a custom settlement override for all upcoming trade expirations. Forced modes guarantee that users win or lose, dynamically shifting closing prices to maintain mathematical alignment.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            
            {/* NORMAL MODE CARD */}
            <button
              onClick={() => updateManipulationMode("normal")}
              disabled={updatingMode !== null}
              className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between h-28 relative ${
                manipulation === "normal"
                  ? "bg-white/[0.03] border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                  : "bg-white/[0.01] border-white/[0.05] hover:border-white/10 hover:bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-7 h-7 rounded-lg bg-gray-500/10 border border-gray-500/20 flex items-center justify-center">
                  <RotateCcw className="w-3.5 h-3.5 text-gray-400" />
                </div>
                {updatingMode === "normal" && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                {manipulation === "normal" && !updatingMode && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-[9px] font-bold text-blue-400 uppercase tracking-widest">Active</span>
                )}
              </div>
              <div>
                <span className="text-xs font-bold text-white block mb-0.5">Natural Resolution</span>
                <span className="text-[10px] text-gray-500 leading-tight block">Trades resolve organically based on standard live price ticks.</span>
              </div>
            </button>

            {/* FORCE WIN CARD */}
            <button
              onClick={() => updateManipulationMode("force_win")}
              disabled={updatingMode !== null}
              className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between h-28 relative ${
                manipulation === "force_win"
                  ? "bg-emerald-500/5 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                  : "bg-white/[0.01] border-white/[0.05] hover:border-white/10 hover:bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                {updatingMode === "force_win" && <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />}
                {manipulation === "force_win" && !updatingMode && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Active</span>
                )}
              </div>
              <div>
                <span className="text-xs font-bold text-white block mb-0.5">Force Win Mode</span>
                <span className="text-[10px] text-gray-500 leading-tight block">All expirations settle as WIN, auto-adjusting close prices to match.</span>
              </div>
            </button>

            {/* FORCE LOSS CARD */}
            <button
              onClick={() => updateManipulationMode("force_loss")}
              disabled={updatingMode !== null}
              className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between h-28 relative ${
                manipulation === "force_loss"
                  ? "bg-rose-500/5 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.15)]"
                  : "bg-white/[0.01] border-white/[0.05] hover:border-white/10 hover:bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                </div>
                {updatingMode === "force_loss" && <Loader2 className="w-4 h-4 text-rose-400 animate-spin" />}
                {manipulation === "force_loss" && !updatingMode && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-[9px] font-bold text-rose-400 uppercase tracking-widest">Active</span>
                )}
              </div>
              <div>
                <span className="text-xs font-bold text-white block mb-0.5">Force Loss Mode</span>
                <span className="text-[10px] text-gray-500 leading-tight block">All expirations settle as LOSS, auto-adjusting close prices to match.</span>
              </div>
            </button>

          </div>
        </section>

        {/* FINANCIAL LIMITS CONFIGURATION */}
        <section className="bg-[#0d0f17] border border-white/[0.07] rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">Financial Limits Configuration</h2>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed max-w-2xl">
            Configure the minimum amounts required for user deposits and withdrawals. Changes apply immediately to all clients.
          </p>

          <form onSubmit={handleUpdateLimits} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end pt-2">
            <div>
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5">
                Minimum Deposit (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={inputMinDeposit}
                  onChange={(e) => setInputMinDeposit(e.target.value)}
                  className="w-full bg-[#13161e] border border-white/[0.07] rounded-xl pl-7 pr-3 py-2.5 text-xs text-white outline-none focus:border-blue-500/50"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5">
                Minimum Withdrawal (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={inputMinWithdrawal}
                  onChange={(e) => setInputMinWithdrawal(e.target.value)}
                  className="w-full bg-[#13161e] border border-white/[0.07] rounded-xl pl-7 pr-3 py-2.5 text-xs text-white outline-none focus:border-blue-500/50"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5">
                Minimum Stake (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={inputMinStake}
                  onChange={(e) => setInputMinStake(e.target.value)}
                  className="w-full bg-[#13161e] border border-white/[0.07] rounded-xl pl-7 pr-3 py-2.5 text-xs text-white outline-none focus:border-blue-500/50"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={updatingLimits}
                className="w-full h-10 rounded-xl bg-[#3B82F6] hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                {updatingLimits && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Financial Limits
              </button>
            </div>
          </form>

          {limitsError && (
            <p className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 max-w-sm">
              {limitsError}
            </p>
          )}

          {limitsSuccess && (
            <p className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 max-w-sm">
              Limits updated successfully!
            </p>
          )}
        </section>

        {/* DETAILS SECTION WITH TAB SELECTOR */}
        <section className="bg-[#0d0f17] border border-white/[0.07] rounded-3xl overflow-hidden flex flex-col">
          
          {/* Tabs */}
          <div className="flex border-b border-white/[0.07] bg-[#0a0c12]">
            <button
              onClick={() => setActiveTab("trades")}
              className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
                activeTab === "trades"
                  ? "border-[#3B82F6] text-white"
                  : "border-transparent text-gray-500 hover:text-gray-400"
              }`}
            >
              Live Positions Monitor ({activeTrades.length})
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
                activeTab === "users"
                  ? "border-[#3B82F6] text-white"
                  : "border-transparent text-gray-500 hover:text-gray-400"
              }`}
            >
              Account Database ({users.length})
            </button>
            <button
              onClick={() => setActiveTab("deposits")}
              className={`flex-1 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
                activeTab === "deposits"
                  ? "border-[#3B82F6] text-white"
                  : "border-transparent text-gray-500 hover:text-gray-400"
              }`}
            >
              Deposits Log ({deposits.length})
            </button>
          </div>

          <div className="p-4 sm:p-6 min-h-[300px]">
            
            {/* TRADES TAB */}
            {activeTab === "trades" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Currently active open positions</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-[10px] text-gray-400 font-semibold">Live polling active</span>
                  </div>
                </div>

                {loadingTrades && activeTrades.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center">
                    <Loader2 className="w-6 h-6 text-gray-600 animate-spin mb-2" />
                    <p className="text-xs text-gray-500">Querying live trades...</p>
                  </div>
                ) : activeTrades.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 text-xs">
                    No active positions in the market currently.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/[0.05] text-gray-500 font-bold">
                          <th className="pb-3 pr-2">User / Account</th>
                          <th className="pb-3 px-2">Asset</th>
                          <th className="pb-3 px-2">Type</th>
                          <th className="pb-3 px-2">Direction</th>
                          <th className="pb-3 px-2 text-right">Stake</th>
                          <th className="pb-3 px-2 text-right">Payout</th>
                          <th className="pb-3 px-2 text-right">Open Price</th>
                          <th className="pb-3 pl-2 text-right">Expires In</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeTrades.map((t) => {
                          const expiryMs = new Date(t.expiresAt).getTime();
                          const secondsLeft = Math.max(0, Math.ceil((expiryMs - Date.now()) / 1000));
                          return (
                            <tr key={t.id} className="border-b border-white/[0.04] hover:bg-white/[0.01]">
                              <td className="py-3 pr-2 font-medium max-w-[150px] truncate" title={t.user.email}>
                                <span className="block text-white truncate">{t.user.name || "Trader"}</span>
                                <span className="text-[10px] text-gray-500 truncate block">{t.user.email}</span>
                              </td>
                              <td className="py-3 px-2 text-gray-300 font-semibold">{t.assetName}</td>
                              <td className="py-3 px-2 text-gray-400">{t.contractType}</td>
                              <td className="py-3 px-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                  t.direction === "up"
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                }`}>
                                  {t.direction}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-right font-medium text-white tabular-nums">${t.stake.toFixed(2)}</td>
                              <td className="py-3 px-2 text-right font-medium text-[#3B82F6] tabular-nums">${t.payout.toFixed(2)}</td>
                              <td className="py-3 px-2 text-right font-medium text-gray-400 tabular-nums">{t.openPrice.toFixed(2)}</td>
                              <td className="py-3 pl-2 text-right font-semibold tabular-nums text-amber-400">
                                {secondsLeft}s
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* USERS TAB */}
            {activeTab === "users" && (
              <div className="space-y-4">
                
                {/* Search / Filter bar */}
                <div className="flex items-center gap-3 bg-[#141822] border border-white/[0.07] rounded-xl px-3.5 py-1.5">
                  <Search className="w-4 h-4 text-gray-500 shrink-0" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search accounts by email, name, phone..."
                    className="w-full bg-transparent border-none text-xs text-white outline-none placeholder:text-gray-600 h-9"
                  />
                </div>

                {loadingUsers && users.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center">
                    <Loader2 className="w-6 h-6 text-gray-600 animate-spin mb-2" />
                    <p className="text-xs text-gray-500">Querying accounts...</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 text-xs">
                    No matching users found in the database.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/[0.05] text-gray-500 font-bold">
                          <th className="pb-3 pr-2">Identity</th>
                          <th className="pb-3 px-2">Access Role</th>
                          <th className="pb-3 px-2 text-right">Real Balance</th>
                          <th className="pb-3 px-2 text-right">Demo Balance</th>
                          <th className="pb-3 px-2">Outcome Control</th>
                          <th className="pb-3 px-2">Signed Up</th>
                          <th className="pb-3 pl-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((u) => (
                          <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.01]">
                            <td className="py-3 pr-2 max-w-[180px] truncate">
                              <span className="block text-white truncate font-semibold">{u.name || "Anonymous"}</span>
                              <span className="text-[10px] text-gray-500 truncate block">{u.email}</span>
                              {u.phone && <span className="text-[9px] text-gray-600 truncate block">{u.phone}</span>}
                            </td>
                            <td className="py-3 px-2">
                              <button
                                onClick={() => toggleUserRole(u)}
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition ${
                                  u.role === "admin"
                                    ? "bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20"
                                    : "bg-gray-500/10 text-gray-400 border border-white/5 hover:bg-white/5"
                                }`}
                              >
                                {u.role}
                              </button>
                            </td>
                            <td className="py-3 px-2 text-right font-medium text-emerald-400 tabular-nums">
                              ${u.balance.toFixed(2)}
                            </td>
                            <td className="py-3 px-2 text-right font-medium text-[#3B82F6] tabular-nums">
                              ${u.demoBalance.toFixed(2)}
                            </td>
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => updateUserManipulation(u.id, "normal")}
                                  className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition ${
                                    u.manipulation === "normal"
                                      ? "bg-gray-500/25 text-gray-300 border border-gray-500/40"
                                      : "bg-white/5 text-gray-500 border border-transparent hover:bg-white/10"
                                  }`}
                                >
                                  Normal
                                </button>
                                <button
                                  onClick={() => updateUserManipulation(u.id, "force_win")}
                                  className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition ${
                                    u.manipulation === "force_win"
                                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                      : "bg-white/5 text-gray-500 border border-transparent hover:bg-white/10"
                                  }`}
                                >
                                  Win
                                </button>
                                <button
                                  onClick={() => updateUserManipulation(u.id, "force_loss")}
                                  className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition ${
                                    u.manipulation === "force_loss"
                                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                                      : "bg-white/5 text-gray-500 border border-transparent hover:bg-white/10"
                                  }`}
                                >
                                  Loss
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-2 text-gray-500">
                              {new Date(u.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 pl-2 text-right">
                              <button
                                onClick={() => {
                                  setEditingUser(u);
                                  setNewBalance(u.balance.toString());
                                  setNewDemoBalance(u.demoBalance.toString());
                                  setUserActionError("");
                                  setUserActionSuccess(false);
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold text-[10px] transition"
                              >
                                Adjust Balance
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* DEPOSITS TAB */}
            {activeTab === "deposits" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Historical records of all deposits</span>
                </div>

                {loadingDeposits && deposits.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center">
                    <Loader2 className="w-6 h-6 text-gray-600 animate-spin mb-2" />
                    <p className="text-xs text-gray-500">Querying deposits...</p>
                  </div>
                ) : deposits.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 text-xs">
                    No deposits found in the database.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/[0.05] text-gray-500 font-bold">
                          <th className="pb-3 pr-2">User / Account</th>
                          <th className="pb-3 px-2">Method</th>
                          <th className="pb-3 px-2 text-right">Amount (USD)</th>
                          <th className="pb-3 px-2">Status</th>
                          <th className="pb-3 pl-2 text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deposits.map((d) => (
                          <tr key={d.id} className="border-b border-white/[0.04] hover:bg-white/[0.01]">
                            <td className="py-3 pr-2 font-medium max-w-[150px] truncate" title={d.user.email}>
                              <span className="block text-white truncate">{d.user.name || "Trader"}</span>
                              <span className="text-[10px] text-gray-500 truncate block">{d.user.email}</span>
                            </td>
                            <td className="py-3 px-2 text-gray-400 capitalize">{d.method}</td>
                            <td className="py-3 px-2 text-right font-medium text-emerald-400 tabular-nums">${d.amount.toFixed(2)}</td>
                            <td className="py-3 px-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                d.status === "completed"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : d.status === "failed"
                                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              }`}>
                                {d.status}
                              </span>
                            </td>
                            <td className="py-3 pl-2 text-right text-gray-500">
                              {new Date(d.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

          </div>
        </section>

      </main>

      {/* USER ADJUSTMENT DIALOG (Modal) */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#0d0f17] border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative">
            
            <div className="px-5 py-4 border-b border-white/[0.07] bg-[#0d0f17]">
              <h3 className="text-sm font-bold text-white">Adjust Account Balance</h3>
              <p className="text-[10px] text-gray-500 truncate mt-0.5">{editingUser.email}</p>
            </div>

            <div className="p-5 space-y-4">
              
              <div>
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5">
                  Real Money Balance (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={newBalance}
                    onChange={(e) => setNewBalance(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#141822] border border-white/[0.08] rounded-xl pl-7 pr-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5">
                  Demo Trading Balance (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={newDemoBalance}
                    onChange={(e) => setNewDemoBalance(e.target.value)}
                    placeholder="10000.00"
                    className="w-full bg-[#141822] border border-white/[0.08] rounded-xl pl-7 pr-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>

              {userActionError && (
                <p className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  {userActionError}
                </p>
              )}

              {userActionSuccess && (
                <p className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                  User balances updated successfully!
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setEditingUser(null)}
                  disabled={submittingUserEdit}
                  className="flex-1 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUserUpdate}
                  disabled={submittingUserEdit}
                  className="flex-1 h-10 rounded-xl bg-[#3B82F6] hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  {submittingUserEdit && <Loader2 className="w-3 h-3 animate-spin" />}
                  Save Changes
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
