import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function normaliseEmail(v: string) {
  return v.toLowerCase().trim();
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30,
    updateAge: 15 * 60,
  },

  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: { httpOnly: true, sameSite: "none", path: "/", secure: true },
    },
    callbackUrl: {
      name: "next-auth.callback-url",
      options: { sameSite: "none", path: "/", secure: true },
    },
    csrfToken: {
      name: "next-auth.csrf-token",
      options: { httpOnly: true, sameSite: "none", path: "/", secure: true },
    },
  },

  providers: [
    // ── Admin: OTP restricted to AllowedAdminEmail ──────────────────────────
    CredentialsProvider({
      id: "admin",
      name: "Admin Passcode",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        const emailRaw = credentials?.email;
        const codeRaw = credentials?.code;
        if (!emailRaw || !codeRaw) return null;

        const email = normaliseEmail(emailRaw);
        const code = String(codeRaw).trim();

        const allowed = await prisma.allowedAdminEmail.findUnique({
          where: { email },
          select: { email: true },
        });
        if (!allowed) return null;

        const codeHash = sha256(code);
        const now = new Date();

        const otp = await prisma.adminOtp.findFirst({
          where: { email, codeHash, usedAt: null, expiresAt: { gt: now } },
          orderBy: { createdAt: "desc" },
        });
        if (!otp) return null;

        await prisma.adminOtp.update({
          where: { id: otp.id },
          data: { usedAt: now },
        });

        const adminUser = await prisma.user.upsert({
          where: { email },
          update: { role: "ADMIN" },
          create: { email, role: "ADMIN" },
          select: { id: true, email: true, role: true },
        });

        return { id: adminUser.id, email: adminUser.email ?? email, role: adminUser.role };
      },
    }),

    // ── Member: OTP for users already registered via Cognito form ───────────
    CredentialsProvider({
      id: "member",
      name: "Member Passcode",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        const emailRaw = credentials?.email;
        const codeRaw = credentials?.code;
        if (!emailRaw || !codeRaw) return null;

        const email = normaliseEmail(emailRaw);
        const code = String(codeRaw).trim();

        // Only users already in the User table with role MEMBER can sign in.
        const member = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, role: true },
        });
        if (!member || member.role !== "MEMBER") return null;

        const codeHash = sha256(code);
        const now = new Date();

        const otp = await prisma.memberOtp.findFirst({
          where: { email, codeHash, usedAt: null, expiresAt: { gt: now } },
          orderBy: { createdAt: "desc" },
        });
        if (!otp) return null;

        await prisma.memberOtp.update({
          where: { id: otp.id },
          data: { usedAt: now },
        });

        return { id: member.id, email: member.email ?? email, role: member.role };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: UserRole }).role ?? "MEMBER";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as UserRole | undefined) ?? "MEMBER";
      }
      return session;
    },
  },
};
