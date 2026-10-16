import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

const useSecureCookies = process.env.NODE_ENV === "production" || process.env.NEXTAUTH_URL?.startsWith("https://") || true;
const cookiePrefix = useSecureCookies ? "__Secure-" : "";

import {
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  isMaliciousPayload,
  sendTelegramSecurityAlert,
  getClientIp,
} from "@/lib/telegram";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = String(credentials.email).trim();
        const password = String(credentials.password).trim();
        const ip = req instanceof Request ? getClientIp(req) : "WebClient";

        // 1. Attack payload / Injection detection heuristic
        if (isMaliciousPayload(email) || isMaliciousPayload(password)) {
          sendTelegramSecurityAlert({
            event: "Malicious Attack / Injection Attempt Blocked",
            severity: "CRITICAL",
            status: "BLOCKED",
            operator: email.slice(0, 50),
            details: `• Detected Payload: \`${email.slice(0, 100)}\`\n• Source IP: \`${ip}\``,
            req: req instanceof Request ? req : undefined,
          }).catch(() => {});
          return null;
        }

        // 2. Brute-force rate limiting & 15-minute account lockout
        const rateCheck = checkRateLimit(ip, email);
        if (!rateCheck.allowed) {
          sendTelegramSecurityAlert({
            event: "Brute Force Lockout Enforced",
            severity: "CRITICAL",
            status: "BLOCKED",
            operator: email,
            details: `IP \`${ip}\` exceeded maximum failed attempts.\nLocked out for ${Math.ceil(rateCheck.remainingSeconds / 60)} minutes.`,
            req: req instanceof Request ? req : undefined,
          }).catch(() => {});
          throw new Error("Too many failed attempts. Access is locked for 15 minutes.");
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          const fail = recordFailedAttempt(ip, email);
          if (fail.locked) {
            sendTelegramSecurityAlert({
              event: "Brute Force Lockout Triggered",
              severity: "CRITICAL",
              status: "BLOCKED",
              operator: email,
              details: `Account \`${email}\` locked out after consecutive failed attempts.`,
              req: req instanceof Request ? req : undefined,
            }).catch(() => {});
          }
          return null;
        }

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
          const fail = recordFailedAttempt(ip, email);
          const ADMIN_CHECK_EMAILS = [
            "admin@shabikimarket@gmail.com",
            "admin.shabikimarket@gmail.com",
            "admin@shabikimarket.com",
            "shabikimarket@gmail.com",
            "allankipkorir68@gmail.com",
            (process.env.ADMIN_EMAIL || "").toLowerCase().trim(),
          ].filter(Boolean);

          if (ADMIN_CHECK_EMAILS.includes(email.toLowerCase()) || user.role === "admin") {
            sendTelegramSecurityAlert({
              event: "Failed Admin Login Attempt",
              severity: "HIGH",
              status: "BLOCKED",
              operator: email,
              details: `Incorrect password submitted for administrative account (${fail.remainingAttempts} attempts remaining before temporary lockout).`,
              req: req instanceof Request ? req : undefined,
            }).catch(() => {});
          }

          return null;
        }

        // Reset failed attempt counter upon successful login
        resetRateLimit(ip, email);

        const ADMIN_EMAILS = [
          "admin@shabikimarket@gmail.com",
          "admin.shabikimarket@gmail.com",
          "admin@shabikimarket.com",
          "shabikimarket@gmail.com",
          "allankipkorir68@gmail.com",
          (process.env.ADMIN_EMAIL || "").toLowerCase().trim(),
        ].filter(Boolean);

        let role = user.role;
        if (ADMIN_EMAILS.includes(user.email.toLowerCase().trim()) && role !== "admin") {
          role = "admin";
          await prisma.user.update({
            where: { id: user.id },
            data: { role: "admin" },
          }).catch(() => {});
        }

        // Dispatch alert on successful administrator login
        if (role === "admin") {
          sendTelegramSecurityAlert({
            event: "Admin Portal Login Successful",
            severity: "INFO",
            status: "SUCCESS",
            operator: user.email,
            details: `Operator \`${user.email}\` successfully authenticated to admin console.`,
            req: req instanceof Request ? req : undefined,
          }).catch(() => {});
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
          role,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days persistent session
    updateAge: 24 * 60 * 60, // 24 hours
  },
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        maxAge: 30 * 24 * 60 * 60, // 30 days
      },
    },
    callbackUrl: {
      name: `${cookiePrefix}authjs.callback-url`,
      options: {
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        maxAge: 30 * 24 * 60 * 60,
      },
    },
    csrfToken: {
      name: `${cookiePrefix}authjs.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        maxAge: 30 * 24 * 60 * 60,
      },
    },
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? undefined;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? null;
      }
      return session;
    },
  },
});
