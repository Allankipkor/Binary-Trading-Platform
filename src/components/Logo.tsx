"use client";

import Link from "next/link";
import { useSecretSetup } from "./SecretSetupModal";

interface LogoProps {
  size?: "sm" | "md";
}

export function Logo({ size = "md" }: LogoProps) {
  const textSize = size === "sm" ? "text-sm" : "text-[17px]";
  const { handleLogoTap } = useSecretSetup();

  return (
    <Link
      href="/"
      onClick={(e) => handleLogoTap(e)}
      className="flex items-center select-none cursor-pointer"
    >
      <span className={`${textSize} font-extrabold tracking-tight`}>
        <span className="text-[#3B82F6]">SHABIKI</span>
        <span className="text-white">MARKET</span>
      </span>
    </Link>
  );
}

