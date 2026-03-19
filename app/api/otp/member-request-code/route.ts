// POST /api/otp/member-request-code
//
// Sends a one-time 6-digit passcode to a member's email address.
// Only emails that exist in the User table with role MEMBER will receive a code.
// Unknown emails receive a 404 { userNotFound: true } so the frontend can show an inline error.

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

  // Only registered MEMBER users receive a code — return 404 for others.
  const member = await prisma.user.findUnique({
    where: { email },
    select: { role: true },
  });
  if (!member || member.role !== "MEMBER") {
    return NextResponse.json({ userNotFound: true }, { status: 404 });
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

    const logoUrl = "https://tools.inbervel.co.uk/Inbervel-logo.png";

    await transporter.sendMail({
      from: process.env.AUTH_EMAIL_FROM ?? process.env.EMAIL_FROM,
      to: email,
      subject: "Your Inbervel sign-in code",
      text: `Your sign-in code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, you can safely ignore this email.\n\n— The Inbervel Team`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.10);">

          <!-- Header -->
          <tr>
            <td align="center" style="background:#0C2218;padding:28px 32px 20px;">
              <img src="${logoUrl}" alt="Inbervel" width="130" style="display:block;margin:0 auto;" />
              <div style="color:#a7ff72;font-size:11px;letter-spacing:1.5px;margin-top:10px;text-transform:uppercase;">Profit-Pilot Business Dashboard</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 36px 32px;">
              <p style="margin:0 0 8px;font-size:16px;color:#222;">Hi,</p>
              <p style="margin:0 0 28px;font-size:15px;color:#444;line-height:1.6;">
                Here is your one-time sign-in code for you to access your Business Dashboard. Just enter the code below in the login page to get started.:
              </p>

              <!-- Code block -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background:#f0ffe8;border:2px solid #a7ff72;border-radius:8px;padding:22px 16px;">
                    <span style="font-size:40px;font-weight:700;letter-spacing:10px;color:#0C2218;">${code}</span>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 8px;font-size:14px;color:#555;">
                This code expires in <strong>10 minutes</strong>.
              </p>
              <p style="margin:0;font-size:13px;color:#999;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f9;border-top:1px solid #eee;padding:18px 36px;">
              <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">— The Inbervel Team</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
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
