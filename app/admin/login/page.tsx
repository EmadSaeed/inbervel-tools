"use client";

import "./login.css";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";

export default function AdminLogin() {
    // Controlled input state for the two form fields.
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");

    // `sent` gates the second step - the code input is hidden until a code has been sent.
    const [sent, setSent] = useState(false);

    // Loading states for the two async actions to prevent double-submission.
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Cooldown timer (seconds remaining) after sending a code.
    const COOLDOWN_SECONDS = 60;
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (cooldown <= 0) return;
        const id = setInterval(() => {
            setCooldown((c) => {
                if (c <= 1) { clearInterval(id); return 0; }
                return c - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [cooldown]);

    // Step 1: request a one-time code for the entered email address.
    // The API returns { ok: true } for both known and unknown emails (to avoid
    // leaking which addresses are registered), so we always advance to step 2.
    async function sendCode() {
        setSending(true);
        try {
            const res = await fetch("/api/otp/request-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.userNotFound ? "This email is not authorised as an admin." : `Request failed (${res.status})`);
                return;
            }

            setError(null);
            // Show the code input field now that the email has been sent.
            setSent(true);
            setCooldown(COOLDOWN_SECONDS);
        } finally {
            setSending(false);
        }
    }

    // Step 2: submit the email + code to NextAuth's credentials provider.
    // NextAuth validates the OTP on the server, then redirects to /admin on success.
    async function verify() {
        setVerifying(true);
        try {
            await signIn("admin", {
                email,
                code,
                callbackUrl: "/admin",
                redirect: true,
            });
        } finally {
            setVerifying(false);
        }
    }

    // Lightweight client-side validation to disable the buttons early.
    const emailOk = email.trim().length > 3;
    const codeOk = code.trim().length === 6;

    return (
        <div className="loginShell">
            <div className="loginContainer">
                <div className="loginBrandRow">
                    <Image src="/Inbervel-logo.png" alt="Inbervel Logo" width={160} height={100} className="logoImg" />
                    <div className="loginTagline">Profit-Pilot Business Plan Generator</div>
                </div>
                <div className="loginCard">
                    <h1 className="loginTitle">Admin Login</h1>
                    <p className="loginSub">
                        Enter your assigned admin email to receive a 6-digit passcode.
                    </p>

                    {/* Step 1: Email + send passcode */}
                    <label className="fieldLabel">Email</label>
                    <div className="row">
                        <input
                            className="input"
                            type="email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
                            onKeyDown={(e) => { if (e.key === "Enter" && emailOk && !sending && cooldown === 0) sendCode(); }}
                            placeholder="Assigned admin email"
                            autoComplete="email"
                        />

                        <button
                            className="btn btnPrimary"
                            onClick={sendCode}
                            disabled={!emailOk || sending || cooldown > 0}
                            type="button"
                        >
                            {sending ? "Sending..." : cooldown > 0 ? `Resend in ${cooldown}s` : sent ? "Resend passcode" : "Send passcode"}
                        </button>
                    </div>
                    {error && (
                        <p style={{ color: "red", fontSize: 13, marginTop: 8, marginBottom: 0, wordBreak: "break-word" }}>
                            {error}
                        </p>
                    )}

                    {/* Step 2: Code + verify (only after sent) */}
                    {sent && (
                        <>
                            <div className="divider" />

                            <label className="fieldLabel">6-digit code</label>
                            <div className="row">
                                <input
                                    className="input"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    placeholder="123456"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    autoComplete="one-time-code"
                                />

                                <button
                                    className="btn btnDark"
                                    onClick={verify}
                                    disabled={!emailOk || !codeOk || verifying}
                                    type="button"
                                >
                                    {verifying ? "Verifying..." : "Verify & sign in"}
                                </button>
                            </div>

                            {cooldown > 0 ? (
                                <p className="cooldownHint">Please wait {cooldown}s before requesting another code.</p>
                            ) : (
                                <p className="hint">
                                    The passcode may take up to 10 minutes to arrive. Didn&apos;t receive a code? Check spam/junk, then click &quot;Resend passcode&quot; above.
                                </p>
                            )}
                        </>
                    )}
                </div>
                <p style={{ marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.6)", textAlign: "center", margin: "16px 0 0" }}>
                    <a href="/business-dashboard/login" style={{ color: "inherit", textDecoration: "underline" }}>Member login</a>
                </p>
            </div>
        </div>
    );
}
