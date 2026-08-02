"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ChevronLeft,
  Download,
  Trash2,
  Smartphone,
  Search,
  MessageSquare,
  ArrowLeft,
  DownloadCloud,
} from "lucide-react";

interface DBMessage {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function MessagesPage() {
  const router = useRouter();
  const { status: sessionStatus } = useSession();

  // State
  const [messages, setMessages] = useState<DBMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeMessage, setActiveMessage] = useState<DBMessage | null>(null);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // Auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/login");
    }
  }, [sessionStatus, router]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/messages");
      if (res.ok) {
        const data = await res.json();
        const msgList = data.messages || [];
        setMessages(msgList);
        setActiveMessage((prev) => prev || msgList[0] || null);
      }
    } catch (e) {
      console.error("Failed to load messages", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      fetchMessages();
    }
  }, [sessionStatus, fetchMessages]);

  // Scroll to bottom when active message changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessage]);

  // PWA triggers
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Check if app is installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstallable(false);
      setDeferredPrompt(null);
      setIsInstalled(true);
    }
  };

  // Download Backup
  const handleDownloadBackup = () => {
    if (messages.length === 0) return;
    
    let fileContent = "SHABIKIMARKET SMS TRANSACTION BACKUP\n";
    fileContent += `Generated on: ${new Date().toLocaleString()}\n`;
    fileContent += "========================================\n\n";

    messages.forEach((msg) => {
      fileContent += `FROM: ${msg.title}\n`;
      fileContent += `DATE: ${new Date(msg.createdAt).toLocaleString()}\n`;
      fileContent += `BODY: ${msg.body}\n`;
      fileContent += "----------------------------------------\n\n";
    });

    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mpesa_messages_backup_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Clear Inbox
  const handleClearInbox = async () => {
    if (!confirm("Are you sure you want to clear all message logs? This cannot be undone.")) return;
    try {
      const res = await fetch("/api/messages", { method: "DELETE" });
      if (res.ok) {
        setMessages([]);
        setActiveMessage(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filter messages
  const filteredMessages = messages.filter((m) => {
    const q = searchTerm.toLowerCase();
    return m.title.toLowerCase().includes(q) || m.body.toLowerCase().includes(q);
  });

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[#0a0c12] text-white flex flex-col items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-rose-500 border-t-transparent animate-spin mb-4" />
        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Syncing Message Database...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06080c] text-white flex flex-col selection:bg-rose-500/30">
      
      {/* Top navigation header */}
      <header className="h-14 border-b border-white/[0.05] bg-[#0a0c12]/95 backdrop-blur flex items-center justify-between px-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/withdraw")}
            className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
              <MessageSquare className="w-4 h-4 text-rose-400" />
            </div>
            <h1 className="text-sm font-bold">Simulated Message Inbox</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleDownloadBackup}
              title="Download Messages Backup"
              className="p-2 rounded-xl bg-[#0d0f17] border border-white/[0.07] hover:border-white/20 text-gray-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download Backup</span>
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={handleClearInbox}
              title="Clear Inbox"
              className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Main content body */}
      <div className="flex-1 flex max-w-6xl w-full mx-auto overflow-hidden relative min-h-[calc(100vh-3.5rem)]">
        
        {/* LEFT COLUMN: Message List */}
        <aside className={`w-full md:w-[360px] shrink-0 border-r border-white/[0.05] bg-[#0a0c12]/50 flex flex-col ${
          activeMessage && "hidden md:flex"
        }`}>
          {/* App Installation Prompt Banner */}
          {isInstallable && !isInstalled && (
            <div className="p-3 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between gap-3 animate-pulse">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300">Standalone App Available</span>
              </div>
              <button
                onClick={handleInstallApp}
                className="px-2.5 py-1 rounded bg-rose-500 hover:bg-rose-400 text-white font-black text-[9px] uppercase tracking-wider transition"
              >
                Install App
              </button>
            </div>
          )}

          {/* Search bar */}
          <div className="p-3">
            <div className="flex items-center gap-2 bg-[#141822] border border-white/[0.07] rounded-xl px-3 py-1.5">
              <Search className="w-4 h-4 text-gray-500 shrink-0" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search inbox..."
                className="w-full bg-transparent border-none text-xs text-white outline-none placeholder:text-gray-600 h-7"
              />
            </div>
          </div>

          {/* Thread List */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.03]">
            {filteredMessages.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500">
                No simulated messages in your database. Request a withdrawal to generate a confirmation.
              </div>
            ) : (
              filteredMessages.map((m) => {
                const isActive = activeMessage?.id === m.id;
                const initials = m.title.slice(0, 2).toUpperCase();
                return (
                  <button
                    key={m.id}
                    onClick={() => setActiveMessage(m)}
                    className={`w-full p-4 text-left transition flex gap-3 items-center ${
                      isActive ? "bg-white/[0.04]" : "hover:bg-white/[0.01]"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black uppercase shrink-0 ${
                      m.title === "MPESA"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20"
                    }`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span className="text-xs font-extrabold text-white">{m.title}</span>
                        <span className="text-[9px] text-gray-500 font-medium">
                          {new Date(m.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 truncate line-clamp-1">
                        {m.body}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* RIGHT COLUMN: Thread Details / Chat Screen */}
        <main className={`flex-1 flex flex-col bg-[#07090e] ${
          !activeMessage && "hidden md:flex justify-center items-center text-gray-500 text-xs"
        }`}>
          {activeMessage ? (
            <div className="flex-grow flex flex-col h-full relative">
              
              {/* Back button on mobile */}
              <div className="md:hidden h-12 border-b border-white/[0.04] bg-[#0a0c12]/40 flex items-center px-3 justify-between">
                <button
                  onClick={() => setActiveMessage(null)}
                  className="flex items-center gap-1.5 text-xs text-rose-400 font-bold"
                >
                  <ArrowLeft className="w-4 h-4" /> Inbox
                </button>
                <span className="text-xs font-bold text-white">{activeMessage.title}</span>
                <div className="w-10" />
              </div>

              {/* Chat Thread Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
                {/* Simulated timestamp header */}
                <div className="text-center">
                  <span className="px-2 py-0.5 bg-white/[0.03] border border-white/[0.05] rounded-full text-[9px] text-gray-500 uppercase tracking-widest font-bold">
                    Text Message — {new Date(activeMessage.createdAt).toLocaleString()}
                  </span>
                </div>

                {/* Bubble bubble wrapper */}
                <div className="flex flex-col gap-2.5 max-w-md mx-auto">
                  <div className="flex items-end gap-2.5 justify-start">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black uppercase shrink-0 ${
                      activeMessage.title === "MPESA"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20"
                    }`}>
                      {activeMessage.title.slice(0, 2)}
                    </div>
                    
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1 ml-1">
                        {activeMessage.title}
                      </span>
                      <div className="bg-[#141822] border border-white/[0.07] rounded-3xl rounded-bl-none px-4 py-3.5 shadow-xl relative text-xs text-gray-200 leading-relaxed font-mono whitespace-pre-wrap select-all">
                        {activeMessage.body}
                      </div>
                    </div>
                  </div>
                </div>

                <div ref={messagesEndRef} />
              </div>

              {/* Footer info message */}
              <div className="p-4 border-t border-white/[0.04] bg-[#0a0c12]/20 text-center">
                <p className="text-[10px] text-gray-500 font-medium">
                  This transaction record is securely stored in your database. Tap receipt block to select and copy text.
                </p>
              </div>

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-rose-500/5 flex items-center justify-center border border-rose-500/10">
                <DownloadCloud className="w-8 h-8 text-rose-500/40" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Select a Message</h3>
                <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
                  Choose a receipt notification from the inbox sidebar to view transaction codes and details.
                </p>
              </div>
            </div>
          )}
        </main>
        
      </div>
    </div>
  );
}
