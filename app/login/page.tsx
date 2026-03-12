"use client";

import "@/app/admin/login/login.css";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";

export default function MemberLogin() {
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [sent, setSent] = useState(false);
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);

    async function sendCode() {
        setSending(true);
        try {
            const res = await fetch("/api/otp/member-request-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            if (!res.ok) {
                const msg = (await res.text()) || `Request failed (${res.status})`;
                alert(msg);
                return;
            }

            setSent(true);
        } finally {
            setSending(false);
        }
    }

    async function verify() {
        setVerifying(true);
        try {
            await signIn("member", {
                email,
                code,
                callbackUrl: "/business-dashboard",
                redirect: true,
            });
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

                    <label className="fieldLabel">Email</label>
                    <div className="row">
                        <input
                            className="input"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Your email address"
                            autoComplete="email"
                        />
                        <button
                            className="btn btnPrimary"
                            onClick={sendCode}
                            disabled={!emailOk || sending}
                            type="button"
                        >
                            {sending ? "Sending..." : "Send passcode"}
                        </button>
                    </div>

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
                            <p className="hint">
                                Didn&apos;t receive a code? Check spam/junk, then click &quot;Send passcode&quot; again.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
