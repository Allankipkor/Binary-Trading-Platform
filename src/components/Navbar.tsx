"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#steps", label: "How It Works" },
  { href: "#reviews", label: "Reviews" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#13161e]/85 border-b border-white/[0.07] safe-top">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-5 h-14">
        <Logo />

        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="px-3 py-1.5 text-[13px] font-medium rounded-md transition text-gray-400 hover:text-white hover:bg-white/5"
            >
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden sm:inline px-3 sm:px-3.5 py-1.5 text-[13px] font-medium rounded-md transition text-gray-300 hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="px-3 sm:px-4 py-1.5 sm:py-2 text-[12px] sm:text-[13px] font-semibold text-white rounded-lg transition shadow-lg shadow-[#3B82F6]/25 hover:shadow-[#3B82F6]/40 whitespace-nowrap"
            style={{ background: "#3B82F6" }}
          >
            Get Started
          </Link>
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 touch-target"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/[0.07] bg-[#13161e]/95 backdrop-blur-xl safe-x">
          <div className="px-4 py-3 space-y-1">
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="block px-3 py-3 text-sm font-medium rounded-lg text-gray-300 hover:text-white hover:bg-white/5"
              >
                {label}
              </a>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="block px-3 py-3 text-sm font-medium rounded-lg text-gray-300 hover:text-white hover:bg-white/5"
            >
              Log in
            </Link>
            <Link
              href="/trade?demo=true"
              onClick={() => setOpen(false)}
              className="block px-3 py-3 text-sm font-medium rounded-lg text-[#3B82F6] hover:bg-white/5"
            >
              Try Demo
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
