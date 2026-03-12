"use client";

import { useState, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import GaugeComponent from "react-gauge-component";
import "./business-dashboard.css";
import type { ActionCategory, ActionStatus } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  monthValue: number;
  yearValue: number;
  monthLabel: string;
  yearLabel: string;
}

export interface ActionToolItem {
  formId: string;
  title: string;
  formUrl: string;
  sortOrder: number;
  status: "COMPLETE" | "INCOMPLETE";
  fileUrl: string | null;
}

export interface NinetyDayActionRow {
  id: string;
  category: ActionCategory;
  description: string;
  targetDate: Date;
  status: ActionStatus;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<ActionCategory, string> = {
  FINANCE: "Finance",
  OPERATIONS: "Operations",
  SALES_MARKETING: "Sales and Marketing",
  PEOPLE: "People",
};

function formatDate(date: Date): string {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// ─── Gauge config ─────────────────────────────────────────────────────────────

const GAUGE_ARC = {
  padding: 0.02,
  width: 0.3,
  subArcs: [
    { limit: 10,  color: "#ff2600" },
    { limit: 20,  color: "#ff2600" },
    { limit: 30,  color: "#ff2600" },
    { limit: 40,  color: "#ff2600" },
    { limit: 50,  color: "#ff2600" },
    { limit: 60,  color: "#ff2600" },
    { limit: 70,  color: "#ff2600" },
    { limit: 80,  color: "#ff2600" },
    { limit: 90,  color: "#ff8c00" },
    { limit: 100, color: "#ff8c00" },
    { limit: 110, color: "#2e7d32" },
    { limit: 120, color: "#2e7d32" },
  ],
};

const GAUGE_POINTER = {
  type: "needle" as const,
  color: "#e0e0e0",
  elastic: true,
  animationDelay: 0,
  maxFps: 30,
  baseColor: "#ffffff",
  length: 0.75,
  width: 15,
  strokeWidth: 0,
};

const GAUGE_LABELS = {
  valueLabel: {
    style: { fontSize: "25px", fill: "#e0e0e0", fontWeight: "bold" },
    hide: false,
    offsetX: 0,
    offsetY: -3,
    animateValue: false,
    formatTextValue: (v: number) => `${v}%`,
  },
  tickLabels: {
    type: "inner" as const,
    ticks: [{ value: 20 }, { value: 40 }, { value: 60 }, { value: 80 }, { value: 100 }, { value: 120 }],
    defaultTickValueConfig: { style: { fontSize: "11px", fill: "#feffff" }, formatTextValue: (v: number) => `${v}%` },
    defaultTickLineConfig: { distanceFromArc: 3, distanceFromText: 12 },
  },
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ title, monthValue, yearValue, monthLabel, yearLabel }: StatCardProps) {
  return (
    <div className="stat-card">
      <p className="stat-card__title">{title}</p>
      <div className="stat-card__gauges">
        <div className="stat-card__gauge">
          <GaugeComponent
            value={monthValue}
            maxValue={120}
            type="radial"
            arc={GAUGE_ARC}
            pointer={GAUGE_POINTER}
            labels={GAUGE_LABELS}
            style={{ width: "100%", height: 150 }}
          />
          <p className="stat-card__gauge-label">MONTH</p>
          <p className="stat-card__gauge-value">{monthLabel}</p>
        </div>
        <div className="stat-card__gauge">
          <GaugeComponent
            value={yearValue}
            maxValue={120}
            type="radial"
            arc={GAUGE_ARC}
            pointer={GAUGE_POINTER}
            labels={GAUGE_LABELS}
            style={{ width: "100%", height: 150 }}
          />
          <p className="stat-card__gauge-label">YEAR</p>
          <p className="stat-card__gauge-value">{yearLabel}</p>
        </div>
      </div>
    </div>
  );
}

function ProductivityPanel({ percentage, breakEvenRpp, theMonthRpp, targetFigure }: {
  percentage: number;
  breakEvenRpp: string | null;
  theMonthRpp: string | null;
  targetFigure: string | null;
}) {
  const pct = Math.min(Math.max(percentage, 0), 100);
  const fmt = (v: string | null) => v ? `£${Number(v).toFixed(2)}` : "—";
  const barColor = pct >= 80 ? "#3b943e" : pct >= 60 ? "#ff8c00" : "#ff2600";
  return (
    <div className="productivity">
      <div className="productivity__header">
        <p className="productivity__title">CURRENT PRODUCTIVITY</p>
        <span className="productivity__stat">The Months RPP:&nbsp;&nbsp;{fmt(theMonthRpp)}</span>
      </div>
      <div className="productivity__bar-wrap">
        <div className="productivity__bar-track" />
        <div className="productivity__bar-fill" style={{ width: `${pct}%`, background: barColor }} />
        <span className="productivity__bar-pct" style={{ right: `${100 - pct}%` }}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="productivity__stats">
        <span className="productivity__stat">Break-even RPP:&nbsp;&nbsp;{fmt(breakEvenRpp)}</span>
        <span className="productivity__stat">Target Figure:&nbsp;&nbsp;{fmt(targetFigure)}</span>
      </div>
    </div>
  );
}

function CashFlowPanel({ amount, includesVat }: { amount: string | null; includesVat: string | null }) {
  return (
    <div className="cashflow">
      <p className="cashflow__title">CASH FLOW +/-</p>
      <div className="cashflow__inner">
        <div className="cashflow__amount-box">
          <span className="cashflow__currency">£</span>
          <span className="cashflow__amount">{amount ?? "—"}</span>
        </div>
        {includesVat && <span className="cashflow__vat">{includesVat}</span>}
      </div>
    </div>
  );
}

function NinetyDaysPanel({ actions }: { actions: NinetyDayActionRow[] }) {
  const router = useRouter();
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const [resetting, setResetting] = useState<Set<string>>(new Set());

  useEffect(() => {
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router]);

  async function markComplete(id: string) {
    setCompleting((prev) => new Set(prev).add(id));
    const res = await fetch("/api/business-dashboard/complete-action", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      setCompleting((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  async function resetAction(id: string) {
    setResetting((prev) => new Set(prev).add(id));
    const res = await fetch("/api/business-dashboard/reset-action", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setCompleting((prev) => { const s = new Set(prev); s.delete(id); return s; });
      setResetting((prev) => { const s = new Set(prev); s.delete(id); return s; });
      router.refresh();
    } else {
      setResetting((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  if (!actions.length) {
    return (
      <div className="ninety-days">
        <div className="ninety-days__header">
          <p className="ninety-days__heading">90 DAYS ACTIONS</p>
        </div>
        <p style={{ color: "#aaa", padding: "1rem" }}>No actions found.</p>
      </div>
    );
  }

  return (
    <div className="ninety-days">
      <div className="ninety-days__header">
        <p className="ninety-days__heading">90 DAYS ACTIONS</p>
        <p className="ninety-days__col-label">TARGET DATE</p>
        <div />
      </div>
      {actions.map((row, i) => (
        <div key={row.id}>
          {i > 0 && <div className="ninety-days__divider" />}
          <div className="ninety-days__row">
            <div className="ninety-days__content">
              <p className="ninety-days__category">{CATEGORY_LABEL[row.category]}</p>
              <p className="ninety-days__desc">{row.description}</p>
            </div>
            <p className="ninety-days__date">{formatDate(row.targetDate)}</p>
            <div className="ninety-days__action">
              {row.status === "COMPLETED" || completing.has(row.id) ? (
                <button
                  className="badge--completed"
                  onClick={() => resetAction(row.id)}
                  disabled={resetting.has(row.id)}
                  title="Click to mark as pending"
                >
                  {resetting.has(row.id) ? "Resetting..." : "✓ Completed"}
                </button>
              ) : (
                <button className="btn--mark-complete" onClick={() => markComplete(row.id)}>
                  Mark As Completed
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionToolsPanel({ tools }: { tools: ActionToolItem[] }) {
  function handleToolClick(tool: ActionToolItem) {
    if (tool.status === "COMPLETE" && tool.fileUrl) {
      window.open(tool.fileUrl, "_blank");
    } else if (tool.formUrl) {
      window.open(tool.formUrl, "_blank");
    }
  }

  return (
    <div className="action-tools">
      <p className="action-tools__heading">ACTION TOOLS</p>
      <div className="action-tools__rows">
        {tools.map((tool, i) => (
          <Fragment key={tool.formId}>
            {i > 0 && <div className="action-tools__divider" />}
            <span className="action-tools__emoji">
              {tool.status === "COMPLETE" ? "✅" : "❌"}
            </span>
            <p className="action-tools__label">{tool.title}</p>
            <div className="action-tools__btn-group">
              {tool.status === "COMPLETE" ? (
                <>
                  {tool.fileUrl && (
                    <button
                      className="action-tools__btn action-tools__btn--download"
                      style={{ background: "#3B943E" }}
                      onClick={() => handleToolClick(tool)}
                    >
                      ↓ Report Download
                    </button>
                  )}
                  <button
                    className="action-tools__btn"
                    style={{ background: "#6B7280", paddingRight: "10px" }}
                    onClick={() => tool.formUrl && window.open(tool.formUrl, "_blank")}
                    disabled={!tool.formUrl}
                  >
                    ↻ Update
                  </button>
                </>
              ) : (
                <button
                  className="action-tools__btn"
                  style={{ background: "#FF0000" }}
                  onClick={() => handleToolClick(tool)}
                  disabled={!tool.formUrl}
                >
                  ✎ Complete
                </button>
              )}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

interface Props {
  ninetyDayActions: NinetyDayActionRow[];
  userEmail: string;
  actionTools: ActionToolItem[];
  readyToGenerate: boolean;
  companyName: string | null;
  companyLogoUrl: string | null;
  cashFlow: { amount: string; includesVat: string } | null;
  productivity: { percentage: number; breakEvenRpp: string | null; theMonthRpp: string | null; targetFigure: string | null } | null;
}

export default function BusinessDashboardClient({
  ninetyDayActions,
  userEmail,
  actionTools,
  readyToGenerate,
  companyName,
  companyLogoUrl,
  cashFlow,
  productivity,
}: Props) {
  const [generatingPlan, setGeneratingPlan] = useState(false);

  async function handleDownloadPlan() {
    if (!readyToGenerate || generatingPlan) return;
    setGeneratingPlan(true);
    try {
      const res = await fetch("/api/business-dashboard/generate-business-plan", {
        method: "POST",
      });
      if (!res.ok) {
        alert(await res.text());
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Business Plan.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } finally {
      setGeneratingPlan(false);
    }
  }

  return (
    <main className="dashboard">
      {/* ── Header ── */}
      <div className="dashboard__header">
        <div className="dashboard__logo">
          {companyLogoUrl ? (
            <img src={companyLogoUrl} alt={companyName ?? "Company logo"} className="dashboard__logo-img" />
          ) : (
            <span className="dashboard__logo-text">${companyName}</span>
          )}
        </div>
        <h1 className="dashboard__title">
          {companyName ? `${companyName} - Business Dashboard` : "Business Dashboard"}
        </h1>
      </div>

      {/* ── Stat Cards ── */}
      <div className="dashboard__stat-row">
        <StatCard title="GROSS PROFIT" monthValue={65} yearValue={67} monthLabel="£65,000" yearLabel="£670,000" />
        <StatCard title="REVENUE" monthValue={72} yearValue={58} monthLabel="£65,000" yearLabel="£670,000" />
        <StatCard title="NET PROFIT" monthValue={48} yearValue={55} monthLabel="£65,000" yearLabel="£670,000" />
      </div>

      {/* ── Middle Row: Productivity | Cash Flow ── */}
      <div className="dashboard__middle-row">
        <ProductivityPanel
          percentage={productivity?.percentage ?? 0}
          breakEvenRpp={productivity?.breakEvenRpp ?? null}
          theMonthRpp={productivity?.theMonthRpp ?? null}
          targetFigure={productivity?.targetFigure ?? null}
        />
        <CashFlowPanel amount={cashFlow?.amount ?? null} includesVat={cashFlow?.includesVat ?? null} />
      </div>

      {/* ── Bottom Row: 90 Days Actions | Action Tools + Download ── */}
      <div className="dashboard__bottom-row">
        <NinetyDaysPanel actions={ninetyDayActions} />
        <ActionToolsPanel tools={actionTools} />
        <button
          className="btn--download-plan"
          onClick={handleDownloadPlan}
          disabled={!readyToGenerate || generatingPlan}
          style={!readyToGenerate ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
          title={!readyToGenerate ? "Business plan download is disabled until completing the action tools" : undefined}
        >
          {generatingPlan ? "⏳ Generating…" : "⬇ DOWNLOAD YOUR BUSINESS PLAN"}
        </button>
      </div>

      {/* ── Footer ── */}
      <div className="dashboard__footer">
        <p className="dashboard__footer-text">
          Logged in as {userEmail}{" "}
          <button className="btn--sign-out" onClick={() => signOut({ callbackUrl: "/business-dashboard/login" })}>Sign out</button>
        </p>
      </div>
    </main>
  );
}
