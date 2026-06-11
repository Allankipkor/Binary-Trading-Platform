import { TrendingUp } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.07]">
      <div className="max-w-6xl mx-auto px-4 sm:px-5 py-6 sm:py-8 safe-x safe-bottom">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #3B82F6, #00d4aa)" }}
            >
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-white">OpenMarket</span>
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
          <div className="text-xs text-gray-500">© 2026 OpenMarket</div>
        </div>
      </div>
    </footer>
  );
}
