"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Smartphone, Bitcoin, CreditCard, Copy, Check, AlertCircle } from "lucide-react";
import {
  PayPalScriptProvider,
  PayPalButtons,
} from "@paypal/react-paypal-js";

type Tab = "mpesa" | "crypto" | "card";

const paypalTransactionByOrderId: Record<string, string> = {};

interface GatewayInfo {
  id: "mpesa" | "crypto" | "card";
  name: string;
  enabled: boolean;
  minDeposit: number;
  maxDeposit: number | null;
  instructions: string | null;
  clientConfig?: {
    paypalClientId?: string;
    paypalEnv?: string;
    cryptoAddress?: string;
    cryptoNetwork?: string;
    usdToKes?: number;
  };
}

interface DepositModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (balance: number) => void;
  userPhone?: string | null;
}

interface CryptoResult {
  address: string;
  amount: number;
  reference: string;
  transactionId: string;
  status: string;
  message?: string;
}

export function DepositModal({ open, onClose, onSuccess, userPhone }: DepositModalProps) {
  const [tab, setTab] = useState<Tab>("mpesa");
  const [amount, setAmount] = useState(5);
  const [phone, setPhone] = useState(userPhone ?? "");
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cryptoResult, setCryptoResult] = useState<CryptoResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [globalMinDeposit, setGlobalMinDeposit] = useState(5);
  const [gateways, setGateways] = useState<GatewayInfo[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/payments/deposit")
      .then((r) => r.json())
      .then((data) => {
        if (data.minDeposit !== undefined) {
          setGlobalMinDeposit(data.minDeposit);
        }
        if (Array.isArray(data.gateways) && data.gateways.length > 0) {
          setGateways(data.gateways);
          // If current tab is disabled, switch to first enabled tab
          const activeGw = data.gateways.find((g: GatewayInfo) => g.id === tab && g.enabled);
          if (!activeGw) {
            const firstEnabled = data.gateways.find((g: GatewayInfo) => g.enabled);
            if (firstEnabled) {
              setTab(firstEnabled.id);
            }
          }
        }
      })
      .catch((e) => console.error("Failed to load deposit settings", e));
  }, [open, tab]);

  const currentGateway = useMemo(() => {
    return gateways.find((g) => g.id === tab);
  }, [gateways, tab]);

  const activeMinDeposit = currentGateway?.minDeposit ?? globalMinDeposit;

  useEffect(() => {
    if (amount < activeMinDeposit) {
      setAmount(activeMinDeposit);
    }
  }, [activeMinDeposit, amount]);

  if (!open) return null;

  const reset = () => {
    setError("");
    setMessage("");
    setCryptoResult(null);
    setTxHash("");
  };

  const pollDepositStatus = (transactionId: string) => {
    let attempts = 0;
    const maxAttempts = 20; // ~60 seconds at 3s intervals

    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/payments/status/${transactionId}`, { cache: "no-store" });
        const data = await res.json();

        if (data.status === "completed") {
          clearInterval(interval);
          setMessage(`Deposit of $${data.amount} confirmed!`);
          setError("");
          if (data.balance !== undefined) onSuccess(data.balance);
          return;
        }

        if (data.status === "failed") {
          clearInterval(interval);
          setError("Payment failed or was cancelled. Please try again.");
          setMessage("");
          return;
        }
      } catch {
        // keep polling
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setMessage("Still waiting for confirmation. Check back in a moment, or refresh.");
      }
    }, 3000);
  };

  const handleDeposit = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/payments/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: tab,
          amount,
          phone: tab === "mpesa" ? phone : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const raw = data.error ?? data.message ?? data;
        throw new Error(
          typeof raw === "string" ? raw : JSON.stringify(raw)
        );
      }

      if (tab === "mpesa") {
        setMessage(data.message ?? "Check your phone for the M-Pesa prompt");
        if (data.transactionId) {
          pollDepositStatus(data.transactionId);
        }
      } else if (tab === "crypto") {
        setCryptoResult(data);
        if (data.status === "completed" && data.balance != null) {
          onSuccess(data.balance);
          setMessage(data.message);
        }
      } else {
        setMessage(data.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setLoading(false);
    }
  };

  const confirmCrypto = async () => {
    if (!cryptoResult) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/payments/crypto/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: cryptoResult.transactionId,
          txHash,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Confirmation failed");
      onSuccess(data.balance);
      setMessage(data.message);
      setCryptoResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirmation failed");
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePaypalCreateOrder = async (): Promise<string> => {
    const res = await fetch("/api/payments/paypal/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not start checkout");
    paypalTransactionByOrderId[data.orderId] = data.transactionId;
    return data.orderId;
  };

  const handlePaypalApprove = async (data: { orderID: string }) => {
    setLoading(true);
    setError("");
    try {
      const transactionId = paypalTransactionByOrderId[data.orderID];
      const res = await fetch("/api/payments/paypal/capture-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, orderId: data.orderID }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Capture failed");
      onSuccess(result.balance);
      setMessage(`Deposit of $${result.amount.toFixed(2)} confirmed!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Card payment failed to complete");
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof Smartphone }[] = [
    { id: "mpesa", label: "M-Pesa", icon: Smartphone },
    { id: "crypto", label: "USDT", icon: Bitcoin },
    { id: "card", label: "Card", icon: CreditCard },
  ];

  // Dynamic PayPal client ID from gateway config or env
  const dynamicPaypalClientId = currentGateway?.id === "card" && currentGateway.clientConfig?.paypalClientId
    ? currentGateway.clientConfig.paypalClientId
    : process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm safe-x">
      <div className="w-full sm:max-w-md max-h-[92dvh] sm:max-h-[90dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-white/[0.07] bg-[#1c2030] shadow-2xl safe-bottom">
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-white/[0.07] shrink-0">
          <h2 className="text-lg font-bold text-white">Deposit Funds</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Gateway Tabs */}
        <div className="flex border-b border-white/[0.07]">
          {tabs.map(({ id, label, icon: Icon }) => {
            const gw = gateways.find((g) => g.id === id);
            const isEnabled = gw ? gw.enabled : true;

            return (
              <button
                key={id}
                onClick={() => {
                  setTab(id);
                  reset();
                }}
                disabled={!isEnabled}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition relative ${
                  tab === id
                    ? "text-[#3B82F6] border-b-2 border-[#3B82F6]"
                    : isEnabled
                    ? "text-gray-500 hover:text-gray-300"
                    : "text-gray-600 opacity-40 cursor-not-allowed"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {!isEnabled && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-rose-500/80" title="Disabled by Admin" />
                )}
              </button>
            );
          })}
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain flex-1">
          {currentGateway && !currentGateway.enabled ? (
            <div className="py-8 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="text-sm font-semibold text-white">{currentGateway.name} is currently offline</p>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                This deposit method has been temporarily paused by the administrator. Please select another method.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Amount (USD) <span className="text-gray-400 font-semibold">· min ${activeMinDeposit.toFixed(2)}</span>
                  {currentGateway?.maxDeposit && (
                    <span className="text-gray-500"> · max ${currentGateway.maxDeposit.toFixed(2)}</span>
                  )}
                </label>
                <input
                  type="number"
                  min={activeMinDeposit}
                  max={currentGateway?.maxDeposit ?? 100000}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-[#13161e] border border-white/[0.07] text-white text-sm focus:outline-none focus:border-[#3B82F6]/50"
                />
                <div className="flex gap-1.5 mt-2">
                  {[10, 25, 50, 100, 200].map((v) => (
                    <button
                      key={v}
                      onClick={() => setAmount(v)}
                      className={`flex-1 py-1 rounded text-[10px] font-medium border transition ${
                        amount === v
                          ? "bg-[#1e3a5f] border-[#3B82F6] text-[#60a5fa]"
                          : "bg-[#13161e] text-gray-400 border-white/[0.07] hover:bg-white/5"
                      }`}
                    >
                      ${v}
                    </button>
                  ))}
                </div>
              </div>

              {currentGateway?.instructions && (
                <p className="text-[11px] text-gray-400 bg-white/[0.02] border border-white/[0.05] rounded-xl px-3 py-2">
                  {currentGateway.instructions}
                </p>
              )}

              {tab === "mpesa" && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    M-Pesa Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07XX XXX XXX"
                    className="w-full px-4 py-3 rounded-xl bg-[#13161e] border border-white/[0.07] text-white text-sm focus:outline-none focus:border-[#3B82F6]/50"
                  />
                  <p className="text-[10px] text-gray-500 mt-1.5">
                    You&apos;ll receive an STK push to complete payment in Kenyan Shillings (KES)
                  </p>
                </div>
              )}

              {tab === "crypto" && cryptoResult && cryptoResult.status === "pending" && (
                <div className="rounded-xl bg-[#13161e] border border-white/[0.07] p-4 space-y-3">
                  <p className="text-xs text-gray-400">
                    Send <span className="text-white font-bold">${cryptoResult.amount} USDT</span> via
                    TRC20 to:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[10px] text-emerald-400 break-all">
                      {cryptoResult.address}
                    </code>
                    <button
                      onClick={() => copyAddress(cryptoResult.address)}
                      className="p-2 rounded-lg hover:bg-white/5 text-gray-400"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500">Ref: {cryptoResult.reference}</p>
                  <input
                    type="text"
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    placeholder="Paste transaction hash"
                    className="w-full px-3 py-2 rounded-lg bg-[#1c2030] border border-white/[0.07] text-white text-xs"
                  />
                  <button
                    onClick={confirmCrypto}
                    disabled={loading || txHash.length < 10}
                    className="w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                    style={{ background: "#3B82F6" }}
                  >
                    Confirm Payment
                  </button>
                </div>
              )}

              {tab === "card" && (
                <div>
                  {dynamicPaypalClientId ? (
                    <PayPalScriptProvider
                      options={{
                        clientId: dynamicPaypalClientId,
                        currency: "USD",
                        intent: "capture",
                      }}
                    >
                      <PayPalButtons
                        style={{ layout: "vertical" }}
                        createOrder={handlePaypalCreateOrder}
                        onApprove={handlePaypalApprove}
                        onCancel={() => { setError(""); setMessage("Card payment cancelled"); }}
                        onError={(err) => {
                          console.error("PayPal onError:", err);
                          setError(`Card payment error: ${err instanceof Error ? err.message : String(err)}`);
                        }}
                      />
                    </PayPalScriptProvider>
                  ) : (
                    <p className="text-xs text-rose-400">Card payments are not configured</p>
                  )}
                  <p className="text-[10px] text-gray-500 mt-2 text-center">
                    Securely processed by PayPal
                  </p>
                </div>
              )}

              {error && <p className="text-xs text-rose-400">{error}</p>}
              {message && <p className="text-xs text-emerald-400">{message}</p>}

              {!cryptoResult && tab !== "card" && (
                <button
                  onClick={handleDeposit}
                  disabled={loading || amount < activeMinDeposit}
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-40"
                  style={{ background: "#3B82F6" }}
                >
                  {loading ? "Processing..." : `Deposit $${amount}`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}