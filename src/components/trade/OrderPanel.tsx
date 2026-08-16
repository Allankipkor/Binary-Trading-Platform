"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, Square, Zap, XCircle } from "lucide-react";
import type { Asset } from "@/lib/assets";

const CONTRACT_TYPES = ["Even/Odd", "Over/Under", "Match/Differ"] as const;

type ContractType = (typeof CONTRACT_TYPES)[number];

interface OrderPanelProps {
  selectedAsset: Asset;
  contractType: ContractType;
  stake: number;
  balance: number;
  tradeError: string;
  onContractTypeChange: (t: ContractType) => void;
  onStakeChange: (s: number) => void;
  onPlaceTrade: (
    direction: "up" | "down",
    meta?: { digit?: number; contractType?: string; digitDirection?: string }
  ) => Promise<boolean>;
  settledQueue?: { id: string; profit: number }[];
  appliedSignal?: { digit: number; nonce: number } | null;
  compact?: boolean;
  minStake?: number;
}

export function OrderPanel({
  selectedAsset,
  contractType,
  stake,
  balance,
  tradeError,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onContractTypeChange,
  onStakeChange,
  onPlaceTrade,
  settledQueue,
  appliedSignal,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  compact = false,
  minStake = 5.0,
}: OrderPanelProps) {
  const [tradeMode, setTradeMode] = useState<"auto" | "manual">("auto");
  const [selectedDigit, setSelectedDigit] = useState(5);

  // Apply a digit recommended by the AI Entry Scanner whenever a new signal arrives
  useEffect(() => {
    if (appliedSignal) setSelectedDigit(appliedSignal.digit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSignal?.nonce]);

  // Session tracking
  const [sessionPnl, setSessionPnl] = useState(0);
  const [sessionTrades, setSessionTrades] = useState(0);
  const [sessionWins, setSessionWins] = useState(0);
  const processedIdsRef = useRef<Set<string>>(new Set());

  // Auto-mode state
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoDirection, setAutoDirection] = useState<"up" | "down" | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [autoMeta, setAutoMeta] = useState<{ digit?: number; contractType?: string; digitDirection?: string } | undefined>();
  const [liveTrades, setLiveTrades] = useState(0);
  const autoRunningRef = useRef(false);
  const settlementWaiterRef = useRef<(() => void) | null>(null);

  // Insufficient balance popup
  const [showInsufficientPopup, setShowInsufficientPopup] = useState(false);
  useEffect(() => {
    if (!showInsufficientPopup) return;
    const t = setTimeout(() => setShowInsufficientPopup(false), 2500);
    return () => clearTimeout(t);
  }, [showInsufficientPopup]);

  // Tap-to-edit stake amount
  const [editingStake, setEditingStake] = useState(false);
  const [rawStake, setRawStake] = useState("");

  const sessionPnlRef = useRef(sessionPnl);
  useEffect(() => {
    sessionPnlRef.current = sessionPnl;
  }, [sessionPnl]);

  // Applies settled trades to session P&L
  useEffect(() => {
    if (!settledQueue || settledQueue.length === 0) return;
    const unprocessed = settledQueue.filter((s) => !processedIdsRef.current.has(s.id));
    if (unprocessed.length === 0) return;

    for (const settlement of unprocessed) processedIdsRef.current.add(settlement.id);

    let runningPnl = sessionPnlRef.current;
    for (const settlement of unprocessed) {
      runningPnl += settlement.profit;
    }
    runningPnl = +(runningPnl.toFixed(2));

    sessionPnlRef.current = runningPnl;
    setSessionPnl(runningPnl);

    setSessionTrades((prev) => prev + unprocessed.length);
    setSessionWins((prev) => prev + unprocessed.filter((s) => s.profit > 0).length);
    setLiveTrades((n) => Math.max(0, n - unprocessed.length));

    if (settlementWaiterRef.current) {
      const resolve = settlementWaiterRef.current;
      settlementWaiterRef.current = null;
      resolve();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settledQueue]);

  const waitForNextSettlement = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      settlementWaiterRef.current = resolve;
    });
  }, []);

  const runSingleAutoTrade = useCallback(async (
    direction: "up" | "down",
    meta: { digit?: number; contractType?: string; digitDirection?: string } | undefined,
    currentBalance: number,
    currentStake: number,
  ) => {
    autoRunningRef.current = true;
    setAutoRunning(true);
    setLiveTrades(0);

    if (currentStake > currentBalance) {
      autoRunningRef.current = false;
      setAutoRunning(false);
      return;
    }

    const ok = await onPlaceTrade(direction, meta);
    if (!ok) {
      autoRunningRef.current = false;
      setAutoRunning(false);
      return;
    }

    setLiveTrades(1);
    await waitForNextSettlement();

    autoRunningRef.current = false;
    setAutoRunning(false);
    setLiveTrades(0);
  }, [onPlaceTrade, waitForNextSettlement]);

  const handleTrade = (direction: "up" | "down") => {
    if (stake > balance) {
      setShowInsufficientPopup(true);
      return;
    }
    const [upLabel, downLabel] = getLabels();
    const meta = {
      digit: selectedDigit,
      contractType,
      digitDirection: direction === "up" ? upLabel : downLabel,
    };

    if (tradeMode === "auto") {
      if (autoRunningRef.current) return;
      autoRunningRef.current = true;
      setAutoDirection(direction);
      setAutoMeta(meta);
      runSingleAutoTrade(direction, meta, balance, stake);
    } else {
      onPlaceTrade(direction, meta);
    }
  };

  const handleStop = () => {
    autoRunningRef.current = false;
    setAutoRunning(false);
    setLiveTrades(0);
  };

  const getLabels = (): [string, string] => {
    switch (contractType) {
      case "Even/Odd":     return ["Even", "Odd"];
      case "Over/Under":   return ["Over", "Under"];
      case "Match/Differ": return ["Match", "Differ"];
    }
  };

  const getColors = (): [string, string] => {
    switch (contractType) {
      case "Even/Odd":     return ["bg-blue-500 hover:bg-blue-400", "bg-purple-500 hover:bg-purple-400"];
      case "Over/Under":   return ["bg-cyan-500 hover:bg-cyan-400", "bg-orange-500 hover:bg-orange-400"];
      case "Match/Differ": return ["bg-emerald-500 hover:bg-emerald-400", "bg-rose-500 hover:bg-rose-400"];
    }
  };

  const getPayoutSplit = (): { upPct: number; downPct: number } => {
    switch (contractType) {
      case "Match/Differ": return { upPct: 850, downPct: 5 };
      case "Even/Odd":     return { upPct: 95, downPct: 95 };
      case "Over/Under": {
        const overChance = (9 - selectedDigit) / 9 || 0.01;
        const underChance = (selectedDigit + 1) / 9 || 0.01;
        return {
          upPct: Math.min(950, Math.round((1 / overChance) * 95 * 10) / 10),
          downPct: Math.min(950, Math.round((1 / underChance) * 95 * 10) / 10),
        };
      }
    }
  };

  const adjustStake = (delta: number) => {
    const next = Math.round((stake + delta) * 100) / 100;
    onStakeChange(Math.max(minStake, next));
  };

  const commitStake = () => {
    const n = parseFloat(rawStake);
    if (!isNaN(n) && n >= minStake) onStakeChange(Math.round(n * 100) / 100);
    setEditingStake(false);
  };

  const [upLabel, downLabel] = getLabels();
  const [upColor, downColor] = getColors();
  const { upPct, downPct } = getPayoutSplit();
  const upPayout = stake * (1 + upPct / 100);
  const downPayout = stake * (1 + downPct / 100);
  const btnBase = "rounded-xl font-bold text-white text-sm flex items-center justify-center transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-col gap-0 relative">

      {/* ── Auto / Manual ── */}
      <div className="px-2.5 pt-2 pb-1.5 border-b border-white/[0.06]">
        <div className="flex bg-white/[0.04] rounded-xl p-0.5 gap-0.5">
          {(["auto", "manual"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { if (!autoRunningRef.current) setTradeMode(m); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition ${
                tradeMode === m ? "bg-[#3B82F6] text-white shadow" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stake ── */}
      <div className="px-2.5 pt-1.5 pb-1.5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between bg-white/[0.04] rounded-xl px-3 py-1.5 mb-1.5">
          <button onClick={() => adjustStake(-1)} className="w-7 h-7 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] active:scale-95 flex items-center justify-center transition">
            <Minus className="w-3.5 h-3.5 text-gray-200" />
          </button>
          {editingStake ? (
            <div className="flex items-baseline gap-1">
              <span className="text-gray-400 text-sm">$</span>
              <input
                autoFocus
                type="number"
                min={1}
                step={1}
                value={rawStake}
                onChange={(e) => setRawStake(e.target.value)}
                onBlur={commitStake}
                onKeyDown={(e) => { if (e.key === "Enter") commitStake(); if (e.key === "Escape") setEditingStake(false); }}
                className="w-20 bg-transparent text-white text-xl font-bold tabular-nums outline-none border-b-2 border-[#3B82F6] text-center"
              />
            </div>
          ) : (
            <button
              onClick={() => { setRawStake(String(stake)); setEditingStake(true); }}
              className="flex items-baseline gap-1"
            >
              <span className="text-gray-400 text-sm">$</span>
              <span className="text-white text-xl font-bold tabular-nums">{stake}</span>
            </button>
          )}
          <button onClick={() => adjustStake(1)} className="w-7 h-7 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] active:scale-95 flex items-center justify-center transition">
            <Plus className="w-3.5 h-3.5 text-gray-200" />
          </button>
        </div>
        <div className="flex gap-1.5">
          {[minStake, minStake * 2, minStake * 5, minStake * 10, minStake * 20, minStake * 50].map((rawVal) => {
            const s = Math.round(rawVal);
            return (
              <button
                key={s}
                onClick={() => onStakeChange(s)}
                className={`flex-1 py-1 rounded-lg text-[11px] font-bold border transition ${
                  stake === s ? "bg-[#1e3a5f] border-[#3B82F6] text-[#60a5fa]" : "border-white/[0.08] bg-white/[0.03] text-gray-400 hover:bg-white/[0.08]"
                }`}
              >
                ${s}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── LIVE status bar (shown while auto trade is running) ── */}
      {autoRunning && (
        <div className="mx-2.5 mt-1.5 mb-1 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">
              Live {liveTrades}T
            </span>
          </div>
          <span className={`text-xs font-bold tabular-nums ${sessionPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {sessionPnl >= 0 ? "+" : ""}${sessionPnl.toFixed(2)}
          </span>
        </div>
      )}

      {/* ── Digit selector (plain, selectable) ── */}
      <div className="px-2.5 pt-1.5 pb-1.5 border-b border-white/[0.06]">
        <div className="flex justify-between gap-1">
          {Array.from({ length: 10 }, (_, d) => d).map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDigit(d)}
              className={`flex-1 h-7 rounded-lg text-[12px] font-bold transition min-w-0 ${
                d === selectedDigit
                  ? "bg-[#3B82F6] text-white"
                  : "bg-[#141822] text-gray-400 border border-white/[0.07] hover:bg-white/[0.06]"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* ── Session stats ── */}
      <div className="px-2.5 py-1.5 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-gray-500" />
          <span className="text-[10px] text-gray-500">
            Last {sessionTrades}T · {sessionWins}W · {sessionTrades - sessionWins}L
          </span>
        </div>
        <span className={`text-[11px] font-bold ${sessionPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {sessionPnl >= 0 ? "+" : ""}${sessionPnl.toFixed(2)}
        </span>
      </div>

      {/* ── Error ── */}
      {tradeError && (
        <div className="mx-2.5 mt-1.5 text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-1.5 text-center font-medium">
          {tradeError}
        </div>
      )}

      {/* ── Bottom block: payout info + CTA buttons ── */}
      <div>
        {/* ── Payout info ── */}
        <div className="px-2.5 pt-1.5 pb-0.5 flex justify-between text-[11px] text-gray-500">
          <span>{selectedAsset.name.replace(" Index", "")}</span>
          <span className="text-[#3B82F6] font-bold">{selectedAsset.payout}% payout</span>
        </div>

        {/* ── CTA buttons or STOP button ── */}
        <div className="px-2.5 pb-2 pt-1.5 grid grid-cols-2 gap-2">
          {autoRunning ? (
            <>
              <button disabled className={`${btnBase} ${upColor} flex-col gap-0.5 h-14 opacity-40`}>
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-white/20 text-[11px] font-bold flex items-center justify-center">{selectedDigit}</span>
                  <span>{autoDirection === "up" ? upLabel : downLabel}</span>
                </div>
                <div className="text-[10px] font-semibold opacity-80">Running…</div>
              </button>
              <button
                onClick={handleStop}
                className="h-14 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 active:scale-95 transition"
              >
                <Square className="w-4 h-4 fill-white" />
                STOP
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleTrade("up")}
                className={`${btnBase} ${upColor} flex-col gap-0.5 h-14`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-white/20 text-[11px] font-bold flex items-center justify-center">{selectedDigit}</span>
                  <span>{upLabel}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold opacity-90">
                  <span>Payout ${upPayout.toFixed(2)}</span>
                  <span>{upPct.toFixed(1)}%</span>
                </div>
              </button>
              <button
                onClick={() => handleTrade("down")}
                className={`${btnBase} ${downColor} flex-col gap-0.5 h-14`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-white/20 text-[11px] font-bold flex items-center justify-center">{selectedDigit}</span>
                  <span>{downLabel}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold opacity-90">
                  <span>Payout ${downPayout.toFixed(2)}</span>
                  <span>{downPct.toFixed(1)}%</span>
                </div>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Insufficient balance popup ── */}
      {showInsufficientPopup && (
        <div className="sticky bottom-3 left-3 right-3 z-50 mx-2.5">
          <div className="bg-rose-500/95 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-2.5">
            <XCircle className="w-5 h-5 text-white shrink-0" />
            <div className="flex-1">
              <p className="text-white text-sm font-bold">Insufficient balance</p>
              <p className="text-white/80 text-[11px]">
                Need ${stake.toFixed(2)} but only ${balance.toFixed(2)} available
              </p>
            </div>
            <button onClick={() => setShowInsufficientPopup(false)} className="text-white/70 hover:text-white">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { CONTRACT_TYPES };
export type { ContractType };