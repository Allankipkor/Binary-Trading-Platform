import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md";
}

export function Logo({ size = "md" }: LogoProps) {
  const textSize = size === "sm" ? "text-sm" : "text-[17px]";

  return (
    <Link href="/" className="flex items-center">
      <span className={`${textSize} font-extrabold tracking-tight`}>
        <span className="text-gradient-brand">SMART</span>
        <span className="text-white">DOLLARFX</span>
      </span>
    </Link>
  );
}
