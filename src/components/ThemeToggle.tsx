"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("light-mode", light);
  }, [light]);

  return (
    <button
      onClick={() => setLight(!light)}
      className="p-2 rounded-lg transition hover:bg-white/5 text-gray-400"
      aria-label="Toggle theme"
    >
      {light ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
    </button>
  );
}
