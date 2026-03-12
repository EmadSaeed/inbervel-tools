"use client";

import "../admin/admin-dashboard.css";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type CognitoFormRow = {
    id: string;
    key: string;
    formId: string;
    title: string;
    formUrl: string;
    sortOrder: number;
};

export default function ManageFormsPage() {
    const router = useRouter();
    const { data: session, status } = useSession();

    const [forms, setForms] = useState<CognitoFormRow[]>([]);
    const [formsLoading, setFormsLoading] = useState(false);
    const [editedForms, setEditedForms] = useState<Record<string, Partial<CognitoFormRow>>>({});
    const [savingForm, setSavingForm] = useState<string | null>(null);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace("/admin/login");
            return;
        }
        if (status === "authenticated" && session?.user?.role !== "ADMIN") {
            router.replace("/admin/login");
        }
    }, [status, session?.user?.role, router]);

    useEffect(() => {
        if (status === "authenticated" && session?.user?.role === "ADMIN") {
            loadForms();
        }
    }, [status, session?.user?.role]);

    async function loadForms() {
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

    if (status === "loading") return null;
    if (status === "unauthenticated") return null;
    if (session?.user?.role !== "ADMIN") return null;

    return (
        <div className="shell">
            <main className="right" style={{ width: "100%" }}>
                <div className="content">
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                        <button className="ghostBtn" onClick={() => router.push("/admin")}>
                            ← Back to Admin
                        </button>
                        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Manage Forms</h2>
                    </div>

                    {formsLoading ? (
                        <p style={{ color: "#555", fontSize: 14 }}>Loading forms…</p>
                    ) : (
                        <div className="tableWrap">
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
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
