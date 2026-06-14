"use client";

import { useEffect, useState } from "react";
import { Minus, Plus, Zap } from "lucide-react";
import type { Asset } from "@/lib/assets";

const CONTRACT_TYPES = ["Rise/Fall", "Even/Odd", "Over/Under", "Match/Differ"] as const;
const DURATIONS = ["1 min", "2 min", "5 min", "10 min", "15 min"];
const STAKE_PRESETS = [1, 5, 10, 25, 50, 100];
const DIGIT_BASE = [0.0, 11.9, 10.3, 9.1, 13.8, 9.5, 12.6, 8.7, 14.2, 9.9];

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
  onPlaceTrade: (direction: "up" | "down") => void;
  compact?: boolean;
}

function generateDigitProbs(): number[] {
  return DIGIT_BASE.map((base) =>
    Math.max(0, Math.min(25, +(base + (Math.random() - 0.5) * 1.5).toFixed(1)))
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
  compact = false,
}: OrderPanelProps) {
  const [tradeMode, setTradeMode] = useState<"auto" | "manual">("auto");
  const [selectedDigit, setSelectedDigit] = useState(6);
  const [digitProbs, setDigitProbs] = useState<number[]>(DIGIT_BASE);

  useEffect(() => {
    const interval = setInterval(() => setDigitProbs(generateDigitProbs()), 2000);
    return () => clearInterval(interval);
  }, []);

  const targetProfit = stake * 20;
  const stopLoss = +(stake * 10).toFixed(0);
  const multiplier = stake >= 50 ? 3 : 2;
  const maxDigitIdx = digitProbs.indexOf(Math.max(...digitProbs));
  const showDigits = contractType !== "Rise/Fall";

  const adjustStake = (delta: number) => {
    const steps = [1, 5, 10, 25, 50, 100, 200, 500];
    const idx = steps.findIndex((s) => s >= stake);
    const newIdx = Math.max(0, Math.min(steps.length - 1, idx + delta));
    onStakeChange(steps[newIdx]);
  };

  const renderCTAButtons = () => {
    const base =
      "min-h-[52px] rounded-xl font-bold text-white flex items-center justify-center text-sm transition active:scale-95 hover:opacity-90 disabled:opacity-40 touch-target";
    if (contractType === "Rise/Fall") {
      return (
        <>
          <button onClick={() => onPlaceTrade("up")} disabled={stake > balance} className={`${base} bg-emerald-500`}>Rise</button>
          <button onClick={() => onPlaceTrade("down")} disabled={stake > balance} className={`${base} bg-red-500`}>Fall</button>
        </>
      );
    }
    if (contractType === "Even/Odd") {
      return (
        <>
          <button onClick={() => onPlaceTrade("up")} disabled={stake > balance} className={`${base} bg-blue-500`}>Even</button>
          <button onClick={() => onPlaceTrade("down")} disabled={stake > balance} className={`${base} bg-purple-500`}>Odd</button>
        </>
      );
    }
    if (contractType === "Over/Under") {
      return (
        <>
          <button onClick={() => onPlaceTrade("up")} disabled={stake > balance} className={`${base} bg-cyan-500`}>Over</button>
          <button onClick={() => onPlaceTrade("down")} disabled={stake > balance} className={`${base} bg-orange-500`}>Under</button>
        </>
      );
    }
    return (
      <>
        <button onClick={() => onPlaceTrade("up")} disabled={stake > balance} className={`${base} bg-emerald-500`}>Match</button>
        <button onClick={() => onPlaceTrade("down")} disabled={stake > balance} className={`${base} bg-red-500`}>Differ</button>
      </>
    );
  };

  return (
    <div className={`flex flex-col ${compact ? "" : "h-full"}`}>

      {/* Digit probabilities */}
      {showDigits && (
        <div className="px-3 pt-3 pb-2 border-b border-white/[0.07]">
          <div className="flex justify-between gap-1">
            {digitProbs.map((pct, d) => {
              const isSelected = d === selectedDigit;
              const isHot = d === maxDigitIdx;
              return (
                <button key={d} onClick={() => setSelectedDigit(d)} className="flex flex-col items-center gap-1 flex-1 touch-target">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-[1.5px] transition ${
                    isSelected
                      ? "bg-[#1e3a5f] border-[#3B82F6] text-[#60a5fa]"
                      : isHot
                        ? "bg-emerald-900/40 border-emerald-500 text-emerald-400"
                        : "bg-white/[0.05] border-white/[0.08] text-gray-300"
                  }`}>
                    {d}
                  </div>
                  <span className={`text-[9px] font-medium ${isHot ? "text-emerald-400" : "text-gray-500"}`}>
                    {pct.toFixed(1)}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Auto / Manual */}
      <div className="px-3 pt-2 pb-2 border-b border-white/[0.07]">
        <div className="flex bg-white/[0.05] rounded-xl p-1">
          {(["auto", "manual"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setTradeMode(m)}
              className={`flex-1 py-2 rounded-lg text-[11px] font-bold capitalize transition touch-target ${
                tradeMode === m ? "bg-[#3B82F6] text-white" : "text-gray-400"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Stake */}
      <div className="px-3 pt-2 pb-2 border-b border-white/[0.07]">
        <div className="flex items-center justify-between bg-white/[0.05] rounded-xl px-3 py-2 mb-2">
          <button onClick={() => adjustStake(-1)} className="w-8 h-8 rounded-lg bg-white/[0.07] hover:bg-white/[0.12] flex items-center justify-center transition touch-target">
            <Minus className="w-4 h-4 text-gray-300" />
          </button>
          <div className="flex items-baseline gap-1">
            <span className="text-gray-400 text-sm">$</span>
            <span className="text-white text-2xl font-bold tabular-nums">{stake}</span>
          </div>
          <button onClick={() => adjustStake(1)} className="w-8 h-8 rounded-lg bg-white/[0.07] hover:bg-white/[0.12] flex items-center justify-center transition touch-target">
            <Plus className="w-4 h-4 text-gray-300" />
          </button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STAKE_PRESETS.map((s) => (
            <button
              key={s}
              onClick={() => onStakeChange(s)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition touch-target ${
                stake === s
                  ? "bg-[#1e3a5f] border-[#3B82F6] text-[#60a5fa]"
                  : "border-white/[0.07] bg-white/[0.03] text-gray-400"
              }`}
            >
              ${s}
            </button>
          ))}
        </div>
      </div>

      {/* Target profit / Stop loss / Multiplier */}
      <div className="px-3 pt-2 pb-2 border-b border-white/[0.07] grid grid-cols-3 gap-2">
        <div className="bg-white/[0.04] rounded-xl p-2">
          <p className="text-[9px] text-gray-500 font-semibold mb-1">Target profit</p>
          <p className="text-emerald-400 text-sm font-bold tabular-nums">${targetProfit}</p>
        </div>
        <div className="bg-white/[0.04] rounded-xl p-2">
          <p className="text-[9px] text-gray-500 font-semibold mb-1">Stop loss</p>
          <p className="text-red-400 text-sm font-bold tabular-nums">${stopLoss}</p>
        </div>
        <div className="bg-white/[0.04] rounded-xl p-2">
          <p className="text-[9px] text-gray-500 font-semibold mb-1">Multiplier</p>
          <p className="text-amber-400 text-sm font-bold">×{multiplier}</p>
        </div>
      </div>

      {/* Last trades */}
      <div className="px-3 py-2 border-b border-white/[0.07] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-gray-500" />
          <span className="text-[10px] text-gray-500">Last 22T · 19W · 3L</span>
        </div>
        <span className="text-[11px] font-bold text-emerald-400">+$1,297.50</span>
      </div>

      {/* Duration */}
      <div className="px-3 pt-2 pb-2 border-b border-white/[0.07]">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Duration</h3>
        <div className="flex flex-wrap gap-1.5">
          {DURATIONS.map((d) => (
            <button
              key={d}
              onClick={() => onDurationChange(d)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition touch-target ${
                duration === d
                  ? "bg-[#3B82F6] text-white"
                  : "bg-[#1c2030] text-gray-400 border border-white/[0.07]"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {tradeError && (
        <p className="mx-3 mt-2 text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 text-center">
          {tradeError}
        </p>
      )}

      {/* Payout info */}
      <div className="px-3 pt-2 pb-1 flex justify-between text-[10px] text-gray-500">
        <span>{selectedAsset.name.replace(" Index", "")}</span>
        <span className="text-[#3B82F6] font-semibold">{selectedAsset.payout}% payout</span>
      </div>

      {/* CTA */}
      <div className="px-3 pb-3 grid grid-cols-2 gap-2">
        {renderCTAButtons()}
      </div>
    </div>
  );
}

export { CONTRACT_TYPES, DURATIONS };
export type { ContractType };