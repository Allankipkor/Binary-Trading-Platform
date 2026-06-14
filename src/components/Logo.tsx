import Link from "next/link";
import { TrendingUp } from "lucide-react";

interface LogoProps {
  size?: "sm" | "md";
}

export function Logo({ size = "md" }: LogoProps) {
  const iconSize = size === "sm" ? "w-6 h-6" : "w-8 h-8";
  const svgSize = size === "sm" ? "w-3.5 h-3.5" : "w-[17px] h-[17px]";
  const textSize = size === "sm" ? "text-sm" : "text-[17px]";

  return (
    <Link href="/" className="flex items-center gap-2.5">
      <div
        className={`${iconSize} rounded-lg flex items-center justify-center`}
        style={{ background: "linear-gradient(135deg, #3B82F6, #00d4aa)" }}
      >
        <TrendingUp className={`${svgSize} text-white`} />
      </div>
      <span className={`${textSize} font-bold text-white`}>OpenMarket</span>
    </Link>
  );
}
