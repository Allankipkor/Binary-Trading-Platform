"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  MessageSquare,
  ShieldCheck,
  Smartphone,
  Send,
} from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface SecretSetupContextType {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  handleLogoTap: (e?: React.MouseEvent | React.TouchEvent) => void;
  notificationPermission: NotificationPermission | "unsupported";
  canInstall: boolean;
  isInstalled: boolean;
  requestNotifications: () => Promise<void>;
  installApp: () => Promise<void>;
  sendTestAlert: () => Promise<void>;
}

const SecretSetupContext = createContext<SecretSetupContextType | null>(null);

export function useSecretSetup() {
  const context = useContext(SecretSetupContext);
  if (!context) {
    throw new Error("useSecretSetup must be used within a SecretSetupProvider");
  }
  return context;
}

export function SecretSetupProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const tapTimesRef = useRef<number[]>([]);

  // Update permission status on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      if ("Notification" in window) {
        setNotificationPermission(Notification.permission);
      } else {
        setNotificationPermission("unsupported");
      }

      // Check if running in standalone/installed mode
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsInstalled(isStandalone);

      // Intercept and SUPPRESS browser default PWA install prompt
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault(); // Prevents casual visitors from seeing the install popup!
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setCanInstall(true);
      };

      // Listen for app installed event
      const handleAppInstalled = () => {
        setIsInstalled(true);
        setCanInstall(false);
        setDeferredPrompt(null);
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.addEventListener("appinstalled", handleAppInstalled);

      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.removeEventListener("appinstalled", handleAppInstalled);
      };
    }
  }, []);

  // Dynamically attach manifest only when secret modal is open
  useEffect(() => {
    if (typeof document !== "undefined") {
      if (isOpen) {
        let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
        if (!link) {
          link = document.createElement("link");
          link.rel = "manifest";
          link.href = "/manifest.json?v=3";
          link.id = "secret-manifest";
          document.head.appendChild(link);
        }
      } else {
        if (window.location.pathname !== "/messages") {
          const dynamicLink = document.getElementById("secret-manifest");
          if (dynamicLink) {
            dynamicLink.remove();
          }
        }
      }
    }
  }, [isOpen]);

  // 5-tap gesture handler for the ShabikiMarket Logo
  const handleLogoTap = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    // Keep taps that occurred within the last 2.5 seconds
    tapTimesRef.current = tapTimesRef.current.filter((t) => now - t < 2500);
    tapTimesRef.current.push(now);

    if (tapTimesRef.current.length >= 5) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      tapTimesRef.current = [];
      setIsOpen(true);
      setStatusMessage(null);
    }
  }, []);

  // Request Notification Permission & Register Service Worker
  const requestNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setStatusMessage("Notifications are not supported in this browser.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === "granted") {
        if ("serviceWorker" in navigator) {
          await navigator.serviceWorker.register("/sw.js");
        }
        setStatusMessage("Notifications successfully enabled on this device!");
      } else if (permission === "denied") {
        setStatusMessage("Notification permission was denied. Please allow it in browser settings.");
      }
    } catch (err) {
      console.error(err);
      setStatusMessage("Failed to request notification permission.");
    }
  };

  // Trigger PWA Installation
  const installApp = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsInstalled(true);
          setCanInstall(false);
          setDeferredPrompt(null);
          setStatusMessage("Messages App installed successfully!");
        } else {
          setStatusMessage("Installation cancelled.");
        }
      } catch (err) {
        console.error(err);
        setStatusMessage("Could not launch installation prompt.");
      }
    } else {
      // Guide for iOS Safari or browsers without beforeinstallprompt
      setStatusMessage(
        "To install on iOS/Safari: Tap the Share button in your browser, then choose 'Add to Home Screen'."
      );
    }
  };

  // Send Test Notification
  const sendTestAlert = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setStatusMessage("Notifications not supported.");
      return;
    }

    if (Notification.permission !== "granted") {
      setStatusMessage("Please enable notifications first.");
      return;
    }

    const testBody = `QA94KD9812 Confirmed. You have received Ksh 13,000.00 from SHABIKIMARKET PAYMENTS KENYA LIMITED. New M-PESA balance is Ksh 45,210.00.`;

    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        registration.showNotification("MPESA", {
          body: testBody,
          icon: "/icons/google-messages-192.png",
          badge: "/icons/google-messages-badge.svg",
          vibrate: [200, 100, 200],
          tag: "mpesa-test",
        } as NotificationOptions);
      } else {
        new Notification("MPESA", {
          body: testBody,
          icon: "/icons/google-messages-192.png",
        });
      }
      setStatusMessage("Test push notification sent! Check your notification bar.");
    } catch (e) {
      console.error("Test notification failed:", e);
      try {
        new Notification("MPESA", {
          body: testBody,
          icon: "/icons/google-messages-192.png",
        });
        setStatusMessage("Test push notification sent!");
      } catch (err) {
        console.error(err);
        setStatusMessage("Failed to display notification.");
      }
    }
  };

  return (
    <SecretSetupContext.Provider
      value={{
        isOpen,
        openModal: () => setIsOpen(true),
        closeModal: () => setIsOpen(false),
        handleLogoTap,
        notificationPermission,
        canInstall,
        isInstalled,
        requestNotifications,
        installApp,
        sendTestAlert,
      }}
    >
      {children}

      {/* Secret Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
          <div
            className="relative w-full max-w-md bg-[#0e121d] border border-white/15 rounded-3xl p-6 shadow-2xl text-white space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white leading-snug">
                    Secret Device Setup
                  </h2>
                  <p className="text-xs text-gray-400">Authorized alerts & Messages app</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Device Status Badges */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-[#141a29] border border-white/5 rounded-2xl p-3">
                <span className="text-[11px] text-gray-400 block mb-1">Notifications</span>
                {notificationPermission === "granted" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Granted
                  </span>
                ) : notificationPermission === "denied" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="w-3.5 h-3.5" /> Blocked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    <Bell className="w-3.5 h-3.5" /> Not Enabled
                  </span>
                )}
              </div>

              <div className="bg-[#141a29] border border-white/5 rounded-2xl p-3">
                <span className="text-[11px] text-gray-400 block mb-1">Messages PWA</span>
                {isInstalled ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <Smartphone className="w-3.5 h-3.5" /> Installed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                    <Download className="w-3.5 h-3.5" /> Ready
                  </span>
                )}
              </div>
            </div>

            {/* Status Feedback Message */}
            {statusMessage && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-xs text-blue-300 leading-relaxed">
                {statusMessage}
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2.5">
              {/* 1. Enable Push Notifications */}
              <button
                onClick={requestNotifications}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition shadow-lg shadow-blue-600/20"
              >
                <div className="flex items-center gap-2.5">
                  <Bell className="w-4 h-4" />
                  <span>Enable Push Notifications</span>
                </div>
                {notificationPermission === "granted" && (
                  <CheckCircle2 className="w-4 h-4 text-white" />
                )}
              </button>

              {/* 2. Install Messages App */}
              <button
                onClick={installApp}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-[#182032] hover:bg-[#202b44] border border-white/10 text-white text-sm font-semibold transition"
              >
                <div className="flex items-center gap-2.5">
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Install &quot;Messages&quot; App (PWA)</span>
                </div>
                {isInstalled && (
                  <span className="text-xs text-emerald-400 font-medium">Installed</span>
                )}
              </button>

              {/* 3. Send Test M-Pesa Alert */}
              <button
                onClick={sendTestAlert}
                disabled={notificationPermission !== "granted"}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-[#141a29] hover:bg-[#1b2337] border border-white/5 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 hover:text-white text-sm font-medium transition"
              >
                <div className="flex items-center gap-2.5">
                  <Send className="w-4 h-4 text-amber-400" />
                  <span>Send Test M-Pesa Alert</span>
                </div>
                <span className="text-[11px] text-gray-500">Test Alert</span>
              </button>

              {/* 4. Open Messages Inbox directly */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push("/messages");
                }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-[#141a29] hover:bg-[#1b2337] border border-white/5 text-gray-300 hover:text-white text-sm font-medium transition"
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                  <span>Open Messages Inbox</span>
                </div>
                <span className="text-[11px] text-gray-500">/messages</span>
              </button>
            </div>

            {/* Footer / Instructions */}
            <div className="pt-2 text-center">
              <p className="text-[11px] text-gray-500">
                To reopen this menu anytime, tap the <span className="text-blue-400 font-bold">SHABIKIMARKET</span> logo 5 times.
              </p>
            </div>
          </div>
        </div>
      )}
    </SecretSetupContext.Provider>
  );
}
