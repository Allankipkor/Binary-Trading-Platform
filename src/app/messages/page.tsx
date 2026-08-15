"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Search,
  MessageSquare,
  ArrowLeft,
  Download,
  Trash2,
  MoreVertical,
} from "lucide-react";

interface DBMessage {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

interface Thread {
  id: string;
  title: string;
  avatarColor: string;
  initials?: string;
  isFake: boolean;
  messages: {
    id: string;
    body: string;
    createdAt: string;
    read: boolean;
  }[];
  unreadCount: number;
  timeLabel: string;
}

function formatThreadTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  
  // Check if same day
  if (date.toDateString() === now.toDateString()) {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  }
  
  // Check if within last 7 days
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) {
    return date.toLocaleDateString(undefined, { weekday: "short" });
  }
  
  // Fallback to MM/DD/YY
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear().toString().slice(-2);
  return `${day}/${month}/${year}`;
}

function formatBubbleDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const timeStr = `${hours}:${minutes} ${ampm}`;
  
  if (diffDays === 0) {
    return `Today • ${timeStr}`;
  } else if (diffDays === 1) {
    return `Yesterday • ${timeStr}`;
  } else if (diffDays < 7) {
    const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
    return `${weekday} • ${timeStr}`;
  } else {
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year} • ${timeStr}`;
  }
}

export default function MessagesPage() {
  const router = useRouter();
  const { status: sessionStatus } = useSession();

  // State
  const [dbMessages, setDbMessages] = useState<DBMessage[]>([]);
  const [, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/login");
    }
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }
  }, [sessionStatus, router]);

  // Fetch messages from database
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/messages");
      if (res.ok) {
        const data = await res.json();
        setDbMessages(data.messages || []);
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
      // Poll database for new messages every 3 seconds (real-time sync)
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [sessionStatus, fetchMessages]);

  // Mark all messages for a specific sender as read
  const markThreadAsRead = async (title: string) => {
    try {
      const res = await fetch(`/api/messages?title=${title}`, {
        method: "PATCH",
      });
      if (res.ok) {
        fetchMessages();
      }
    } catch (e) {
      console.error("Failed to mark thread as read", e);
    }
  };

  // Scroll to bottom of active conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeThreadId, dbMessages]);

  // Download Backup text file
  const handleDownloadBackup = () => {
    if (dbMessages.length === 0) return;
    
    let fileContent = "MPESA TRANSACTION MESSAGES BACKUP\n";
    fileContent += `Generated on: ${new Date().toLocaleString()}\n`;
    fileContent += "========================================\n\n";

    dbMessages.forEach((msg) => {
      fileContent += `FROM: ${msg.title}\n`;
      fileContent += `DATE: ${new Date(msg.createdAt).toLocaleString()}\n`;
      fileContent += `BODY: ${msg.body}\n`;
      fileContent += "----------------------------------------\n\n";
    });

    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Mpesa_Messages_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Clear Inbox database logs
  const handleClearInbox = async () => {
    if (!confirm("Clear all real transaction messages? This cannot be undone.")) return;
    try {
      const res = await fetch("/api/messages", { method: "DELETE" });
      if (res.ok) {
        setDbMessages([]);
        setActiveThreadId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Compile full thread list (Fake ones from user screenshot + real DB ones)
  const getThreads = (): Thread[] => {
    const realMpesaMessages = dbMessages.filter((m) => m.title === "MPESA");
    const realBankMessages = dbMessages.filter((m) => m.title === "BANK");

    const threads: Thread[] = [];

    // 1. Globalpay
    threads.push({
      id: "globalpay",
      title: "Globalpay",
      avatarColor: "bg-[#f58220]", // Orange
      isFake: true,
      unreadCount: 65,
      timeLabel: "Sun",
      messages: [{
        id: "gp1",
        body: "Dear customer, we are unable to process your transaction on FACEBK. Please verify details.",
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        read: false
      }]
    });

    // 2. MPESA (Dynamic / Real DB logs)
    if (realMpesaMessages.length > 0) {
      const latestMsg = realMpesaMessages[0];
      const unreadCount = realMpesaMessages.filter((m) => !m.read).length;
      threads.push({
        id: "mpesa",
        title: "MPESA",
        avatarColor: "bg-[#ffcc00]", // Yellow
        isFake: false,
        unreadCount,
        timeLabel: new Date(latestMsg.createdAt).toLocaleDateString(undefined, { weekday: "short" }),
        messages: [...realMpesaMessages].reverse().map((m) => ({
          id: m.id,
          body: m.body,
          createdAt: m.createdAt,
          read: m.read
        }))
      });
    } else {
      threads.push({
        id: "mpesa",
        title: "MPESA",
        avatarColor: "bg-[#ffcc00]", // Yellow
        isFake: true,
        unreadCount: 1,
        timeLabel: "Sun",
        messages: [{
          id: "mp1",
          body: "Dear customer, you do not have sufficient funds to complete this transaction. Please top up your account.",
          createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
          read: false
        }]
      });
    }

    // 3. Safaricom
    threads.push({
      id: "safaricom",
      title: "Safaricom",
      avatarColor: "bg-[#f58220]", // Orange
      isFake: true,
      unreadCount: 10,
      timeLabel: "Sun",
      messages: [{
        id: "sf1",
        body: "Do more with Safaricom data. You have purchased 50MB valid for 24hr. Dial *544# to manage subscription.",
        createdAt: new Date(Date.now() - 3600000 * 25).toISOString(),
        read: false
      }]
    });

    // 4. mySafApp
    threads.push({
      id: "mysafapp",
      title: "mySafApp",
      avatarColor: "bg-[#ec4899]", // Pink
      isFake: true,
      unreadCount: 7,
      timeLabel: "Sun",
      messages: [{
        id: "ms1",
        body: "<#> Please enter this One Time PIN: 3995 to log onto your mySafaricom App. Do not share your PIN.",
        createdAt: new Date(Date.now() - 3600000 * 30).toISOString(),
        read: false
      }]
    });

    // 5. airtelmoney
    threads.push({
      id: "airtelmoney",
      title: "airtelmoney",
      avatarColor: "bg-[#ffcc00]", // Yellow
      isFake: true,
      unreadCount: 31,
      timeLabel: "Sat",
      messages: [{
        id: "am1",
        body: "B3PHQ3WQ1C9. Ksh 60 paid to Lipa Na Mpesa via Airtel Money on 27/7/26 at 4:10 PM. Thank you.",
        createdAt: new Date(Date.now() - 3600000 * 36).toISOString(),
        read: false
      }]
    });

    // 6. AirtelMoney
    threads.push({
      id: "airtelmoney2",
      title: "AirtelMoney",
      avatarColor: "bg-[#ffcc00]", // Yellow
      isFake: true,
      unreadCount: 6,
      timeLabel: "Sat",
      messages: [{
        id: "am2",
        body: "Congratulations! You have received KES 5.65 in your BONUS wallet. To check your balance, dial *222#.",
        createdAt: new Date(Date.now() - 3600000 * 40).toISOString(),
        read: false
      }]
    });

    // 7. AIRTEL
    threads.push({
      id: "airtel",
      title: "AIRTEL",
      avatarColor: "bg-[#ec4899]", // Pink
      isFake: true,
      unreadCount: 5,
      timeLabel: "Sat",
      messages: [{
        id: "at1",
        body: "Dear customer you have successfully subscribed to the Amazing 1GB, Valid for 24 Hours. Enjoy browsing.",
        createdAt: new Date(Date.now() - 3600000 * 45).toISOString(),
        read: false
      }]
    });

    // 8. Equity Bank
    threads.push({
      id: "equity",
      title: "Equity Bank",
      avatarColor: "bg-[#ec4899]", // Pink
      isFake: true,
      unreadCount: 0,
      timeLabel: "Sat",
      messages: [{
        id: "eq1",
        body: "Confirmed. Payment of KES. 70.00 to MARY WANJIKU WAWERU has been processed. Trans ID: EQY7829281.",
        createdAt: new Date(Date.now() - 3600000 * 50).toISOString(),
        read: true
      }]
    });

    // 9. Real BANK Database messages if exist
    if (realBankMessages.length > 0) {
      const latestMsg = realBankMessages[0];
      const unreadCount = realBankMessages.filter((m) => !m.read).length;
      threads.push({
        id: "bank",
        title: "BANK",
        avatarColor: "bg-[#ec4899]",
        isFake: false,
        unreadCount,
        timeLabel: new Date(latestMsg.createdAt).toLocaleDateString(undefined, { weekday: "short" }),
        messages: [...realBankMessages].reverse().map((m) => ({
          id: m.id,
          body: m.body,
          createdAt: m.createdAt,
          read: m.read
        }))
      });
    }

    // 10. Airtel
    threads.push({
      id: "airtel_lowercase",
      title: "Airtel",
      avatarColor: "bg-[#10b981]", // Green
      isFake: true,
      unreadCount: 1,
      timeLabel: "Sat",
      messages: [{
        id: "at2",
        body: "You have received KSH.20 Airtime from Safaricom. Enjoy communication.",
        createdAt: new Date(Date.now() - 3600000 * 60).toISOString(),
        read: false
      }]
    });

    // Format all thread time labels dynamically and sort threads descending by latest message
    threads.forEach((t) => {
      if (t.messages.length > 0) {
        const latestMessage = t.messages[t.messages.length - 1];
        t.timeLabel = formatThreadTime(latestMessage.createdAt);
      }
    });

    threads.sort((a, b) => {
      const aTime = new Date(a.messages[a.messages.length - 1].createdAt).getTime();
      const bTime = new Date(b.messages[b.messages.length - 1].createdAt).getTime();
      return bTime - aTime;
    });

    return threads;
  };

  const threads = getThreads();

  // Handle active thread selection
  const selectThread = (thread: Thread) => {
    setActiveThreadId(thread.id);
    if (!thread.isFake) {
      markThreadAsRead(thread.title);
    }
  };

  const activeThread = threads.find((t) => t.id === activeThreadId);

  // Filter threads by search input
  const filteredThreads = threads.filter((t) => {
    const q = searchTerm.toLowerCase();
    const matchesTitle = t.title.toLowerCase().includes(q);
    const matchesBody = t.messages.some((m) => m.body.toLowerCase().includes(q));
    return matchesTitle || matchesBody;
  });

  return (
    <div className="h-screen overflow-hidden bg-[#f8fafd] text-[#1f1f1f] flex flex-col font-sans selection:bg-[#3B82F6]/20">
      
      {/* Messages App Shell (simulates desktop mobile wrapper, behaves responsive) */}
      <div className="h-full max-w-[500px] w-full mx-auto bg-white shadow-lg overflow-hidden relative flex flex-col border-x border-gray-200">
        
        {/* VIEW 1: THREAD LIST (Shows if no active thread is open) */}
        <div className={`flex-grow flex flex-col relative h-full w-full ${activeThreadId ? "hidden" : "flex"}`}>
          
          {/* Google Messages Custom Header */}
          {showSearch ? (
            <div className="flex items-center gap-3 bg-white h-14 px-4 w-full border-b border-gray-100 animate-[slideDown_0.15s_ease-out]">
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchTerm("");
                }}
                className="p-1 rounded-full text-gray-500 hover:bg-gray-100 transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <input
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search messages..."
                className="w-full bg-transparent border-none text-[15px] outline-none text-[#1f1f1f] placeholder:text-gray-400 h-8"
              />
            </div>
          ) : (
            <div className="flex items-center justify-between h-14 px-5 bg-white border-b border-gray-100">
              <span className="text-[20px] font-semibold tracking-tight select-none">
                <span className="text-[#4285F4]">G</span>
                <span className="text-[#EA4335]">o</span>
                <span className="text-[#FBBC05]">o</span>
                <span className="text-[#4285F4]">g</span>
                <span className="text-[#34A853]">l</span>
                <span className="text-[#EA4335]">e</span>
                <span className="text-[#5f6368] font-normal"> Messages</span>
              </span>
              <div className="flex items-center gap-3.5">
                <button
                  onClick={() => setShowSearch(true)}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-700 transition"
                >
                  <Search className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowProfileMenu(true)}
                  className="w-7 h-7 rounded-full bg-[#f58220] flex items-center justify-center text-xs font-black text-white shrink-0 shadow-sm hover:brightness-95 transition"
                >
                  A
                </button>
              </div>
            </div>
          )}

          {/* Threads list container */}
          <div className="flex-grow overflow-y-auto scroll-smooth divide-y divide-transparent px-1 pb-24">
            {filteredThreads.map((t) => {
              const latestMessage = t.messages[t.messages.length - 1];
              return (
                <button
                  key={t.id}
                  onClick={() => selectThread(t)}
                  className="w-full px-5 py-3 text-left transition flex gap-4 items-center hover:bg-gray-100/60"
                >
                  {/* Person profile circle icon */}
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${t.avatarColor}`}>
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  
                  {/* Text details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className={`text-[14px] ${t.unreadCount > 0 ? "font-bold text-black" : "font-semibold text-gray-900"}`}>
                        {t.title}
                      </span>
                      <span className={`text-[11px] ${t.unreadCount > 0 ? "font-bold text-[#1a73e8]" : "text-gray-500"}`}>
                        {t.timeLabel}
                      </span>
                    </div>
                    <p className={`text-[13px] truncate line-clamp-1 pr-4 ${t.unreadCount > 0 ? "font-semibold text-gray-900" : "text-gray-500"}`}>
                      {latestMessage?.body}
                    </p>
                  </div>

                  {/* Google Messages blue unread count circle badge */}
                  {t.unreadCount > 0 && (
                    <div className="w-5 h-5 rounded-full bg-[#1a73e8] text-[10px] font-bold text-white flex items-center justify-center shrink-0">
                      {t.unreadCount}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Start chat floating action button (FAB) */}
          <div className="absolute bottom-5 right-5 z-10">
            <button className="flex items-center gap-2 bg-[#c2e7ff] hover:bg-[#b0dbf7] text-[#001d35] px-5 py-4 rounded-2xl shadow-lg transition">
              <MessageSquare className="w-5 h-5" />
              <span className="text-[14px] font-semibold tracking-wide">Start chat</span>
            </button>
          </div>

        </div>

        {/* VIEW 2: CHAT CONVERSATION THREAD */}
        {activeThread && (
          <div className="flex-grow flex flex-col h-full bg-white w-full relative overflow-hidden">
            
            {/* Thread Header */}
            <header className="absolute top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 flex items-center px-4 justify-between z-20 select-none">
              <div className="flex items-center gap-3.5">
                <button
                  onClick={() => {
                    setActiveThreadId(null);
                    fetchMessages();
                  }}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-800 transition shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${activeThread.avatarColor}`}>
                    <svg className="w-4.5 h-4.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h2 className="text-[18px] font-medium text-[#1f1f1f]">{activeThread.title}</h2>
                </div>
              </div>

              {/* More options menu button */}
              <div className="flex items-center">
                <button className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600 transition">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </header>

            {/* Bubble list thread */}
            <div className="flex-grow overflow-y-auto scroll-smooth pt-14 pb-4 px-4 relative">
              <div className="space-y-4 flex flex-col min-h-full justify-end">
                {activeThread.messages.map((m) => (
                  <div key={m.id} className="flex flex-col gap-2">
                    {/* Timestamp bubble */}
                    <div className="text-center my-1.5 select-none">
                      <span className="text-[11px] text-gray-500 font-medium">
                        {formatBubbleDate(m.createdAt)}
                      </span>
                    </div>

                    {/* Chat Content layout (includes Safaricom card attachments if MPESA) */}
                    <div className="flex items-center gap-2 justify-start max-w-[85%] my-1.5 w-full relative">
                      {/* Main Message Bubble */}
                      <div className="bg-[#f1f3f4] text-[#1f1f1f] rounded-[1.25rem] overflow-hidden flex flex-col w-full border border-gray-200/40 shadow-sm">
                        {/* 1. Message text */}
                        <div className="px-4 py-3 text-[13.5px] leading-relaxed select-text font-sans">
                          {m.body}
                        </div>

                        {activeThread.title === "MPESA" && (
                          /* 'Tap to load preview' attachment preview box matching standard Google Messages */
                          <div 
                            onClick={handleDownloadBackup}
                            className="w-full flex flex-col items-center justify-center gap-1.5 py-4 bg-[#f8f9fa] hover:bg-[#f1f3f4] border-t border-gray-200/80 select-none cursor-pointer transition text-center"
                          >
                            <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                              {/* circular reload/refresh icon */}
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                            <span className="text-[12.5px] font-semibold text-gray-700">Tap to load preview</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Locked footer: Sender does not accept replies */}
            <div className="bg-[#f8fafd] px-4 py-4 flex flex-col items-center gap-2 border-t border-gray-200 shadow-[0_-2px_6px_rgba(0,0,0,0.01)]">
              <div className="bg-[#e9eef6] text-[#1f1f1f] text-[13px] leading-relaxed rounded-2xl px-5 py-3.5 text-center max-w-[92%] select-none font-medium">
                Sender can&apos;t accept replies. Contact them directly. <span className="text-[#1a73e8] hover:underline cursor-pointer font-semibold underline decoration-1 underline-offset-2">Learn more</span>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Google Account Profile Menu Modal */}
      {showProfileMenu && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 backdrop-blur-sm p-4 pt-16" onClick={() => setShowProfileMenu(false)}>
          <div className="w-full max-w-[320px] bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-2xl p-4 space-y-4 animate-[slideDown_0.15s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Account Options</span>
              <button onClick={() => setShowProfileMenu(false)} className="text-gray-400 hover:text-gray-600 text-xs font-bold">Close</button>
            </div>
            
            <div className="flex items-center gap-3 py-1">
              <div className="w-10 h-10 rounded-full bg-[#f58220] flex items-center justify-center text-sm font-black text-white">
                A
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">Shabiki User</p>
                <p className="text-xs text-gray-500">Live Trading Account</p>
              </div>
            </div>

            <div className="space-y-1 pt-2">
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  router.push("/withdraw");
                }}
                className="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-xl transition font-medium flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4 text-gray-500" />
                Back to Shabiki Markets
              </button>
              
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  handleDownloadBackup();
                }}
                className="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-xl transition font-medium flex items-center gap-2"
              >
                <Download className="w-4 h-4 text-gray-500" />
                Download Backup (.txt)
              </button>

              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  handleClearInbox();
                }}
                className="w-full px-3 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50 rounded-xl transition font-medium flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                Clear Message Logs
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
