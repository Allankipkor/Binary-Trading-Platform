"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";

export default function CheckDepositPage() {
  const router = useRouter();
  const [transactionId, setTransactionId] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ status: string; amount?: number; balance?: number } | null>(null);
  const [error, setError] = useState("");

  const handleCheck = async () => {
    if (!transactionId.trim()) {
      setError("Paste the transaction ID to check");
      return;
    }
    setChecking(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`/api/payments/status/${transactionId.trim()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not check status");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check status");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c12] text-white">
      <header className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.07] sticky top-0 bg-[#0a0c12]/95 backdrop-blur z-10">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-white/5">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold">Check Deposit Status</h1>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        <p className="text-sm text-gray-400">
          If a deposit is stuck on &quot;pending&quot; longer than expected, paste its transaction ID below to force a fresh check against the payment provider.
        </p>

        <div className="bg-[#0d0f17] border border-white/[0.07] rounded-2xl p-4 space-y-3">
          <input
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            placeholder="Transaction ID (from your history)"
            className="w-full bg-[#141822] border border-white/[0.08] rounded-xl px-3.5 py-3 text-sm text-white outline-none focus:border-[#3B82F6]/50"
          />
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <button
            onClick={handleCheck}
            disabled={checking}
            className="w-full h-11 rounded-xl bg-[#3B82F6] hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 transition"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Checking…" : "Check status"}
          </button>
        </div>

        {result && (
          <div className={`rounded-2xl p-4 border flex items-start gap-3 ${
            result.status === "completed" ? "bg-emerald-500/10 border-emerald-500/25" :
            result.status === "failed" ? "bg-rose-500/10 border-rose-500/25" :
            "bg-amber-500/10 border-amber-500/25"
          }`}>
            {result.status === "completed" ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" /> :
             result.status === "failed" ? <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" /> :
             <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
            <div>
              <p className="text-sm font-bold text-white capitalize">{result.status}</p>
              {result.amount !== undefined && (
                <p className="text-xs text-gray-400 mt-0.5">Amount: ${result.amount.toFixed(2)}</p>
              )}
              {result.status === "completed" && result.balance !== undefined && (
                <p className="text-xs text-emerald-400 mt-1">New balance: ${result.balance.toFixed(2)}</p>
              )}
              {result.status === "pending" && (
                <p className="text-xs text-gray-500 mt-1">
                  Still pending on the provider&apos;s side. Try again in a minute.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}