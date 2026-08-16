"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  isLight: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  isLight: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  const applyTheme = (t: Theme) => {
    if (t === "light") {
      document.documentElement.classList.add("light-mode", "light");
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light-mode", "light");
    }
  };

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem("app_theme") as Theme | null;
      if (saved === "light" || saved === "dark") {
        setThemeState(saved);
        applyTheme(saved);
      } else {
        applyTheme("dark");
      }
    } catch {
      applyTheme("dark");
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem("app_theme", newTheme);
    } catch {}
    applyTheme(newTheme);
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const isLight = mounted && theme === "light";

  return (
    <ThemeContext.Provider value={{ theme, isLight, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
