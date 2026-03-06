import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

// Hashes a plain-text OTP code for safe comparison against the stored hash.
// The actual code is never stored in the database — only its hash.
function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

// Normalises an email address to lowercase and strips surrounding whitespace
// so comparisons are consistent regardless of how the user typed it.
function normaliseEmail(v: string) {
  return v.toLowerCase().trim();
}

export const authOptions: NextAuthOptions = {
  // Use stateless JWT sessions — no session rows in the database.
  // Sessions last 30 days and are silently refreshed every 15 minutes.
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30, // 30 days in seconds
    updateAge: 15 * 60, // optional: refresh session every 15 mins
  },

  providers: [
    // OTP-based login: the user receives a 6-digit code by email and submits
    // it here along with their email address.
    CredentialsProvider({
      name: "Passcode",
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

        // Gate 1 — allowlist: only emails pre-approved in AllowedAdminEmail
        // can ever log in, even if they somehow have a valid OTP code.
        const allowed = await prisma.allowedAdminEmail.findUnique({
          where: { email },
          select: { email: true },
        });
        if (!allowed) return null;

        // Gate 2 — OTP: find the most recent code for this email that:
        //   • matches the submitted code (by hash),
        //   • has not been used yet, and
        //   • has not expired.
        const codeHash = sha256(code);
        const now = new Date();

        const otp = await prisma.adminOtp.findFirst({
          where: {
            email,
            codeHash,
            usedAt: null,
            expiresAt: { gt: now },
          },
          orderBy: { createdAt: "desc" },
        });

        if (!otp) return null;

        // Invalidate the code immediately so it cannot be reused (one-time use).
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

        return {
          id: adminUser.id,
          email: adminUser.email ?? email,
          role: adminUser.role,
        };
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
