"use client";

import { useEffect, useState } from "react";
import { Minus, Plus, Zap, XCircle, CheckCircle2 } from "lucide-react";
import type { Asset } from "@/lib/assets";

const CONTRACT_TYPES = ["Rise/Fall", "Even/Odd", "Over/Under", "Match/Differ"] as const;
const DURATIONS = ["1 min", "2 min", "5 min", "10 min", "15 min"];
const STAKE_PRESETS = [1, 5, 10, 25, 50, 100];
const DIGIT_BASE = [1.7, 9.3, 8.0, 9.0, 14.0, 13.0, 10.0, 13.6, 12.3, 9.3];
const MULTIPLIER_OPTIONS = [2, 3, 5, 10, 20, 50, 100];

type ContractType = (typeof CONTRACT_TYPES)[number];

interface OrderPanelProps {
  selectedAsset: Asset;
  contractType: ContractType;
  duration: string;
  stake: number;
  balance: number;
  tradeError: string;
  onContractTypeChange: (t: ContractType) => void;
  onDurationChange: (d: string) => void;
  onStakeChange: (s: number) => void;
  onPlaceTrade: (
    direction: "up" | "down",
    meta?: { digit?: number; contractType?: string; digitDirection?: string }
  ) => void;
  /** Net profit/loss of the most recently settled trade, so OrderPanel can track session P&L */
  lastSettledProfit?: { id: string; profit: number } | null;
  compact?: boolean;
}

function generateDigitProbs(): number[] {
  return DIGIT_BASE.map((base) =>
    Math.max(0, Math.min(25, +(base + (Math.random() - 0.5) * 1.5).toFixed(1)))
  );
}

// Reusable adjustable number field (Target profit / Stop loss)
function AdjustField({
  label,
  value,
  onChange,
  color,
  enabled,
  onToggle,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: "text-emerald-400" | "text-red-400";
  enabled?: boolean;
  onToggle?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");

  const step = value >= 1000 ? 100 : value >= 100 ? 10 : 1;
  const adjust = (delta: number) => onChange(Math.max(1, value + delta * step));

  const commit = () => {
    const n = parseFloat(raw);
    if (!isNaN(n) && n >= 1) onChange(Math.round(n));
    setEditing(false);
  };

  const borderColor = color === "text-emerald-400" ? "border-emerald-500" : "border-red-500";
  const dotColor = color === "text-emerald-400" ? "bg-emerald-500" : "bg-red-500";

  return (
    <div className="bg-[#1c2030] rounded-2xl p-3 border border-white/[0.06]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-gray-500 font-semibold">{label}</span>
        {onToggle !== undefined && (
          <button
            onClick={onToggle}
            className={`w-8 h-4 rounded-full relative transition-colors ${enabled ? dotColor : "bg-white/20"}`}
          >
            <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${enabled ? "left-4" : "left-0.5"}`} />
          </button>
        )}
      </div>

      {editing ? (
        <input
          autoFocus
          type="number"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          className={`w-full bg-transparent ${color} text-lg font-bold tabular-nums outline-none border-b-2 ${borderColor} pb-0.5 mb-2`}
        />
      ) : (
        <button
          onClick={() => { setRaw(String(value)); setEditing(true); }}
          className={`w-full text-left ${color} text-lg font-bold tabular-nums mb-2 ${enabled === false ? "opacity-30" : ""}`}
        >
          ${value.toLocaleString()}
        </button>
      )}

      <div className="flex gap-2">
        <button onClick={() => adjust(-1)} className="flex-1 h-9 rounded-xl bg-white/[0.07] hover:bg-white/[0.14] active:scale-95 flex items-center justify-center transition">
          <Minus className="w-4 h-4 text-gray-300" />
        </button>
        <button onClick={() => adjust(1)} className="flex-1 h-9 rounded-xl bg-white/[0.07] hover:bg-white/[0.14] active:scale-95 flex items-center justify-center transition">
          <Plus className="w-4 h-4 text-gray-300" />
        </button>
      </div>
    </div>
  );
}

export function OrderPanel({
  selectedAsset,
  contractType,
  duration,
  stake,
  balance,
  tradeError,
  onContractTypeChange,
  onDurationChange,
  onStakeChange,
  onPlaceTrade,
  lastSettledProfit,
  compact = false,
}: OrderPanelProps) {
  const [tradeMode, setTradeMode] = useState<"auto" | "manual">("auto");
  const [selectedDigit, setSelectedDigit] = useState(5);
  const [digitProbs, setDigitProbs] = useState<number[]>(DIGIT_BASE);

  const [targetProfit, setTargetProfit] = useState(200);
  const [stopLoss, setStopLoss] = useState(100);
  const [multiplierIdx, setMultiplierIdx] = useState(0);
  const [targetEnabled, setTargetEnabled] = useState(true);
  const [stopEnabled, setStopEnabled] = useState(true);

  // Session tracking
  const [sessionPnl, setSessionPnl] = useState(0);
  const [sessionTrades, setSessionTrades] = useState(0);
  const [sessionWins, setSessionWins] = useState(0);
  const [lastProcessedId, setLastProcessedId] = useState<string | null>(null);
  const [sessionResult, setSessionResult] = useState<"target" | "stop" | null>(null);

  const multiplier = MULTIPLIER_OPTIONS[multiplierIdx];

  useEffect(() => {
    const interval = setInterval(() => setDigitProbs(generateDigitProbs()), 2000);
    return () => clearInterval(interval);
  }, []);

  // Track settled trades into the running session P&L, and detect target/stop hits
  useEffect(() => {
    if (!lastSettledProfit || lastSettledProfit.id === lastProcessedId) return;
    setLastProcessedId(lastSettledProfit.id);

    const newPnl = sessionPnl + lastSettledProfit.profit;
    const newTrades = sessionTrades + 1;
    const newWins = sessionWins + (lastSettledProfit.profit > 0 ? 1 : 0);

    setSessionPnl(newPnl);
    setSessionTrades(newTrades);
    setSessionWins(newWins);

    if (targetEnabled && newPnl >= targetProfit) {
      setSessionResult("target");
    } else if (stopEnabled && newPnl <= -stopLoss) {
      setSessionResult("stop");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSettledProfit]);

  const resetSession = () => {
    setSessionPnl(0);
    setSessionTrades(0);
    setSessionWins(0);
    setSessionResult(null);
  };

  const showDigits = contractType !== "Rise/Fall";
  const sessionBlocked = sessionResult !== null;

  const adjustStake = (delta: number) => {
    const steps = [1, 5, 10, 25, 50, 100, 200, 500];
    const idx = steps.findIndex((s) => s >= stake);
    const cur = idx === -1 ? steps.length - 1 : idx;
    onStakeChange(steps[Math.max(0, Math.min(steps.length - 1, cur + delta))]);
  };

  const getLabels = (): [string, string] => {
    switch (contractType) {
      case "Even/Odd":    return ["Even", "Odd"];
      case "Over/Under":  return ["Over", "Under"];
      case "Match/Differ": return ["Match", "Differ"];
      default:            return ["Rise", "Fall"];
    }
  };

  const getColors = (): [string, string] => {
    switch (contractType) {
      case "Even/Odd":    return ["bg-blue-600 hover:bg-blue-500", "bg-purple-600 hover:bg-purple-500"];
      case "Over/Under":  return ["bg-cyan-600 hover:bg-cyan-500", "bg-orange-600 hover:bg-orange-500"];
      case "Match/Differ": return ["bg-emerald-600 hover:bg-emerald-500", "bg-red-700 hover:bg-red-600"];
      default:            return ["bg-emerald-600 hover:bg-emerald-500", "bg-red-700 hover:bg-red-600"];
    }
  };

  const handleTrade = (direction: "up" | "down") => {
    if (sessionBlocked) return;
    const [upLabel, downLabel] = getLabels();
    onPlaceTrade(direction, {
      digit: showDigits ? selectedDigit : undefined,
      contractType,
      digitDirection: direction === "up" ? upLabel : downLabel,
    });
  };

  const [upLabel, downLabel] = getLabels();
  const [upColor, downColor] = getColors();
  const btnBase = "h-14 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed";
  const winRate = sessionTrades > 0 ? (sessionWins / sessionTrades) * 100 : 0;

  return (
    <div className={`flex flex-col gap-0 relative ${compact ? "" : "h-full"}`}>

      {/* ── Auto / Manual ── */}
      <div className="px-3 pt-3 pb-2 border-b border-white/[0.07]">
        <div className="flex bg-white/[0.05] rounded-xl p-1 gap-1">
          {(["auto", "manual"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setTradeMode(m)}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold capitalize transition ${
                tradeMode === m ? "bg-[#3B82F6] text-white shadow" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stake ── */}
      <div className="px-3 pt-3 pb-3 border-b border-white/[0.07]">
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Stake</p>
        <div className="flex items-center justify-between bg-white/[0.05] rounded-2xl px-4 py-3 mb-3">
          <button onClick={() => adjustStake(-1)} className="w-10 h-10 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] active:scale-95 flex items-center justify-center transition">
            <Minus className="w-5 h-5 text-gray-200" />
          </button>
          <div className="flex items-baseline gap-1">
            <span className="text-gray-400 text-lg">$</span>
            <span className="text-white text-3xl font-bold tabular-nums">{stake}</span>
          </div>
          <button onClick={() => adjustStake(1)} className="w-10 h-10 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] active:scale-95 flex items-center justify-center transition">
            <Plus className="w-5 h-5 text-gray-200" />
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {STAKE_PRESETS.map((s) => (
            <button
              key={s}
              onClick={() => onStakeChange(s)}
              className={`px-3 py-2 rounded-xl text-[11px] font-bold border transition ${
                stake === s ? "bg-[#1e3a5f] border-[#3B82F6] text-[#60a5fa]" : "border-white/[0.08] bg-white/[0.04] text-gray-400 hover:bg-white/[0.09]"
              }`}
            >
              ${s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Digit selector (circular, with % below) — below stake, like TagBinary ── */}
      {showDigits && (
        <div className="px-3 pt-3 pb-3 border-b border-white/[0.07]">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-3">
            Select digit
          </p>
          <div className="flex justify-between gap-1">
            {digitProbs.map((pct, d) => {
              const isSelected = d === selectedDigit;
              const isZero = d === 0;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDigit(d)}
                  className="flex flex-col items-center gap-1.5 flex-1 min-h-[44px]"
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition ${
                    isSelected
                      ? "bg-[#3B82F6] border-[#3B82F6] text-white"
                      : "bg-[#1c2030] border-white/10 text-gray-300 hover:border-white/25"
                  }`}>
                    {d}
                  </div>
                  <span className={`text-[10px] font-semibold tabular-nums ${
                    isZero ? "text-rose-400" : isSelected ? "text-[#60a5fa]" : "text-gray-500"
                  }`}>
                    {pct.toFixed(1)}%
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[9px] text-center text-gray-600 mt-2">
            Digit <span className="text-[#3B82F6] font-bold">{selectedDigit}</span> selected
            {contractType === "Over/Under" && ` · Over > ${selectedDigit} / Under ≤ ${selectedDigit}`}
            {contractType === "Match/Differ" && ` · Match = ${selectedDigit} / Differ ≠ ${selectedDigit}`}
          </p>
        </div>
      )}

      {/* ── Risk controls ── */}
      <div className="px-3 pt-3 pb-3 border-b border-white/[0.07]">
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-3">Risk controls</p>
        <div className="grid grid-cols-3 gap-2">
          <AdjustField label="Target profit" value={targetProfit} onChange={setTargetProfit} color="text-emerald-400" enabled={targetEnabled} onToggle={() => setTargetEnabled((v) => !v)} />
          <AdjustField label="Stop loss" value={stopLoss} onChange={setStopLoss} color="text-red-400" enabled={stopEnabled} onToggle={() => setStopEnabled((v) => !v)} />
          <div className="bg-[#1c2030] rounded-2xl p-3 border border-white/[0.06]">
            <span className="text-[10px] text-gray-500 font-semibold block mb-2">Multiplier</span>
            <p className="text-amber-400 text-lg font-bold mb-2">×{multiplier}</p>
            <div className="flex gap-2">
              <button onClick={() => setMultiplierIdx((i) => Math.max(0, i - 1))} className="flex-1 h-9 rounded-xl bg-white/[0.07] hover:bg-white/[0.14] active:scale-95 flex items-center justify-center transition">
                <Minus className="w-4 h-4 text-gray-300" />
              </button>
              <button onClick={() => setMultiplierIdx((i) => Math.min(MULTIPLIER_OPTIONS.length - 1, i + 1))} className="flex-1 h-9 rounded-xl bg-white/[0.07] hover:bg-white/[0.14] active:scale-95 flex items-center justify-center transition">
                <Plus className="w-4 h-4 text-gray-300" />
              </button>
            </div>
            <p className="text-[8px] text-gray-600 text-center mt-1">{MULTIPLIER_OPTIONS.join(" · ")}</p>
          </div>
        </div>
      </div>

      {/* ── Session stats ── */}
      <div className="px-3 py-2.5 border-b border-white/[0.07] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-[10px] text-gray-500">
            Last {sessionTrades}T · {sessionWins}W · {sessionTrades - sessionWins}L
          </span>
        </div>
        <span className={`text-[11px] font-bold ${sessionPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {sessionPnl >= 0 ? "+" : ""}${sessionPnl.toFixed(2)}
        </span>
      </div>

      {/* ── Duration ── */}
      <div className="px-3 pt-3 pb-3 border-b border-white/[0.07]">
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Duration</p>
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d}
              onClick={() => onDurationChange(d)}
              className={`px-3 py-2 rounded-xl text-[11px] font-bold transition ${
                duration === d ? "bg-[#3B82F6] text-white" : "bg-[#1c2030] text-gray-400 border border-white/[0.08] hover:bg-white/[0.08]"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* ── Error ── */}
      {tradeError && (
        <div className="mx-3 mt-2 text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2.5 text-center font-medium">
          {tradeError}
        </div>
      )}

      {/* ── Payout ── */}
      <div className="px-3 pt-3 pb-1 flex justify-between text-[11px] text-gray-500">
        <span>{selectedAsset.name.replace(" Index", "")}</span>
        <span className="text-[#3B82F6] font-bold">{selectedAsset.payout}% payout</span>
      </div>

      {/* ── CTA buttons ── */}
      <div className="px-3 pb-4 pt-2 grid grid-cols-2 gap-3">
        <button onClick={() => handleTrade("up")} disabled={stake > balance || sessionBlocked} className={`${btnBase} ${upColor}`}>
          {showDigits && <span className="w-6 h-6 rounded-full bg-white/20 text-xs font-bold flex items-center justify-center">{selectedDigit}</span>}
          {upLabel}
        </button>
        <button onClick={() => handleTrade("down")} disabled={stake > balance || sessionBlocked} className={`${btnBase} ${downColor}`}>
          {showDigits && <span className="w-6 h-6 rounded-full bg-white/20 text-xs font-bold flex items-center justify-center">{selectedDigit}</span>}
          {downLabel}
        </button>
      </div>

      {/* ── Target/Stop reached modal ── */}
      {sessionResult && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-2xl">
          <div className="bg-[#1c2030] border border-white/10 rounded-3xl p-6 w-[88%] max-w-sm text-center shadow-2xl">
            <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${
              sessionResult === "target" ? "bg-emerald-500/15" : "bg-rose-500/15"
            }`}>
              {sessionResult === "target" ? (
                <CheckCircle2 className="w-9 h-9 text-emerald-400" />
              ) : (
                <XCircle className="w-9 h-9 text-rose-400" />
              )}
            </div>
            <p className={`text-xs font-bold tracking-widest uppercase mb-2 ${
              sessionResult === "target" ? "text-emerald-400" : "text-rose-400"
            }`}>
              {sessionResult === "target" ? "Target Profit Reached" : "Target Loss Reached"}
            </p>
            <p className={`text-3xl font-extrabold tabular-nums mb-5 ${
              sessionResult === "target" ? "text-emerald-400" : "text-rose-400"
            }`}>
              {sessionPnl >= 0 ? "+" : ""}{sessionPnl.toFixed(2)} <span className="text-base font-semibold text-gray-400">USD</span>
            </p>

            <div className="flex flex-col gap-2.5 mb-5 text-left">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Trades</span>
                <span className="text-white font-bold">{sessionTrades}</span>
              </div>
              <div className="h-px bg-white/[0.06]" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">W / L</span>
                <span className="text-white font-bold">{sessionWins} / {sessionTrades - sessionWins}</span>
              </div>
              <div className="h-px bg-white/[0.06]" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Win Rate</span>
                <span className="text-white font-bold">{winRate.toFixed(1)}%</span>
              </div>
            </div>

            <button
              onClick={resetSession}
              className={`w-full h-12 rounded-2xl font-bold text-white text-sm transition active:scale-95 ${
                sessionResult === "target" ? "bg-emerald-500 hover:bg-emerald-400" : "bg-rose-500 hover:bg-rose-400"
              }`}
            >
              Continue Trading
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { CONTRACT_TYPES, DURATIONS };
export type { ContractType };