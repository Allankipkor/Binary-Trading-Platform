import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md";
}

export function Logo({ size = "md" }: LogoProps) {
  const textSize = size === "sm" ? "text-sm" : "text-[17px]";

  return (
    <Link href="/" className="flex items-center">
      <span className={`${textSize} font-extrabold tracking-tight`}>
        <span className="text-[#3B82F6]">SHABIKI</span>
        <span className="text-white">MARKET</span>
      </span>
    </Link>
  );
}
