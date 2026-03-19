"use client";

import "@/app/admin/login/login.css";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";

export default function MemberLogin() {
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [sent, setSent] = useState(false);
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userNotFound, setUserNotFound] = useState(false);

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

    async function sendCode() {
        setSending(true);
        try {
            const res = await fetch("/api/otp/member-request-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                if (data.userNotFound) {
                    setUserNotFound(true);
                    setError("User does not exist.");
                } else {
                    setError(`Request failed (${res.status})`);
                }
                return;
            }

            setUserNotFound(false);
            setSent(true);
            setCooldown(COOLDOWN_SECONDS);
        } finally {
            setSending(false);
        }
    }

    async function verify() {
        setVerifying(true);
        setError(null);
        try {
            const result = await signIn("member", {
                email,
                code,
                redirect: false,
            });
            if (!result || result.error) {
                setError(`Sign-in failed: ${result?.error ?? "unknown error"}`);
            } else {
                window.location.href = "/business-dashboard";
            }
        } catch (e) {
            setError(`Exception: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setVerifying(false);
        }
    }

    const emailOk = email.trim().length > 3;
    const codeOk = code.trim().length === 6;

    return (
        <div className="loginShell">
            <div className="loginContainer">
                <div className="loginBrandRow">
                    <Image src="/Inbervel-logo.png" alt="Inbervel Logo" width={160} height={100} className="logoImg" />
                    
                </div>
                <div className="loginCard">
                    <h1 className="loginTitle">Member Login</h1>
                    <p className="loginSub">
                        <span style={userNotFound ? { color: "red" } : undefined}>To access your Business Dashboard, you need to complete at least one of Your Business Tools below.</span>
                        <br />Once you do, you can log in here with the same email you used for the tool, and we will send you a 6-digit passcode to access your dashboard.
                    </p>
                    <label className="fieldLabel">Email</label>
                    <div className="row">
                        <input
                            className="input"
                            type="email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); if (userNotFound) { setUserNotFound(false); setError(null); } }}
                            onKeyDown={(e) => { if (e.key === "Enter" && emailOk && !sending && cooldown === 0) sendCode(); }}
                            placeholder="Your email address"
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
            </div>
            <p style={{ position: "fixed", bottom: 16, left: 0, right: 0, fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "center", margin: 0 }}>
                <a href="/admin/login" style={{ color: "inherit", textDecoration: "underline" }}>Admin login</a>
            </p>
        </div>
    );
}
