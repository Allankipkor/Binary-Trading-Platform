"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export function ThemeToggle() {
  const { isLight, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg transition hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer"
      aria-label="Toggle theme"
      title={isLight ? "Switch to Dark theme" : "Switch to Light theme"}
    >
      {isLight ? <Moon className="w-4 h-4 text-slate-700" /> : <Sun className="w-4 h-4 text-amber-400" />}
    </button>
  );
}
