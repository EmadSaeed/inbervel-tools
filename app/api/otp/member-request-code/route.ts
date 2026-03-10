// POST /api/otp/member-request-code
//
// Sends a one-time 6-digit passcode to a member's email address.
// Only emails that exist in the User table with role MEMBER will receive a code.
// Unknown emails receive a silent { ok: true } to avoid leaking registration info.

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normaliseEmail(v: string) {
  return v.toLowerCase().trim();
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

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

  // Only registered MEMBER users receive a code — silently succeed for others.
  const member = await prisma.user.findUnique({
    where: { email },
    select: { role: true },
  });
  if (!member || member.role !== "MEMBER") {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  try {
    const code = generateCode();
    const codeHash = sha256(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.memberOtp.create({
      data: { email, codeHash, expiresAt },
    });

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT ?? 465),
      secure: true,
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: process.env.AUTH_EMAIL_FROM ?? process.env.EMAIL_FROM,
      to: email,
      subject: "Your sign-in code",
      text: `Your sign-in code is: ${code}\n\nThis code expires in 10 minutes.`,
    });
  } catch (err) {
    console.error("[member-request-code]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
