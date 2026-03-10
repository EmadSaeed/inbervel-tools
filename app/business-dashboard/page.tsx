"use client";

import GaugeComponent from "react-gauge-component";
import "./business-dashboard.css";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  monthValue: number;
  yearValue: number;
  monthLabel: string;
  yearLabel: string;
}

interface ActionRow {
  emoji: "✅" | "❌";
  label: string;
  buttonLabel: string;
  buttonColor: string;
}

interface MilestoneRow {
  category: string;
  description: string;
  targetDate: string;
  status: "completed" | "pending";
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const MILESTONES: MilestoneRow[] = [
  {
    category: "Finance",
    description:
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s",
    targetDate: "30-04-2026",
    status: "completed",
  },
  {
    category: "Operations",
    description:
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s",
    targetDate: "20-06-2026",
    status: "completed",
  },
  {
    category: "Sales and Marketing",
    description:
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s",
    targetDate: "30-07-2026",
    status: "pending",
  },
  {
    category: "People",
    description:
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s",
    targetDate: "30-04-2026",
    status: "pending",
  },
];

const ACTION_TOOLS: ActionRow[] = [
  { emoji: "✅", label: "Tool to prioritise your offerings", buttonLabel: "Download", buttonColor: "#3B943E" },
  { emoji: "❌", label: "How to Spotlight Your Objectives", buttonLabel: "Complete", buttonColor: "#FF0000" },
  { emoji: "❌", label: "How to create an Advantage", buttonLabel: "Complete", buttonColor: "#FF0000" },
  { emoji: "✅", label: "Tool to Prioritise and Target Clients for maximum ROI", buttonLabel: "Download", buttonColor: "#3B943E" },
  { emoji: "✅", label: "Tool to determine your most effective route to market", buttonLabel: "Download", buttonColor: "#3B943E" },
  { emoji: "✅", label: "Business SWOT Analysis Questionnaire", buttonLabel: "Download", buttonColor: "#3B943E" },
  { emoji: "✅", label: "Questionnaire to Calculate Labour Rates Card", buttonLabel: "Download", buttonColor: "#3B943E" },
  { emoji: "✅", label: "How to Forecast Your Financial Performance", buttonLabel: "Complete", buttonColor: "#3B943E" },
  { emoji: "❌", label: "Final Step - Reflections and Summary", buttonLabel: "Complete", buttonColor: "#FF0000" },
];

// ─── Gauge config ─────────────────────────────────────────────────────────────

// 12 equal segments of 10 units each (max 120)
// 0–80 → red (8 segments), 80–100 → orange (2 segments), 100–120 → green (2 segments)
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

function ProductivityPanel() {
  const pct = 75;
  return (
    <div className="productivity">
      <p className="productivity__title">CURRENT PRODUCTIVITY</p>
      <div className="productivity__bar-wrap">
        <div className="productivity__bar-track" />
        <div className="productivity__bar-fill" style={{ width: `${pct}%` }} />
        <span className="productivity__bar-pct" style={{ right: `${100 - pct}%` }}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

function CashFlowPanel() {
  return (
    <div className="cashflow">
      <div className="cashflow__inner">
        <div className="cashflow__badge">Cash Flow +/-</div>
        <div className="cashflow__bar-wrap">
          <div className="cashflow__bar-track" />
          <div className="cashflow__bar-fill">
            <span className="cashflow__amount">£3000</span>
          </div>
        </div>
        <span className="cashflow__vat">Cash includes VAT</span>
      </div>
    </div>
  );
}

function NinetyDaysPanel() {
  return (
    <div className="ninety-days">
      <div className="ninety-days__header">
        <p className="ninety-days__heading">90 DAYS ACTIONS</p>
        <p className="ninety-days__col-label">TARGET DATE</p>
      </div>
      {MILESTONES.map((row, i) => (
        <div key={i}>
          {i > 0 && <div className="ninety-days__divider" />}
          <div className="ninety-days__row">
            <div className="ninety-days__content">
              <p className="ninety-days__category">{row.category}</p>
              <p className="ninety-days__desc">{row.description}</p>
            </div>
            <div className="ninety-days__meta">
              <p className="ninety-days__date">{row.targetDate}</p>
              {row.status === "completed" ? (
                <span className="badge--completed">Completed</span>
              ) : (
                <button className="btn--mark-complete">Mark As Completed</button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionToolsPanel() {
  return (
    <div className="action-tools">
      <p className="action-tools__heading">ACTION TOOLS</p>
      <div>
        {ACTION_TOOLS.map((tool, i) => (
          <div key={i}>
            {i > 0 && <div className="action-tools__divider" />}
            <div className="action-tools__row">
              <span className="action-tools__emoji">{tool.emoji}</span>
              <p className="action-tools__label">{tool.label}</p>
              <button
                className="action-tools__btn"
                style={{ background: tool.buttonColor }}
              >
                {tool.buttonLabel}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function BusinessDashboardPage() {
  return (
    <main className="dashboard">
      {/* ── Header ── */}
      <div className="dashboard__header">
        <div className="dashboard__logo">
          <span className="dashboard__logo-text">INBERVEL</span>
        </div>
        <h1 className="dashboard__title">Business Dashboard</h1>
      </div>

      {/* ── Stat Cards ── */}
      <div className="dashboard__stat-row">
        <StatCard title="GROSS PROFIT" monthValue={65} yearValue={67} monthLabel="£65,000" yearLabel="£670,000" />
        <StatCard title="REVENUE" monthValue={72} yearValue={58} monthLabel="£65,000" yearLabel="£670,000" />
        <StatCard title="NET PROFIT" monthValue={48} yearValue={55} monthLabel="£65,000" yearLabel="£670,000" />
      </div>

      {/* ── Middle Row: Productivity | Cash Flow ── */}
      <div className="dashboard__middle-row">
        <ProductivityPanel />
        <CashFlowPanel />
      </div>

      {/* ── Bottom Row: 90 Days Actions | Action Tools + Download ── */}
      <div className="dashboard__bottom-row">
        <NinetyDaysPanel />
        <div className="dashboard__right-col">
          <ActionToolsPanel />
          <button className="btn--download-plan">DOWNLOAD YOUR BUSINESS PLAN</button>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="dashboard__footer">
        <p className="dashboard__footer-text">
          Logged in as info@company.com{" "}
          <button className="btn--sign-out">Sign out</button>
        </p>
      </div>
    </main>
  );
}
