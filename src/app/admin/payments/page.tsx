"use client";

import { useEffect, useState } from "react";
import { CreditCard, ToggleLeft, ToggleRight, Save, Settings, X } from "lucide-react";

interface PaymentMethod {
  id: string;
  name: string;
  label: string;
  enabled: boolean;
  config: string;
}

export default function AdminPaymentsPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [editForm, setEditForm] = useState({ label: "", enabled: true, config: "{}" });
  const [msg, setMsg] = useState("");

  const fetchMethods = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/payments");
    const data = await res.json();
    setMethods(data.methods);
    setLoading(false);
  };

  useEffect(() => { fetchMethods(); }, []);

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const handleToggle = async (m: PaymentMethod) => {
    const res = await fetch("/api/admin/payments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, enabled: !m.enabled }),
    });
    if (res.ok) {
      showMsg(`${m.label} ${m.enabled ? "disabled" : "enabled"}`);
      fetchMethods();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const res = await fetch("/api/admin/payments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id, ...editForm, config: editForm.config ? JSON.parse(editForm.config) : {} }),
    });
    if (res.ok) {
      setEditing(null);
      showMsg("Payment method updated");
      fetchMethods();
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-[3px] border-[#833ab4] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Payment Methods</h1>
        <p className="text-sm text-gray-500 mt-1">Manage deposit/withdrawal payment methods</p>
      </div>

      {msg && <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-sm text-emerald-400">{msg}</div>}

      <div className="grid gap-4">
        {methods.map((m) => (
          <div key={m.id} className="bg-[#0d0f17] border border-white/[0.07] rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#833ab4]/15 border border-[#833ab4]/25 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-[#833ab4]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{m.label}</p>
                  <p className="text-xs text-gray-500 capitalize">{m.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleToggle(m)} className="p-2 rounded-lg hover:bg-white/5 text-gray-400" title={m.enabled ? "Disable" : "Enable"}>
                  {m.enabled ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-gray-500" />}
                </button>
                <button onClick={() => { setEditing(m); setEditForm({ label: m.label, enabled: m.enabled, config: m.config }); }}
                  className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white" title="Configure">
                  <Settings className="w-4 h-4" />
                </button>
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${m.enabled ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                  {m.enabled ? "Active" : "Disabled"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-[#0d0f17] border border-white/[0.07] rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white flex items-center gap-2"><Settings className="w-4 h-4" /> Configure {editing.label}</h2>
              <button onClick={() => setEditing(null)} className="p-1 rounded-lg hover:bg-white/5"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 font-semibold mb-1.5 block">Label</label>
                <input value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                  className="w-full bg-[#141822] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#833ab4]/50" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold mb-1.5 block">Configuration (JSON)</label>
                <textarea value={editForm.config} onChange={(e) => setEditForm({ ...editForm, config: e.target.value })}
                  rows={5}
                  className="w-full bg-[#141822] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-[#833ab4]/50 font-mono" />
              </div>
              <button type="submit" className="w-full h-11 rounded-xl bg-gradient-brand text-white text-sm font-bold transition flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> Save Changes
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
