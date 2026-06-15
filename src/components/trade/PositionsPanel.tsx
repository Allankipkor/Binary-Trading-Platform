import { TrendingDown, TrendingUp } from "lucide-react";

export interface Position {
  id: string;
  asset: string;
  type: string;
  direction: "up" | "down";
  stake: number;
  payout: number;
  expiry: number;
  openPrice: number;
  status: "open" | "won" | "lost";
  profit?: number;
}

interface PositionsPanelProps {
  positions: Position[];
  closedTab: "won" | "lost";
  onTabChange: (tab: "won" | "lost") => void;
  timeLeft: (expiry: number) => string;
  className?: string;
}

export function PositionsPanel({
  positions,
  closedTab,
  onTabChange,
  timeLeft,
  className = "",
}: PositionsPanelProps) {
  const openPositions = positions.filter((p) => p.status === "open");
  const closedPositions = positions.filter((p) => p.status !== "open");
  const visible = closedTab ? closedPositions : openPositions;

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      <div className="flex border-b border-white/[0.07] shrink-0">
        <button
          onClick={() => onTabChange(false)}
          className={`flex-1 py-2.5 sm:py-3 text-xs font-semibold transition touch-target ${
            !closedTab ? "text-white border-b-2 border-[#3B82F6]" : "text-gray-500"
          }`}
        >
          Open ({openPositions.length})
        </button>
        <button
          onClick={() => onTabChange(true)}
          className={`flex-1 py-2.5 sm:py-3 text-xs font-semibold transition touch-target ${
            closedTab ? "text-white border-b-2 border-[#3B82F6]" : "text-gray-500"
          }`}
        >
          Closed ({closedPositions.length})
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {visible.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-500">
            No {closedTab ? "closed" : "open"} positions
          </div>
        ) : (
          visible.map((p) => (
            <div key={p.id} className="p-3 sm:p-4 border-b border-white/[0.04] hover:bg-white/[0.02]">
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="text-[11px] sm:text-xs font-semibold text-gray-300 truncate">
                  {p.asset}
                </span>
                {p.status === "open" ? (
                  <span className="text-[10px] sm:text-[11px] text-amber-400 tabular-nums shrink-0">
                    {timeLeft(p.expiry)}
                  </span>
                ) : (
                  <span
                    className={`text-[10px] sm:text-[11px] font-bold shrink-0 ${
                      p.status === "won" ? "text-emerald-500" : "text-rose-500"
                    }`}
                  >
                    {p.status === "won" ? `+$${p.profit?.toFixed(2)}` : `-$${p.stake.toFixed(2)}`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {p.direction === "up" ? (
                  <TrendingUp className="w-3 h-3 text-emerald-500 shrink-0" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-rose-500 shrink-0" />
                )}
                <span className="text-[10px] sm:text-[11px] text-gray-500 truncate">
                  ${p.stake} · {p.type}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
