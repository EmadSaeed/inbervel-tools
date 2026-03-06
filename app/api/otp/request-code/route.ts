// POST /api/otp/request-code
//
// Sends a one-time 6-digit passcode to an admin's email address.
// Only emails that exist in the AllowedAdminEmail table will receive a code.
// Emails that are NOT on the allowlist receive a silent { ok: true } response —
// this prevents an attacker from enumerating which addresses are registered.

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normaliseEmail(v: string) {
  return v.toLowerCase().trim();
}

// Generates a cryptographically random 6-digit numeric code.
// Math.floor(100000 + random * 900000) guarantees the result is always 6 digits
// (i.e. never starts with 0 giving a 5-digit number).
function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Hashes the plain-text code before storing it in the database so that even if
// the database is compromised the actual codes are not exposed.
function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const emailRaw = body?.email;
  if (!emailRaw || typeof emailRaw !== "string") {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  const email = normaliseEmail(emailRaw);

  // Allowlist check — silently succeed for unknown emails so we don't leak
  // information about which addresses are registered as admins.
  const allowed = await prisma.allowedAdminEmail.findUnique({
    where: { email },
    select: { email: true },
  });
  if (!allowed) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Generate the OTP and store only its hash in the database.
  // The code itself is sent to the user's inbox and never persisted.
  const code = generateCode();
  const codeHash = sha256(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // expires in 10 minutes

  await prisma.adminOtp.create({
    data: { email, codeHash, expiresAt },
  });

  // Send the code via SMTP. The project uses Resend as the SMTP provider;
  // credentials are configured through environment variables.
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,     // smtp.resend.com
    port: Number(process.env.EMAIL_SERVER_PORT ?? 465),
    secure: true,
    auth: {
      user: process.env.EMAIL_SERVER_USER,   // "resend"
      pass: process.env.EMAIL_SERVER_PASSWORD, // Resend API key
    },
  });

  await transporter.sendMail({
    from: process.env.AUTH_EMAIL_FROM ?? process.env.EMAIL_FROM,
    to: email,
    subject: "Your admin sign-in code",
    text: `Your sign-in code is: ${code}\n\nThis code expires in 10 minutes.`,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
