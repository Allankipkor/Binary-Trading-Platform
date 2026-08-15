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
  Smartphone,
  Bitcoin,
  CreditCard,
  Eye,
  EyeOff,
  Save,
  Check,
  Wallet,
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

interface AdminGateway {
  id: "mpesa" | "crypto" | "card";
  name: string;
  enabled: boolean;
  minDeposit: number | null;
  maxDeposit: number | null;
  config: string | null;
  instructions: string | null;
  parsedConfig: {
    // M-Pesa
    username?: string;
    password?: string;
    channelId?: string;
    usdToKes?: number;
    callbackUrl?: string;
    // Crypto
    address?: string;
    network?: string;
    tronGridApiKey?: string;
    autoConfirm?: boolean;
    // PayPal / Card
    clientId?: string;
    clientSecret?: string;
    payeeEmail?: string;
    env?: "sandbox" | "live";
  };
}

export default function AdminPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  
  // State
  const [manipulation, setManipulation] = useState<string>("normal");
  const [activeTrades, setActiveTrades] = useState<AdminTrade[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [, setLoadingSettings] = useState(true);
  const [loadingTrades, setLoadingTrades] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [updatingMode, setUpdatingMode] = useState<string | null>(null);

  // Limits settings state
  const [globalMinDeposit, setMinDeposit] = useState<number>(5);
  const [, setMinWithdrawal] = useState<number>(100);
  const [, setMinStake] = useState<number>(5);
  const [inputMinDeposit, setInputMinDeposit] = useState<string>("5");
  const [inputMinWithdrawal, setInputMinWithdrawal] = useState<string>("100");
  const [inputMinStake, setInputMinStake] = useState<string>("5");
  const [updatingLimits, setUpdatingLimits] = useState(false);
  const [limitsSuccess, setLimitsSuccess] = useState(false);
  const [limitsError, setLimitsError] = useState("");

  // Deposits log state
  const [deposits, setDeposits] = useState<AdminDeposit[]>([]);
  const [loadingDeposits, setLoadingDeposits] = useState(true);

  // Gateways state
  const [gateways, setGateways] = useState<AdminGateway[]>([]);
  const [loadingGateways, setLoadingGateways] = useState(true);
  const [savingGatewayId, setSavingGatewayId] = useState<string | null>(null);
  const [gatewaySuccess, setGatewaySuccess] = useState<Record<string, boolean>>({});
  const [gatewayErrors, setGatewayErrors] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  
  // Search & Edit User states
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [newBalance, setNewBalance] = useState("");
  const [newDemoBalance, setNewDemoBalance] = useState("");
  const [userActionError, setUserActionError] = useState("");
  const [userActionSuccess, setUserActionSuccess] = useState(false);
  const [submittingUserEdit, setSubmittingUserEdit] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<"trades" | "users" | "deposits" | "gateways">("trades");

  // Auth checking
  const isAuthenticated = !!session?.user;
  const isAdmin = session?.user?.role === "admin";

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (!isAuthenticated || !isAdmin) {
      return;
    }

    fetchSettings();
    fetchTrades();
    fetchUsers();
    fetchDeposits();
    fetchGateways();

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

  const fetchGateways = async () => {
    try {
      const res = await fetch("/api/admin/gateways");
      if (res.ok) {
        const data = await res.json();
        setGateways(data.gateways || []);
      }
    } catch (e) {
      console.error("Failed to fetch gateways:", e);
    } finally {
      setLoadingGateways(false);
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

  const handleGatewayChange = (
    id: string,
    field: string,
    value: string | number | boolean | null,
    isConfigField = false
  ) => {
    setGateways((prev) =>
      prev.map((gw) => {
        if (gw.id !== id) return gw;
        if (isConfigField) {
          return {
            ...gw,
            parsedConfig: {
              ...gw.parsedConfig,
              [field]: value,
            },
          };
        }
        return {
          ...gw,
          [field]: value,
        };
      })
    );
  };

  const saveGateway = async (gw: AdminGateway) => {
    setSavingGatewayId(gw.id);
    setGatewayErrors((prev) => ({ ...prev, [gw.id]: "" }));
    setGatewaySuccess((prev) => ({ ...prev, [gw.id]: false }));

    try {
      const res = await fetch("/api/admin/gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: gw.id,
          name: gw.name,
          enabled: gw.enabled,
          minDeposit: gw.minDeposit !== null && gw.minDeposit !== undefined ? Number(gw.minDeposit) : null,
          maxDeposit: gw.maxDeposit !== null && gw.maxDeposit !== undefined ? Number(gw.maxDeposit) : null,
          instructions: gw.instructions,
          config: gw.parsedConfig,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save gateway settings");
      }

      setGatewaySuccess((prev) => ({ ...prev, [gw.id]: true }));
      setTimeout(() => {
        setGatewaySuccess((prev) => ({ ...prev, [gw.id]: false }));
      }, 3000);

      // Refresh list to stay synced
      fetchGateways();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update gateway";
      setGatewayErrors((prev) => ({ ...prev, [gw.id]: msg }));
    } finally {
      setSavingGatewayId(null);
    }
  };

  const toggleGatewayEnabled = async (gw: AdminGateway) => {
    const nextState = !gw.enabled;
    handleGatewayChange(gw.id, "enabled", nextState);

    try {
      await fetch("/api/admin/gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: gw.id,
          enabled: nextState,
        }),
      });
      fetchGateways();
    } catch (err) {
      console.error("Failed to toggle gateway status:", err);
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
        <section className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          
          <div className="bg-[#0d0f17] border border-white/[0.06] rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
              <Settings2 className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Market Control</span>
              <span className={`text-sm font-extrabold capitalize ${
                manipulation === "force_win" ? "text-emerald-400" :
                manipulation === "force_loss" ? "text-rose-400" : "text-gray-300"
              }`}>
                {manipulation === "normal" ? "Normal Mode" :
                 manipulation === "force_win" ? "Force Win" : "Force Loss"}
              </span>
            </div>
          </div>

          <div className="bg-[#0d0f17] border border-white/[0.06] rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Active Market Trades</span>
              <span className="text-sm font-extrabold text-white tabular-nums">
                {loadingTrades ? "..." : activeTrades.length} Positions
              </span>
            </div>
          </div>

          <div className="bg-[#0d0f17] border border-white/[0.06] rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Registered Accounts</span>
              <span className="text-sm font-extrabold text-white tabular-nums">
                {loadingUsers ? "..." : users.length} Users
              </span>
            </div>
          </div>

          <div className="bg-[#0d0f17] border border-white/[0.06] rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Payment Gateways</span>
              <span className="text-sm font-extrabold text-white tabular-nums">
                {gateways.filter((g) => g.enabled).length} of {gateways.length} Active
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
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">Global Financial Limits</h2>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed max-w-2xl">
            Configure the baseline global minimum amounts for trades, deposits, and withdrawals. Gateways can optionally have custom minimum deposit thresholds configured below.
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
                Minimum Trade Stake (USD)
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
          <div className="flex border-b border-white/[0.07] bg-[#0a0c12] overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab("gateways")}
              className={`flex-1 min-w-[150px] py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition flex items-center justify-center gap-2 ${
                activeTab === "gateways"
                  ? "border-[#3B82F6] text-white bg-white/[0.02]"
                  : "border-transparent text-gray-500 hover:text-gray-400"
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              Payment Gateways ({gateways.length})
            </button>
            <button
              onClick={() => setActiveTab("trades")}
              className={`flex-1 min-w-[150px] py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition flex items-center justify-center gap-2 ${
                activeTab === "trades"
                  ? "border-[#3B82F6] text-white bg-white/[0.02]"
                  : "border-transparent text-gray-500 hover:text-gray-400"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Positions Monitor ({activeTrades.length})
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`flex-1 min-w-[150px] py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition flex items-center justify-center gap-2 ${
                activeTab === "users"
                  ? "border-[#3B82F6] text-white bg-white/[0.02]"
                  : "border-transparent text-gray-500 hover:text-gray-400"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Account Database ({users.length})
            </button>
            <button
              onClick={() => setActiveTab("deposits")}
              className={`flex-1 min-w-[150px] py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition flex items-center justify-center gap-2 ${
                activeTab === "deposits"
                  ? "border-[#3B82F6] text-white bg-white/[0.02]"
                  : "border-transparent text-gray-500 hover:text-gray-400"
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              Deposits Log ({deposits.length})
            </button>
          </div>

          <div className="p-4 sm:p-6 min-h-[300px]">
            
            {/* PAYMENT GATEWAYS TAB */}
            {activeTab === "gateways" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.05] pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">Payment Gateway Management</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Enable or disable payment methods, edit live API credentials, and set gateway-specific minimum deposit limits.
                    </p>
                  </div>
                  <button
                    onClick={fetchGateways}
                    disabled={loadingGateways}
                    className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 font-semibold transition flex items-center gap-1.5"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${loadingGateways ? "animate-spin" : ""}`} />
                    Refresh Gateways
                  </button>
                </div>

                {loadingGateways && gateways.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center">
                    <Loader2 className="w-6 h-6 text-gray-600 animate-spin mb-2" />
                    <p className="text-xs text-gray-500">Loading payment gateways...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    {gateways.map((gw) => {
                      const isSaving = savingGatewayId === gw.id;
                      const hasSuccess = gatewaySuccess[gw.id];
                      const errorMsg = gatewayErrors[gw.id];
                      const showSecret = showSecrets[gw.id];

                      return (
                        <div
                          key={gw.id}
                          className={`rounded-2xl border transition overflow-hidden ${
                            gw.enabled
                              ? "bg-[#111420] border-white/[0.08]"
                              : "bg-[#0f1118]/80 border-white/[0.04] opacity-85"
                          }`}
                        >
                          {/* Gateway Header */}
                          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.05] bg-white/[0.01]">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                                gw.id === "mpesa"
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                  : gw.id === "crypto"
                                  ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                  : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                              }`}>
                                {gw.id === "mpesa" ? (
                                  <Smartphone className="w-5 h-5" />
                                ) : gw.id === "crypto" ? (
                                  <Bitcoin className="w-5 h-5" />
                                ) : (
                                  <CreditCard className="w-5 h-5" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-bold text-white">{gw.name}</h4>
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                    gw.enabled
                                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                      : "bg-gray-500/15 text-gray-400 border border-white/10"
                                  }`}>
                                    {gw.enabled ? "Active" : "Disabled"}
                                  </span>
                                </div>
                                <span className="text-[11px] text-gray-500">ID: {gw.id}</span>
                              </div>
                            </div>

                            {/* Enable/Disable Switch */}
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-400 font-semibold">
                                {gw.enabled ? "Gateway Active" : "Gateway Offline"}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleGatewayEnabled(gw)}
                                className={`w-12 h-6 rounded-full relative transition-colors focus:outline-none ${
                                  gw.enabled ? "bg-emerald-500" : "bg-white/15"
                                }`}
                              >
                                <span
                                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                                    gw.enabled ? "left-7" : "left-1"
                                  }`}
                                />
                              </button>
                            </div>
                          </div>

                          {/* Gateway Config Form */}
                          <div className="p-4 sm:p-5 space-y-4">
                            
                            {/* Limits Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2 border-b border-white/[0.04]">
                              <div>
                                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                                  Custom Min Deposit (USD)
                                </label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder={`Default ($${globalMinDeposit.toFixed(2)})`}
                                    value={gw.minDeposit !== null && gw.minDeposit !== undefined ? gw.minDeposit : ""}
                                    onChange={(e) =>
                                      handleGatewayChange(
                                        gw.id,
                                        "minDeposit",
                                        e.target.value === "" ? null : parseFloat(e.target.value)
                                      )
                                    }
                                    className="w-full bg-[#141822] border border-white/[0.07] rounded-xl pl-7 pr-3 py-2 text-xs text-white outline-none focus:border-blue-500/50"
                                  />
                                </div>
                                <span className="text-[10px] text-gray-500 mt-1 block">Leave blank to use global min deposit.</span>
                              </div>

                              <div>
                                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                                  Max Deposit Limit (USD)
                                </label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="e.g. 50000"
                                    value={gw.maxDeposit !== null && gw.maxDeposit !== undefined ? gw.maxDeposit : ""}
                                    onChange={(e) =>
                                      handleGatewayChange(
                                        gw.id,
                                        "maxDeposit",
                                        e.target.value === "" ? null : parseFloat(e.target.value)
                                      )
                                    }
                                    className="w-full bg-[#141822] border border-white/[0.07] rounded-xl pl-7 pr-3 py-2 text-xs text-white outline-none focus:border-blue-500/50"
                                  />
                                </div>
                                <span className="text-[10px] text-gray-500 mt-1 block">Maximum single deposit transaction limit.</span>
                              </div>
                            </div>

                            {/* Specific Fields: M-Pesa */}
                            {gw.id === "mpesa" && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                  <div>
                                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                                      PayHero Username / API Key
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="PayHero Username"
                                      value={gw.parsedConfig.username || ""}
                                      onChange={(e) => handleGatewayChange(gw.id, "username", e.target.value, true)}
                                      className="w-full bg-[#141822] border border-white/[0.07] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50"
                                    />
                                  </div>

                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                                        PayHero Password / Secret
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => setShowSecrets((prev) => ({ ...prev, [gw.id]: !showSecret }))}
                                        className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1"
                                      >
                                        {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                        {showSecret ? "Hide" : "Show"}
                                      </button>
                                    </div>
                                    <input
                                      type={showSecret ? "text" : "password"}
                                      placeholder="PayHero API Password"
                                      value={gw.parsedConfig.password || ""}
                                      onChange={(e) => handleGatewayChange(gw.id, "password", e.target.value, true)}
                                      className="w-full bg-[#141822] border border-white/[0.07] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50"
                                    />
                                  </div>

                                  <div>
                                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                                      Channel ID
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="e.g. 523"
                                      value={gw.parsedConfig.channelId || ""}
                                      onChange={(e) => handleGatewayChange(gw.id, "channelId", e.target.value, true)}
                                      className="w-full bg-[#141822] border border-white/[0.07] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50"
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                                      USD to KES Exchange Rate
                                    </label>
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs">KES</span>
                                      <input
                                        type="number"
                                        step="0.1"
                                        placeholder="130"
                                        value={gw.parsedConfig.usdToKes || 130}
                                        onChange={(e) => handleGatewayChange(gw.id, "usdToKes", parseFloat(e.target.value), true)}
                                        className="w-full bg-[#141822] border border-white/[0.07] rounded-xl pl-12 pr-3 py-2 text-xs text-white outline-none focus:border-blue-500/50"
                                      />
                                    </div>
                                    <span className="text-[10px] text-gray-500 mt-1 block">1 USD = {gw.parsedConfig.usdToKes || 130} KES for STK push calculations.</span>
                                  </div>

                                  <div>
                                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                                      M-Pesa Callback URL
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="https://yourdomain.com/api/payments/mpesa/callback"
                                      value={gw.parsedConfig.callbackUrl || ""}
                                      onChange={(e) => handleGatewayChange(gw.id, "callbackUrl", e.target.value, true)}
                                      className="w-full bg-[#141822] border border-white/[0.07] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Specific Fields: Crypto USDT */}
                            {gw.id === "crypto" && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                                      USDT TRC20 Deposit Wallet Address
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="e.g. TTzp475Uc59m3Xx8ADuZfRV133xSRhgp4k"
                                      value={gw.parsedConfig.address || ""}
                                      onChange={(e) => handleGatewayChange(gw.id, "address", e.target.value, true)}
                                      className="w-full bg-[#141822] border border-white/[0.07] rounded-xl px-3 py-2 text-xs text-emerald-400 font-mono outline-none focus:border-blue-500/50"
                                    />
                                  </div>

                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                                        TronGrid API Key (Optional)
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => setShowSecrets((prev) => ({ ...prev, [gw.id]: !showSecret }))}
                                        className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1"
                                      >
                                        {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                        {showSecret ? "Hide" : "Show"}
                                      </button>
                                    </div>
                                    <input
                                      type={showSecret ? "text" : "password"}
                                      placeholder="TronGrid API Key for blockchain lookup"
                                      value={gw.parsedConfig.tronGridApiKey || ""}
                                      onChange={(e) => handleGatewayChange(gw.id, "tronGridApiKey", e.target.value, true)}
                                      className="w-full bg-[#141822] border border-white/[0.07] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50"
                                    />
                                  </div>
                                </div>

                                {/* Auto-confirm Mode Toggle */}
                                <div className="bg-[#141822] border border-white/[0.06] rounded-xl p-3 flex items-center justify-between gap-4">
                                  <div>
                                    <span className="text-xs font-bold text-white block">Auto-Confirm Simulated Mode</span>
                                    <span className="text-[10px] text-gray-400 block">
                                      When enabled, crypto deposits confirm instantly without real on-chain verification (dev/testing mode). Keep OFF for real on-chain blockchain checks.
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleGatewayChange(gw.id, "autoConfirm", !gw.parsedConfig.autoConfirm, true)}
                                    className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${
                                      gw.parsedConfig.autoConfirm ? "bg-amber-500" : "bg-white/20"
                                    }`}
                                  >
                                    <span
                                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                                        gw.parsedConfig.autoConfirm ? "left-6" : "left-1"
                                      }`}
                                    />
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Specific Fields: PayPal / Card */}
                            {gw.id === "card" && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                                      PayPal Client ID
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="PayPal Client ID"
                                      value={gw.parsedConfig.clientId || ""}
                                      onChange={(e) => handleGatewayChange(gw.id, "clientId", e.target.value, true)}
                                      className="w-full bg-[#141822] border border-white/[0.07] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50 font-mono"
                                    />
                                  </div>

                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                                        PayPal Client Secret
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => setShowSecrets((prev) => ({ ...prev, [gw.id]: !showSecret }))}
                                        className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1"
                                      >
                                        {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                        {showSecret ? "Hide" : "Show"}
                                      </button>
                                    </div>
                                    <input
                                      type={showSecret ? "text" : "password"}
                                      placeholder="PayPal Secret Key"
                                      value={gw.parsedConfig.clientSecret || ""}
                                      onChange={(e) => handleGatewayChange(gw.id, "clientSecret", e.target.value, true)}
                                      className="w-full bg-[#141822] border border-white/[0.07] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50 font-mono"
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                                      Payee Merchant Email (Optional Override)
                                    </label>
                                    <input
                                      type="email"
                                      placeholder="e.g. merchant@example.com"
                                      value={gw.parsedConfig.payeeEmail || ""}
                                      onChange={(e) => handleGatewayChange(gw.id, "payeeEmail", e.target.value, true)}
                                      className="w-full bg-[#141822] border border-white/[0.07] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50"
                                    />
                                  </div>

                                  <div>
                                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                                      Environment Mode
                                    </label>
                                    <select
                                      value={gw.parsedConfig.env || "live"}
                                      onChange={(e) => handleGatewayChange(gw.id, "env", e.target.value as "sandbox" | "live", true)}
                                      className="w-full bg-[#141822] border border-white/[0.07] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50"
                                    >
                                      <option value="live">Live Production (Real money)</option>
                                      <option value="sandbox">Sandbox Test Environment</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* User Instructions */}
                            <div>
                              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                                Customer Instructions / Notes (Displayed in Deposit Modal)
                              </label>
                              <textarea
                                rows={2}
                                placeholder="Instructions visible to traders when selecting this method"
                                value={gw.instructions || ""}
                                onChange={(e) => handleGatewayChange(gw.id, "instructions", e.target.value)}
                                className="w-full bg-[#141822] border border-white/[0.07] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500/50 resize-none"
                              />
                            </div>

                            {/* Feedback messages */}
                            {errorMsg && (
                              <p className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                                {errorMsg}
                              </p>
                            )}

                            {hasSuccess && (
                              <p className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 flex items-center gap-1.5">
                                <Check className="w-3.5 h-3.5" />
                                {gw.name} settings saved and updated in live database!
                              </p>
                            )}

                            {/* Action Buttons */}
                            <div className="flex justify-end pt-2">
                              <button
                                type="button"
                                onClick={() => saveGateway(gw)}
                                disabled={isSaving}
                                className="px-5 py-2.5 rounded-xl bg-[#3B82F6] hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-blue-500/10"
                              >
                                {isSaving ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Save className="w-3.5 h-3.5" />
                                )}
                                Save {gw.name} Settings
                              </button>
                            </div>

                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

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
