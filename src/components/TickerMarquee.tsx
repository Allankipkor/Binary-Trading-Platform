const TICKERS = [
  { symbol: "BTC", price: "43,256", change: "+2.34%", up: true, color: "#f7931a", letter: "B" },
  { symbol: "ETH", price: "2,284", change: "+1.87%", up: true, color: "#627eea", letter: "E" },
  { symbol: "AAPL", price: "178.32", change: "-0.45%", up: false, color: "#555", letter: "A" },
  { symbol: "XAU", price: "2,024", change: "+0.89%", up: true, color: "#d4a017", letter: "X" },
  { symbol: "TSLA", price: "248.90", change: "+3.21%", up: true, color: "#e31937", letter: "T" },
  { symbol: "EUR", price: "1.0892", change: "+0.12%", up: true, color: "#0052b4", letter: "E" },
  { symbol: "SOL", price: "98.42", change: "+5.67%", up: true, color: "#9945ff", letter: "S" },
  { symbol: "GBP", price: "1.2654", change: "-0.08%", up: false, color: "#c8102e", letter: "G" },
];

function TickerItem({ symbol, price, change, up, color, letter }: (typeof TICKERS)[0]) {
  return (
    <div className="flex items-center gap-2.5 px-5">
      <div
        className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white"
        style={{ background: color }}
      >
        {letter}
      </div>
      <span className="text-xs font-semibold text-gray-300">{symbol}</span>
      <span className="text-xs text-gray-500">${price}</span>
      <span className={`text-[11px] font-bold ${up ? "text-emerald-500" : "text-rose-500"}`}>
        {change}
      </span>
      <div className="w-px h-4 bg-white/[0.06]" />
    </div>
  );
}

export function TickerMarquee() {
  const items = [...TICKERS, ...TICKERS, ...TICKERS];

  return (
    <div className="border-y border-white/[0.07]">
      <div className="overflow-hidden bg-[#1a1d27]/60 backdrop-blur-sm">
        <div className="flex animate-marquee w-max py-3">
          {items.map((ticker, i) => (
            <TickerItem key={`${ticker.symbol}-${i}`} {...ticker} />
          ))}
        </div>
      </div>
    </div>
  );
}
