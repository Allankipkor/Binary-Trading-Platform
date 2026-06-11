import { MessageCircle, Minus, Plus, TrendingDown, TrendingUp } from "lucide-react";
import type { Asset } from "@/lib/assets";

const CONTRACT_TYPES = ["Rise/Fall", "Even/Odd", "Over/Under", "Match/Differ"] as const;
const DURATIONS = ["1 min", "2 min", "5 min", "10 min", "15 min"];

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
  return (
    <div className={`flex flex-col ${compact ? "" : "h-full"}`}>
      <div className={`${compact ? "p-3" : "p-4"} border-b border-white/[0.07]`}>
        <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 sm:mb-3">
          Contract Type
        </h3>
        <div className="grid grid-cols-2 gap-1.5">
          {CONTRACT_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => onContractTypeChange(t)}
              className={`px-2 py-2 sm:py-2.5 rounded-lg text-[10px] sm:text-[11px] font-semibold transition touch-target ${
                contractType === t
                  ? "bg-[#3B82F6]/20 text-[#3B82F6] border border-[#3B82F6]/30"
                  : "bg-[#1c2030] text-gray-400 border border-white/[0.07] hover:bg-white/5"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className={`${compact ? "p-3" : "p-4"} border-b border-white/[0.07]`}>
        <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 sm:mb-3">
          Duration
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {DURATIONS.map((d) => (
            <button
              key={d}
              onClick={() => onDurationChange(d)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold transition touch-target ${
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

      <div className={`${compact ? "p-3" : "p-4"} border-b border-white/[0.07]`}>
        <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 sm:mb-3">
          Stake
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onStakeChange(Math.max(0.1, stake - 1))}
            className="p-2 sm:p-2.5 rounded-lg bg-[#1c2030] border border-white/[0.07] hover:bg-white/5 touch-target"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <div className="flex-1 text-center">
            <div className="text-lg sm:text-xl font-bold tabular-nums">${stake.toFixed(2)}</div>
            <div className="text-[10px] text-gray-500">
              Payout: ${(stake * (1 + selectedAsset.payout / 100)).toFixed(2)}
            </div>
          </div>
          <button
            onClick={() => onStakeChange(stake + 1)}
            className="p-2 sm:p-2.5 rounded-lg bg-[#1c2030] border border-white/[0.07] hover:bg-white/5 touch-target"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex gap-1.5 mt-2">
          {[1, 5, 10, 25].map((v) => (
            <button
              key={v}
              onClick={() => onStakeChange(v)}
              className="flex-1 py-1.5 sm:py-2 rounded text-[10px] sm:text-[11px] font-medium bg-[#1c2030] text-gray-400 border border-white/[0.07] hover:bg-white/5 touch-target"
            >
              ${v}
            </button>
          ))}
        </div>
      </div>

      <div className={`${compact ? "p-3" : "p-4"} flex flex-col gap-2 ${compact ? "" : "flex-1"}`}>
        {tradeError && <p className="text-[10px] text-rose-400 text-center">{tradeError}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onPlaceTrade("up")}
            disabled={stake > balance}
            className="min-h-[48px] sm:min-h-[52px] rounded-xl font-bold text-white flex items-center justify-center gap-1.5 sm:gap-2 text-sm transition hover:opacity-90 disabled:opacity-40 touch-target"
            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
          >
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            RISE
          </button>
          <button
            onClick={() => onPlaceTrade("down")}
            disabled={stake > balance}
            className="min-h-[48px] sm:min-h-[52px] rounded-xl font-bold text-white flex items-center justify-center gap-1.5 sm:gap-2 text-sm transition hover:opacity-90 disabled:opacity-40 touch-target"
            style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
          >
            <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
            FALL
          </button>
        </div>
        <p className="text-[10px] text-center text-gray-500">
          {selectedAsset.payout}% return on win
        </p>
      </div>

      {!compact && (
        <div className="p-3 border-t border-white/[0.07] hidden lg:block">
          <button className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs text-gray-400 hover:bg-white/5 transition touch-target">
            <MessageCircle className="w-3.5 h-3.5" />
            Live Chat
          </button>
        </div>
      )}
    </div>
  );
}

export { CONTRACT_TYPES, DURATIONS };
export type { ContractType };
