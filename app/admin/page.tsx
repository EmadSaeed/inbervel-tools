"use client";

import "./admin-dashboard.css";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";

// Shape of a single submission row returned by GET /api/admin/submissions.
type SubmissionRow = {
    formId: string;
    formTitle: string | null;
    entryUpdatedAt: string | null;
    updatedAt: string;
};

// Shape of a CognitoForm record.
type CognitoFormRow = {
    id: string;
    key: string;
    formId: string;
    title: string;
    formUrl: string;
    sortOrder: number;
};

// Shape of a required-form checklist entry.
// `present` is true when the client has submitted this form.
type RequiredRow = {
    formId: string;
    key: string;
    title: string;
    present: boolean;
};

// Full response shape from GET /api/admin/submissions.
type AdminSubmissionsResponse = {
    email: string;
    companyName?: string | null;
    submissions: SubmissionRow[];
    required: RequiredRow[];
    readyToGenerate: boolean; // true when all 10 required forms are present
};

// Formats an ISO date string as "DD-MM-YYYY" for display in the submissions table.
function formatDateDDMMYYYY(value: string | null) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
}

export default function AdminPage() {
    const router = useRouter();
    const { data: session, status } = useSession();

    const [email, setEmail] = useState("");
    const [data, setData] = useState<AdminSubmissionsResponse | null>(null);
    const [loading, setLoading] = useState(false);    // true while fetching submissions
    const [generating, setGenerating] = useState(false); // true while generating the PDF

    // Manage Forms state
    const [showForms, setShowForms] = useState(false);
    const [forms, setForms] = useState<CognitoFormRow[]>([]);
    const [formsLoading, setFormsLoading] = useState(false);
    const [editedForms, setEditedForms] = useState<Record<string, Partial<CognitoFormRow>>>({});
    const [savingForm, setSavingForm] = useState<string | null>(null);

    // Redirect to login if the session has expired or was never established.
    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace("/admin/login");
            return;
        }
        if (status === "authenticated" && session?.user?.role !== "ADMIN") {
            router.replace("/admin/login");
        }
    }, [status, session?.user?.role, router]);

    // Build a map of formId -> most-recently-updated SubmissionRow so the table
    // always shows the latest submission date even if a client re-submitted a form
    // (which would produce multiple rows from the API for the same formId).
    const submissionByFormId = useMemo(() => {
        const map = new Map<string, SubmissionRow>();

        for (const s of data?.submissions ?? []) {
            const existing = map.get(s.formId);

            if (!existing) {
                map.set(s.formId, s);
                continue;
            }

            // Keep only the most recent submission for each form.
            if (new Date(s.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
                map.set(s.formId, s);
            }
        }

        return map;
    }, [data?.submissions]);

    async function loadForms() {
        if (formsLoading) return;
        setFormsLoading(true);
        try {
            const res = await fetch("/api/admin/forms");
            if (res.ok) {
                const json = (await res.json()) as CognitoFormRow[];
                setForms(json);
                setEditedForms({});
            }
        } finally {
            setFormsLoading(false);
        }
    }

    async function toggleForms() {
        const next = !showForms;
        setShowForms(next);
        if (next && !forms.length) {
            await loadForms();
        }
    }

    function setFormField(id: string, field: keyof CognitoFormRow, value: string) {
        setEditedForms((prev) => ({
            ...prev,
            [id]: { ...prev[id], [field]: value },
        }));
    }

    async function saveForm(id: string) {
        const changes = editedForms[id];
        if (!changes || !Object.keys(changes).length) return;
        setSavingForm(id);
        try {
            const res = await fetch("/api/admin/forms", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, ...changes }),
            });
            if (res.ok) {
                const updated = (await res.json()) as CognitoFormRow;
                setForms((prev) => prev.map((f) => (f.id === id ? updated : f)));
                setEditedForms((prev) => { const n = { ...prev }; delete n[id]; return n; });
            } else {
                alert(await res.text());
            }
        } finally {
            setSavingForm(null);
        }
    }

    // Fetches submission status for the entered email from the API and updates state.
    async function search() {
        if (loading || generating) return;

        setLoading(true);
        try {
            const res = await fetch(
                `/api/admin/submissions?email=${encodeURIComponent(email)}`
            );

            if (!res.ok) {
                alert(await res.text());
                setData(null);
                return;
            }

            const json = (await res.json()) as AdminSubmissionsResponse;
            setData(json);
        } finally {
            setLoading(false);
        }
    }

    // Requests the PDF from the server, then triggers a browser file download using
    // a temporary object URL. The URL is revoked after 30 s to free memory.
    async function generatePdf() {
        if (!data?.readyToGenerate || generating) return;

        setGenerating(true);
        try {
            const res = await fetch("/api/admin/generate-business-plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: data.email }),
            });

            if (!res.ok) {
                alert(await res.text());
                return;
            }

            // Convert the PDF response into a blob and create a temporary download link.
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            const company = (data.companyName ?? "Company").trim();

            // Strip characters that are illegal in filenames on Windows and macOS.
            const safeCompany = company.replace(/[\/\\?%*:|"<>]/g, "-").replace(/\s+/g, " ").trim();

            a.download = `${safeCompany} Business Plan.pdf`;
            a.click();

            // Revoke the object URL after 30 s to release the memory it holds.
            setTimeout(() => URL.revokeObjectURL(url), 30_000);
        } finally {
            setGenerating(false);
        }
    }

    if (status === "loading") return null;
    if (status === "unauthenticated") return null;
    if (session?.user?.role !== "ADMIN") return null;

    return (
        <div className="shell">
            {/* LEFT PANEL */}
            <aside className="left">
                <div className="brandRow">
                    <Image
                        src="/Inbervel-logo.png"
                        alt="Inbervel Logo"
                        width={160}
                        height={100}
                        className="logoImg"
                        priority
                    />
                    <div className="tagline">Profit-Pilot Business Plan Generator</div>
                </div>

                <div className="loginBar">
                    <div className="loginText">
                        Logged in as <strong>{session?.user?.email ?? "—"}</strong>
                    </div>

                    <button
                        className="ghostBtn"
                        onClick={() => signOut({ callbackUrl: "/admin/login" })}
                        disabled={loading || generating}
                    >
                        Sign out
                    </button>
                </div>
            </aside>

            {/* RIGHT PANEL */}
            <main className="right">
                <div className="content">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Client e-mail"
                        className="input"
                        disabled={loading || generating}
                    />

                    <button
                        onClick={search}
                        disabled={!email.trim() || loading || generating}
                        className="primaryBtn"
                    >
                        {loading ? "Searching..." : "Search for a client"}
                    </button>

                    <div style={{ marginTop: 24 }}>
                        <button
                            className="primaryBtn"
                            onClick={toggleForms}
                            disabled={loading || generating}
                            style={{ fontSize: 16 }}
                        >
                            {showForms ? "▲ Hide Forms" : "▼ Manage Forms"}
                        </button>

                        {showForms && (
                            <div className="tableWrap" style={{ marginTop: 12 }}>
                                {formsLoading ? (
                                    <p style={{ color: "#555", fontSize: 14 }}>Loading forms…</p>
                                ) : (
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Key</th>
                                                <th>Form ID</th>
                                                <th>Title</th>
                                                <th>Form URL</th>
                                                <th style={{ width: 80 }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {forms.map((f) => {
                                                const edits = editedForms[f.id] ?? {};
                                                const isDirty = Object.keys(edits).length > 0;
                                                return (
                                                    <tr key={f.id}>
                                                        <td style={{ fontSize: 12, color: "#555" }}>{f.key}</td>
                                                        <td>
                                                            <input
                                                                style={{ width: "100%", fontSize: 13, border: "1px solid #ccc", padding: "2px 4px" }}
                                                                value={edits.formId ?? f.formId}
                                                                onChange={(e) => setFormField(f.id, "formId", e.target.value)}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                style={{ width: "100%", fontSize: 13, border: "1px solid #ccc", padding: "2px 4px" }}
                                                                value={edits.title ?? f.title}
                                                                onChange={(e) => setFormField(f.id, "title", e.target.value)}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                style={{ width: "100%", fontSize: 13, border: "1px solid #ccc", padding: "2px 4px" }}
                                                                value={edits.formUrl ?? f.formUrl}
                                                                onChange={(e) => setFormField(f.id, "formUrl", e.target.value)}
                                                            />
                                                        </td>
                                                        <td>
                                                            <button
                                                                className="generateBtn"
                                                                style={{ padding: "4px 10px", fontSize: 12, margin: 0, width: "auto" }}
                                                                disabled={!isDirty || savingForm === f.id}
                                                                onClick={() => saveForm(f.id)}
                                                            >
                                                                {savingForm === f.id ? "…" : "Save"}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </div>

                    {data?.companyName && (
                        <div className="companyLine">
                            <strong>Company Name:</strong> {data.companyName}
                        </div>
                    )}

                    {data && (
                        <>
                            <div className="tableWrap">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Form</th>
                                            <th className="dateCol">Date Submitted</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {data.required.map((r) => {
                                            const submission = submissionByFormId.get(r.formId);
                                            const submittedDate = formatDateDDMMYYYY(
                                                submission?.entryUpdatedAt ?? null
                                            );

                                            return (
                                                <tr key={r.formId}>
                                                    <td>
                                                        <span className="statusIcon">{r.present ? "✅" : "❌"}</span>
                                                        {r.title}
                                                    </td>
                                                    <td className="dateCol">{r.present ? submittedDate : ""}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <button
                                onClick={generatePdf}
                                disabled={!data.readyToGenerate || loading || generating}
                                className="generateBtn"
                            >
                                {generating ? (
                                    <>
                                        <span className="spinner" />
                                        Generating...
                                    </>
                                ) : (
                                    "Generate Business Plan PDF"
                                )}
                            </button>


                            {!data.readyToGenerate && (
                                <p className="hint">
                                    PDF generation is disabled until all required forms are present.
                                </p>
                            )}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
