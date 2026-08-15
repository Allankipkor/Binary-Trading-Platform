import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

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

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
          role,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
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
