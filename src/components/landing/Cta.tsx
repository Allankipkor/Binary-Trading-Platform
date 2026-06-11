import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Cta() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-5 pb-12 sm:pb-16 md:pb-24">
      <div
        className="relative rounded-3xl overflow-hidden px-6 py-14 md:py-20 text-center"
        style={{ background: "linear-gradient(135deg, #3B82F6, #4338ca)" }}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-[#00d4aa]/15 blur-3xl" />
        </div>
        <div className="relative">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Ready to start earning?
          </h2>
          <p className="text-white/70 text-[15px] md:text-lg max-w-md mx-auto mb-8">
            Join a million traders worldwide. Create your free account in under 60 seconds.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-[#3B82F6] font-semibold rounded-xl transition-all shadow-xl text-[15px] hover:shadow-2xl"
            >
              Create Free Account
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/trade"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 font-semibold rounded-xl text-[15px] border border-white/25 text-white hover:bg-white/10 transition"
            >
              Try Demo
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
