"use client";

import { useState, useEffect } from "react";
import { Save } from "lucide-react";

interface Settings {
  minDeposit: number;
  maxDeposit: number;
  minWithdrawal: number;
  maxWithdrawal: number;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) setSettings(d.settings);
      })
      .catch(() => setMessage({ type: "error", text: "Failed to load settings" }))
      .finally(() => setLoading(false));
  }, []);

  const update = (key: keyof Settings, val: string) => {
    const num = Math.max(0, Number(val) || 0);
    setSettings((prev) => (prev ? { ...prev, [key]: num } : prev));
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      if (data.settings) setSettings(data.settings);
      setMessage({ type: "success", text: "Settings saved successfully!" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-[3px] border-[#833ab4] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Site Settings</h1>
      <p className="text-sm text-gray-400 mb-6">Configure deposit and withdrawal limits</p>

      <div className="space-y-6">
        {/* Deposit Limits */}
        <section className="bg-[#0d0f17] border border-white/[0.07] rounded-2xl p-5">
          <h2 className="text-sm font-bold text-white mb-4">Deposit Limits</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Minimum Deposit (USD)</label>
              <input
                type="number"
                min={0}
                value={settings?.minDeposit ?? 5}
                onChange={(e) => update("minDeposit", e.target.value)}
                className="w-full bg-[#141822] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#833ab4]/50"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Maximum Deposit (USD)</label>
              <input
                type="number"
                min={0}
                value={settings?.maxDeposit ?? 10000}
                onChange={(e) => update("maxDeposit", e.target.value)}
                className="w-full bg-[#141822] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#833ab4]/50"
              />
            </div>
          </div>
        </section>

        {/* Withdrawal Limits */}
        <section className="bg-[#0d0f17] border border-white/[0.07] rounded-2xl p-5">
          <h2 className="text-sm font-bold text-white mb-4">Withdrawal Limits</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Minimum Withdrawal (USD)</label>
              <input
                type="number"
                min={0}
                value={settings?.minWithdrawal ?? 100}
                onChange={(e) => update("minWithdrawal", e.target.value)}
                className="w-full bg-[#141822] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#833ab4]/50"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Maximum Withdrawal (USD)</label>
              <input
                type="number"
                min={0}
                value={settings?.maxWithdrawal ?? 150000}
                onChange={(e) => update("maxWithdrawal", e.target.value)}
                className="w-full bg-[#141822] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#833ab4]/50"
              />
            </div>
          </div>
        </section>

        {message && (
          <p
            className={`text-sm px-4 py-2.5 rounded-xl ${
              message.type === "success"
                ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400"
                : "bg-rose-500/10 border border-rose-500/25 text-rose-400"
            }`}
          >
            {message.text}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 bg-gradient-brand"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
