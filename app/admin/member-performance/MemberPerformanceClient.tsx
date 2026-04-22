"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./member-performance.css";

type PeriodRecord = {
  id: string;
  cycleNumber: number;
  periodNumber: number;
  month: string | null;
  year: number | null;
  MonthGrossProfit: number;
  MonthRevenue: number;
  MonthNetProfit: number;
  MonthGrossProfitBudget: number;
  MonthRevenueBudget: number;
  MonthNetProfitBudget: number;
  MonthGrossProfitPct: number | null;
  MonthRevenuePct: number | null;
  MonthNetProfitPct: number | null;
  YTDGrossProfit: number;
  YTDRevenue: number;
  YTDNetProfit: number;
  YTDGrossProfitBudget: number;
  YTDRevenueBudget: number;
  YTDNetProfitBudget: number;
  YTDGrossProfitPct: number | null;
  YTDRevenuePct: number | null;
  YTDNetProfitPct: number | null;
  currency: string;
  recordedAt: string;
};

type NotePayload = {
  content: string;
  updatedAt: string;
  updatedBy: string;
};

type Response = {
  email: string;
  companyName: string | null;
  memberName: string | null;
  records: PeriodRecord[];
  note: NotePayload | null;
};

function fmtCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return value.toFixed(0);
  }
}

function fmtPct(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function shortPeriodLabel(r: PeriodRecord) {
  if (r.month && r.year) return `${r.month.slice(0, 3)} ${String(r.year).slice(2)}`;
  return `P${r.periodNumber}`;
}

export default function MemberPerformanceClient({
  email,
  adminEmail,
}: {
  email: string;
  adminEmail: string;
}) {
  const router = useRouter();
  const { status } = useSession();

  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [noteMeta, setNoteMeta] = useState<{ updatedAt: string; updatedBy: string } | null>(null);
  const [revBudgetInput, setRevBudgetInput] = useState("");
  const [gpBudgetInput, setGpBudgetInput] = useState("");
  const [npBudgetInput, setNpBudgetInput] = useState("");
  const [savingBudgets, setSavingBudgets] = useState(false);
  const [budgetStatus, setBudgetStatus] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/admin/login");
    }
  }, [status, router]);

  const isInitialFetch = useRef(true);

  useEffect(() => {
    if (!email) {
      setLoading(false);
      return;
    }
    isInitialFetch.current = true;
    let cancelled = false;

    const fetchData = async () => {
      const initial = isInitialFetch.current;
      if (initial) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await fetch(
          `/api/admin/member-performance?email=${encodeURIComponent(email)}`,
        );
        if (res.status === 404) {
          if (!cancelled && initial) setError("No client found with that email address.");
          return;
        }
        if (!res.ok) {
          if (!cancelled && initial) setError(await res.text());
          return;
        }
        const json = (await res.json()) as Response;
        if (cancelled) return;
        setData(json);
        // Only seed editable inputs on the first fetch so background polls
        // don't clobber what the admin is typing.
        if (initial) {
          setNotes(json.note?.content ?? "");
          const latestRecord = json.records[json.records.length - 1];
          setRevBudgetInput(
            latestRecord ? String(latestRecord.MonthRevenueBudget ?? 0) : "0",
          );
          setGpBudgetInput(
            latestRecord ? String(latestRecord.MonthGrossProfitBudget ?? 0) : "0",
          );
          setNpBudgetInput(
            latestRecord ? String(latestRecord.MonthNetProfitBudget ?? 0) : "0",
          );
        }
        setNoteMeta(
          json.note
            ? { updatedAt: json.note.updatedAt, updatedBy: json.note.updatedBy }
            : null,
        );
      } catch {
        // Swallow network errors on background polls.
        if (!cancelled && initial) setError("Failed to load performance data.");
      } finally {
        if (!cancelled && initial) setLoading(false);
        isInitialFetch.current = false;
      }
    };

    fetchData();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchData();
    }, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchData();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [email]);

  const chartData = useMemo(() => {
    if (!data) return [];
    const round = (v: number | null | undefined) => Math.round(Number(v ?? 0));
    return data.records.map((r) => ({
      label: shortPeriodLabel(r),
      Revenue: round(r.MonthRevenue),
      RevenueBudget: round(r.MonthRevenueBudget),
      GrossProfit: round(r.MonthGrossProfit),
      GrossProfitBudget: round(r.MonthGrossProfitBudget),
      NetProfit: round(r.MonthNetProfit),
      NetProfitBudget: round(r.MonthNetProfitBudget),
      YTDRevenue: round(r.YTDRevenue),
      YTDGrossProfit: round(r.YTDGrossProfit),
      YTDNetProfit: round(r.YTDNetProfit),
    }));
  }, [data]);

  async function saveBudgets() {
    if (!email || savingBudgets) return;
    const revBudget = Number(revBudgetInput);
    const gpBudget = Number(gpBudgetInput);
    const npBudget = Number(npBudgetInput);
    if (
      !Number.isFinite(revBudget) ||
      !Number.isFinite(gpBudget) ||
      !Number.isFinite(npBudget) ||
      revBudget < 0 ||
      gpBudget < 0 ||
      npBudget < 0
    ) {
      setBudgetStatus("Budgets must be non-negative numbers.");
      return;
    }

    setSavingBudgets(true);
    setBudgetStatus(null);
    try {
      const res = await fetch("/api/admin/member-performance/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail: email, revBudget, gpBudget, npBudget }),
      });
      if (!res.ok) {
        setBudgetStatus(await res.text());
        return;
      }
      const refresh = await fetch(
        `/api/admin/member-performance?email=${encodeURIComponent(email)}`,
      );
      if (refresh.ok) {
        const json = (await refresh.json()) as Response;
        setData(json);
      }
      setBudgetStatus("Budgets saved.");
    } finally {
      setSavingBudgets(false);
    }
  }

  async function saveNotes() {
    if (!email || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/member-performance/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail: email, content: notes }),
      });
      if (!res.ok) {
        alert(await res.text());
        return;
      }
      const saved = (await res.json()) as NotePayload;
      setNoteMeta({ updatedAt: saved.updatedAt, updatedBy: saved.updatedBy });
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") return null;

  if (!email) {
    return (
      <div className="mp-canvas">
        <p className="mp-hint">Select a member from the admin dashboard to view their performance.</p>
      </div>
    );
  }

  return (
    <div className="mp-canvas">
      <header className="mp-header">
        <div className="mp-brand">
          <Image
            src="/Inbervel-logo.png"
            alt="Inbervel Logo"
            width={120}
            height={70}
            priority
          />
          <div>
            <div className="mp-title">Member Performance</div>
            <div className="mp-sub">{data?.companyName ?? data?.memberName ?? email}</div>
            <div className="mp-email">{email}</div>
          </div>
        </div>
        <div className="mp-actions">
          <button className="mp-ghost" onClick={() => router.push("/admin")}>
            Back to admin
          </button>
          <button
            className="mp-ghost"
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
          >
            Sign out ({adminEmail})
          </button>
        </div>
      </header>

      {loading && <p className="mp-hint">Loading…</p>}
      {error && <p className="mp-error">{error}</p>}

      {!loading && !error && data && (
        <>
          <section className="mp-section">
            <h2 className="mp-h2">Monthly performance</h2>
            {data.records.length === 0 ? (
              <p className="mp-hint">No performance records yet for this member.</p>
            ) : (
              <div className="mp-tableWrap">
                <table className="mp-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Month</th>
                      <th>Year</th>
                      <th>Revenue</th>
                      <th>Rev. Budget</th>
                      <th>Rev. %</th>
                      <th>Gross Profit</th>
                      <th>GP Budget</th>
                      <th>GP %</th>
                      <th>Net Profit</th>
                      <th>NP Budget</th>
                      <th>NP %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.records.map((r) => (
                      <tr key={r.id}>
                        <td>C{r.cycleNumber}·P{r.periodNumber}</td>
                        <td>{r.month ?? "—"}</td>
                        <td>{r.year ?? "—"}</td>
                        <td>{fmtCurrency(r.MonthRevenue, r.currency)}</td>
                        <td>{fmtCurrency(r.MonthRevenueBudget, r.currency)}</td>
                        <td>{fmtPct(r.MonthRevenuePct)}</td>
                        <td>{fmtCurrency(r.MonthGrossProfit, r.currency)}</td>
                        <td>{fmtCurrency(r.MonthGrossProfitBudget, r.currency)}</td>
                        <td>{fmtPct(r.MonthGrossProfitPct)}</td>
                        <td>{fmtCurrency(r.MonthNetProfit, r.currency)}</td>
                        <td>{fmtCurrency(r.MonthNetProfitBudget, r.currency)}</td>
                        <td>{fmtPct(r.MonthNetProfitPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mp-section">
            <h2 className="mp-h2">YTD performance</h2>
            {data.records.length === 0 ? (
              <p className="mp-hint">No performance records yet for this member.</p>
            ) : (
              <div className="mp-tableWrap">
                <table className="mp-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Month</th>
                      <th>Year</th>
                      <th>YTD Revenue</th>
                      <th>YTD GP</th>
                      <th>YTD NP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.records.map((r) => (
                      <tr key={r.id}>
                        <td>C{r.cycleNumber}·P{r.periodNumber}</td>
                        <td>{r.month ?? "—"}</td>
                        <td>{r.year ?? "—"}</td>
                        <td>{fmtCurrency(r.YTDRevenue, r.currency)}</td>
                        <td>{fmtCurrency(r.YTDGrossProfit, r.currency)}</td>
                        <td>{fmtCurrency(r.YTDNetProfit, r.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mp-section">
            <h2 className="mp-h2">Trends</h2>
            {data.records.length === 0 ? (
              <p className="mp-hint">No data to chart yet.</p>
            ) : (
              <div className="mp-chartGrid">
                <div className="mp-chartCell">
                  <div className="mp-chartTitle">Revenue — actual vs budget</div>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
                      <XAxis dataKey="label" stroke="#e9ffe9" />
                      <YAxis stroke="#e9ffe9" />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="Revenue" stroke="#a7ff72" strokeWidth={2} />
                      <Line
                        type="monotone"
                        dataKey="RevenueBudget"
                        stroke="#ffbd59"
                        strokeDasharray="4 4"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="mp-chartCell">
                  <div className="mp-chartTitle">Gross Profit — actual vs budget</div>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
                      <XAxis dataKey="label" stroke="#e9ffe9" />
                      <YAxis stroke="#e9ffe9" />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="GrossProfit" stroke="#a7ff72" strokeWidth={2} />
                      <Line
                        type="monotone"
                        dataKey="GrossProfitBudget"
                        stroke="#ffbd59"
                        strokeDasharray="4 4"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="mp-chartCell">
                  <div className="mp-chartTitle">Net Profit — actual vs budget</div>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
                      <XAxis dataKey="label" stroke="#e9ffe9" />
                      <YAxis stroke="#e9ffe9" />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="NetProfit" stroke="#a7ff72" strokeWidth={2} />
                      <Line
                        type="monotone"
                        dataKey="NetProfitBudget"
                        stroke="#ffbd59"
                        strokeDasharray="4 4"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="mp-chartCell">
                  <div className="mp-chartTitle">YTD cumulative</div>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
                      <XAxis dataKey="label" stroke="#e9ffe9" />
                      <YAxis stroke="#e9ffe9" />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="YTDRevenue" stroke="#a7ff72" strokeWidth={2} />
                      <Line type="monotone" dataKey="YTDGrossProfit" stroke="#6fcf97" strokeWidth={2} />
                      <Line type="monotone" dataKey="YTDNetProfit" stroke="#ffbd59" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </section>

          <section className="mp-section mp-budgets">
            <h2 className="mp-h2">Budgets (admin override)</h2>
            <p className="mp-hint">
              Applies to every record in the current cycle. Use when a member
              won&rsquo;t or can&rsquo;t submit Form 25 themselves.
            </p>
            <div className="mp-budgetRow">
              <label className="mp-budgetField">
                <span>Revenue budget</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={revBudgetInput}
                  onChange={(e) => setRevBudgetInput(e.target.value)}
                  disabled={savingBudgets}
                />
              </label>
              <label className="mp-budgetField">
                <span>GP budget</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={gpBudgetInput}
                  onChange={(e) => setGpBudgetInput(e.target.value)}
                  disabled={savingBudgets}
                />
              </label>
              <label className="mp-budgetField">
                <span>NP budget</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={npBudgetInput}
                  onChange={(e) => setNpBudgetInput(e.target.value)}
                  disabled={savingBudgets}
                />
              </label>
            </div>
            <button
              className="mp-saveBtn"
              onClick={saveBudgets}
              disabled={savingBudgets}
            >
              {savingBudgets ? "Saving…" : "Save budgets"}
            </button>
            {budgetStatus && <p className="mp-hint">{budgetStatus}</p>}
          </section>

          <section className="mp-section mp-notes">
            <h2 className="mp-h2">Member Performance Notes</h2>
            {noteMeta && (
              <p className="mp-noteMeta">
                Last updated {new Date(noteMeta.updatedAt).toLocaleString("en-GB")} by{" "}
                <strong>{noteMeta.updatedBy}</strong>
              </p>
            )}
            <textarea
              className="mp-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write your performance notes for this member…"
              disabled={saving}
            />
            <button
              className="mp-saveBtn"
              onClick={saveNotes}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save notes"}
            </button>
          </section>
        </>
      )}
    </div>
  );
}
