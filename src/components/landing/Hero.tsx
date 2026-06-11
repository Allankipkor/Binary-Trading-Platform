import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  Banknote,
  Flame,
  Play,
  ShieldCheck,
  Timer,
} from "lucide-react";

const BADGES = [
  { icon: Timer, label: "<1s execution" },
  { icon: BadgeDollarSign, label: "Up to 95% payout" },
  { icon: ShieldCheck, label: "Bank-level security" },
  { icon: Banknote, label: "Zero fees" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(59,130,246,.12) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute top-[100px] right-[-100px] w-[400px] h-[400px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(0,212,170,.08) 0%, transparent 70%)",
          }}
        />
      </div>
      <div className="relative max-w-6xl mx-auto px-4 sm:px-5 pt-12 sm:pt-16 md:pt-28 pb-10 sm:pb-12 md:pb-20 text-center">
        <div
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-7 border"
          style={{
            color: "#3B82F6",
            borderColor: "rgba(59,130,246,.25)",
            background: "rgba(59,130,246,.08)",
          }}
        >
          <Flame className="w-3.5 h-3.5" />
          Over 1 million traders and counting
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-[3.75rem] lg:text-7xl font-extrabold leading-[1.05] tracking-tight mb-6 text-white">
          Trading Made Easy,{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(135deg, #3B82F6, #00d4aa)" }}
          >
            Trade Smart
          </span>
        </h1>
        <p className="text-[15px] md:text-lg leading-relaxed max-w-xl mx-auto mb-9 text-gray-400">
          Trade 100+ assets worldwide with lightning execution and up to 95% returns. Start with
          as little as $10.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
          <Link
            href="/register"
            className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 text-white font-semibold rounded-xl transition-all shadow-xl shadow-[#3B82F6]/25 hover:shadow-[#3B82F6]/40 text-[15px]"
            style={{ background: "#3B82F6" }}
          >
            Get Started — It&apos;s Free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="/trade?demo=true"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 font-semibold rounded-xl text-[15px] border transition border-white/10 hover:bg-white/5 text-white"
          >
            <Play className="w-4 h-4" />
            Try Demo
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
          {BADGES.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium bg-white/[0.04] text-gray-300 border border-white/[0.06]"
            >
              <Icon className="w-3.5 h-3.5" style={{ color: "#3B82F6" }} />
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
