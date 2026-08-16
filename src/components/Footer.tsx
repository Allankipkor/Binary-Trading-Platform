"use client";

import { useSecretSetup } from "./SecretSetupModal";

export function Footer() {
  const { handleLogoTap } = useSecretSetup();

  return (
    <footer className="border-t border-white/[0.07]">
      <div className="max-w-6xl mx-auto px-4 sm:px-5 py-6 sm:py-8 safe-x safe-bottom">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center">
            <span
              onClick={(e) => handleLogoTap(e)}
              className="text-sm font-extrabold tracking-tight select-none cursor-pointer"
            >
              <span className="text-[#3B82F6]">SHABIKI</span>
              <span className="text-slate-900 dark:text-white transition-colors">MARKET</span>
            </span>
          </div>
          <div className="flex items-center gap-5 text-xs text-gray-500">
            <a href="#" className="transition hover:text-white">
              Privacy
            </a>
            <a href="#" className="transition hover:text-white">
              Terms
            </a>
            <a href="#" className="transition hover:text-white">
              Support
            </a>
          </div>
          <div className="text-xs text-gray-500">© 2026 ShabikiMarket</div>
        </div>
      </div>
    </footer>
  );
}