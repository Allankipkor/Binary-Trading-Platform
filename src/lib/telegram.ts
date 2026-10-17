export interface TelegramAlertOptions {
  event: string;
  severity?: "INFO" | "HIGH" | "CRITICAL";
  status?: "SUCCESS" | "BLOCKED" | "FAILED";
  operator?: string;
  details?: string;
  req?: Request;
  overrideBotToken?: string;
  overrideChatId?: string;
}

/**
 * Extract client IP address safely from standard Edge/Proxy headers
 */
export function getClientIp(req?: Request): string {
  if (!req) return "Unknown IP";
  const headers = req.headers;
  const xff = headers.get("x-forwarded-for") || headers.get("X-Forwarded-For");
  if (xff) {
    const ips = xff.split(",");
    return ips[0].trim();
  }
  return (
    headers.get("x-real-ip") ||
    headers.get("X-Real-IP") ||
    headers.get("cf-connecting-ip") ||
    "Unknown IP"
  );
}

/**
 * Extract approximate location from Vercel / Cloudflare edge headers
 */
export function getClientLocation(req?: Request): string {
  if (!req) return "Unknown Location";
  const headers = req.headers;
  const country = headers.get("x-vercel-ip-country") || headers.get("cf-ipcountry") || "";
  const city = headers.get("x-vercel-ip-city") || "";
  const region = headers.get("x-vercel-ip-country-region") || "";
  const parts = [city, region, country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Unknown Location";
}

/**
 * Parse User-Agent into clean device & browser name
 */
export function getClientDevice(req?: Request): string {
  if (!req) return "Unknown Device";
  const ua = req.headers.get("user-agent") || "";
  if (!ua) return "Unknown Device";

  let os = "Unknown OS";
  if (/windows nt 10/i.test(ua)) os = "Windows 10/11";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/linux/i.test(ua)) os = "Linux";

  let browser = "Browser";
  if (/edg/i.test(ua)) browser = "Edge";
  else if (/chrome|crios/i.test(ua)) browser = "Chrome";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  else if (/opera|opr/i.test(ua)) browser = "Opera";

  return `${browser} on ${os}`;
}

/**
 * Check for SQL injection / script injection patterns
 */
export function isMaliciousPayload(str: string): boolean {
  if (!str) return false;
  return /('|"|--|;|\/\*|\*\/|union\s+select|or\s+1=1|exec\(|<script)/i.test(str);
}

// In-memory failed attempts tracking
const loginAttempts = new Map<string, { count: number; firstAttempt: number; lockedUntil: number }>();
export const MAX_LOGIN_ATTEMPTS = 5;
export const ATTEMPT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export function checkRateLimit(ip: string, identifier = ""): { allowed: boolean; remainingSeconds: number; attempts: number } {
  const now = Date.now();
  const keys = [ip, identifier ? `user:${identifier.toLowerCase()}` : null].filter(Boolean) as string[];

  for (const k of keys) {
    const record = loginAttempts.get(k);
    if (record) {
      if (record.lockedUntil && record.lockedUntil > now) {
        const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
        return { allowed: false, remainingSeconds, attempts: record.count };
      }
      if (now - record.firstAttempt > ATTEMPT_WINDOW_MS && (!record.lockedUntil || record.lockedUntil <= now)) {
        loginAttempts.delete(k);
      }
    }
  }

  return { allowed: true, remainingSeconds: 0, attempts: 0 };
}

export function recordFailedAttempt(ip: string, identifier = ""): { locked: boolean; remainingAttempts: number; lockoutMinutes: number } {
  const now = Date.now();
  const keys = [ip, identifier ? `user:${identifier.toLowerCase()}` : null].filter(Boolean) as string[];
  let isLocked = false;
  let remainingAttempts = MAX_LOGIN_ATTEMPTS;

  for (const k of keys) {
    let record = loginAttempts.get(k);
    if (!record || (now - record.firstAttempt > ATTEMPT_WINDOW_MS && (!record.lockedUntil || record.lockedUntil <= now))) {
      record = { count: 1, firstAttempt: now, lockedUntil: 0 };
    } else {
      record.count += 1;
    }

    if (record.count >= MAX_LOGIN_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_DURATION_MS;
      isLocked = true;
      remainingAttempts = 0;
    } else {
      remainingAttempts = Math.min(remainingAttempts, MAX_LOGIN_ATTEMPTS - record.count);
    }

    loginAttempts.set(k, record);
  }

  return { locked: isLocked, remainingAttempts, lockoutMinutes: 15 };
}

export function resetRateLimit(ip: string, identifier = ""): void {
  if (ip) loginAttempts.delete(ip);
  if (identifier) loginAttempts.delete(`user:${identifier.toLowerCase()}`);
}

/**
 * Dispatch real-time security alerts directly to Telegram Bot
 */
export async function sendTelegramSecurityAlert({
  event,
  severity = "HIGH",
  status = "SUCCESS",
  operator = "admin",
  details = "",
  req,
  overrideBotToken = "",
  overrideChatId = "",
}: TelegramAlertOptions): Promise<{ sent: boolean; reason?: string; error?: string }> {
  const ip = getClientIp(req);
  const location = getClientLocation(req);
  const device = getClientDevice(req);
  const timestamp =
    new Date().toLocaleString("en-GB", { timeZone: "Africa/Nairobi" }) + " EAT";

  const botToken =
    overrideBotToken ||
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.TELEGRAM_TOKEN ||
    "";
  const chatId =
    overrideChatId ||
    process.env.TELEGRAM_CHAT_ID ||
    process.env.TELEGRAM_ADMIN_CHAT_ID ||
    "";

  const alertsEnabled = process.env.TELEGRAM_ALERTS_ENABLED !== "false";

  if (!alertsEnabled) {
    return { sent: false, reason: "Telegram alerts are disabled in settings" };
  }
  if (!botToken || !chatId) {
    return { sent: false, reason: "Missing Telegram Bot Token or Chat ID" };
  }

  const icon =
    severity === "CRITICAL" ? "🚨🚨" : severity === "HIGH" ? "⚠️" : "🛡️";
  const statusIcon = status === "SUCCESS" ? "✅" : status === "BLOCKED" ? "🛑" : "❌";

  let message = `${icon} *[SECURITY ALERT]*\n\n`;
  message += `*Event:* ${event}\n`;
  message += `*Status:* ${statusIcon} ${status}\n`;
  message += `*Severity:* ${severity}\n`;
  if (operator) message += `*Account:* \`${operator}\`\n`;
  message += `*IP Address:* \`${ip}\`\n`;
  if (location && location !== "Unknown Location") message += `*Location:* ${location}\n`;
  message += `*Device:* ${device}\n`;
  message += `*Time:* ${timestamp}\n`;
  if (details) {
    message += `\n*Details:*\n${details}\n`;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });
    const data = await res.json();
    return { sent: Boolean(data.ok), error: data.description };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Telegram alert dispatch error:", errorMsg);
    return { sent: false, error: errorMsg };
  }
}
