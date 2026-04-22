// lib/pdf/renderMemberPerformance.ts
//
// Loads a member's financial period history + note, builds a DTO with
// pre-formatted strings and inline SVG charts, and renders the
// member-performance.hbs template into a self-contained HTML string that
// Puppeteer can convert to a PDF. Parallels renderBusinessPlanTemplate.

import fs from "node:fs/promises";
import path from "node:path";
import Handlebars from "handlebars";
import { prisma } from "@/lib/prisma";
import { getFinancialPeriodRecords } from "@/lib/cognito/financialPeriods";
import { fileToDataUri } from "./renderTemplate";
import { renderLineChartSvg } from "./chartSvg";

const DARK_GREEN = "#0C2218";
const BUDGET_AMBER = "#D98E1C";
const GP_GREEN = "#2E8B57";
const NP_ORANGE = "#D98E1C";

export type MemberPerformanceRenderResult = {
  html: string;
  filenameBase: string; // sanitized stem, no extension
  displayName: string;
  found: boolean;
};

export async function renderMemberPerformanceTemplate(
  userEmail: string,
): Promise<MemberPerformanceRenderResult> {
  const email = userEmail.toLowerCase().trim();

  const [member, records, note] = await Promise.all([
    prisma.user.findUnique({
      where: { email },
      select: { companyName: true, firstName: true, lastName: true },
    }),
    getFinancialPeriodRecords(email),
    prisma.memberPerformanceNote.findUnique({
      where: { userEmail: email },
      select: { content: true },
    }),
  ]);

  const memberName =
    [member?.firstName, member?.lastName].filter(Boolean).join(" ").trim() ||
    null;
  const companyDisplay = member?.companyName ?? memberName ?? email;
  const displayName = companyDisplay;

  const currency = records[0]?.currency ?? "GBP";
  const fmtCurrency = (value: unknown) => formatCurrency(toNumber(value), currency);
  const fmtPct = (value: unknown) => formatPct(toNumber(value));
  const monthShort = (m: string | null, y: number | null) =>
    m && y ? `${m.slice(0, 3)} ${String(y).slice(2)}` : "—";

  const serialisedRecords = records.map((r) => ({
    cycleNumber: r.cycleNumber,
    periodNumber: r.periodNumber,
    monthLabel: r.month ?? "—",
    yearLabel: r.year ?? "—",
    monthRevenue: fmtCurrency(r.MonthRevenue),
    monthRevenueBudget: fmtCurrency(r.MonthRevenueBudget),
    monthRevenuePct: fmtPct(r.MonthRevenuePct),
    monthGrossProfit: fmtCurrency(r.MonthGrossProfit),
    monthGrossProfitBudget: fmtCurrency(r.MonthGrossProfitBudget),
    monthGrossProfitPct: fmtPct(r.MonthGrossProfitPct),
    monthNetProfit: fmtCurrency(r.MonthNetProfit),
    monthNetProfitBudget: fmtCurrency(r.MonthNetProfitBudget),
    monthNetProfitPct: fmtPct(r.MonthNetProfitPct),
    ytdRevenue: fmtCurrency(r.YTDRevenue),
    ytdGrossProfit: fmtCurrency(r.YTDGrossProfit),
    ytdNetProfit: fmtCurrency(r.YTDNetProfit),
  }));

  const hasRecords = records.length > 0;
  const firstMonthLabel = hasRecords
    ? `${records[0].month ?? ""} ${records[0].year ?? ""}`.trim()
    : "";
  const lastMonthLabel = hasRecords
    ? `${records[records.length - 1].month ?? ""} ${records[records.length - 1].year ?? ""}`.trim()
    : "";
  const periodCovered = !hasRecords
    ? "—"
    : firstMonthLabel === lastMonthLabel
      ? firstMonthLabel || "—"
      : `${firstMonthLabel} – ${lastMonthLabel}`;

  const labelFor = (r: (typeof records)[number]) => monthShort(r.month, r.year);

  const monthlyChartSvg = hasRecords
    ? renderLineChartSvg({
        series: [
          {
            name: "Revenue",
            color: DARK_GREEN,
            points: records.map((r) => ({
              label: labelFor(r),
              value: Math.round(Number(r.MonthRevenue)),
            })),
          },
          {
            name: "Rev. Budget",
            color: BUDGET_AMBER,
            dashed: true,
            points: records.map((r) => ({
              label: labelFor(r),
              value: Math.round(Number(r.MonthRevenueBudget)),
            })),
          },
        ],
      })
    : "";

  const gpChartSvg = hasRecords
    ? renderLineChartSvg({
        series: [
          {
            name: "Gross Profit",
            color: GP_GREEN,
            points: records.map((r) => ({
              label: labelFor(r),
              value: Math.round(Number(r.MonthGrossProfit)),
            })),
          },
          {
            name: "GP Budget",
            color: BUDGET_AMBER,
            dashed: true,
            points: records.map((r) => ({
              label: labelFor(r),
              value: Math.round(Number(r.MonthGrossProfitBudget)),
            })),
          },
        ],
      })
    : "";

  const npChartSvg = hasRecords
    ? renderLineChartSvg({
        series: [
          {
            name: "Net Profit",
            color: NP_ORANGE,
            points: records.map((r) => ({
              label: labelFor(r),
              value: Math.round(Number(r.MonthNetProfit)),
            })),
          },
          {
            name: "NP Budget",
            color: BUDGET_AMBER,
            dashed: true,
            points: records.map((r) => ({
              label: labelFor(r),
              value: Math.round(Number(r.MonthNetProfitBudget)),
            })),
          },
        ],
      })
    : "";

  const ytdChartSvg = hasRecords
    ? renderLineChartSvg({
        series: [
          {
            name: "YTD Revenue",
            color: DARK_GREEN,
            points: records.map((r) => ({
              label: labelFor(r),
              value: Math.round(Number(r.YTDRevenue)),
            })),
          },
          {
            name: "YTD GP",
            color: GP_GREEN,
            points: records.map((r) => ({
              label: labelFor(r),
              value: Math.round(Number(r.YTDGrossProfit)),
            })),
          },
          {
            name: "YTD NP",
            color: NP_ORANGE,
            points: records.map((r) => ({
              label: labelFor(r),
              value: Math.round(Number(r.YTDNetProfit)),
            })),
          },
        ],
      })
    : "";

  const templatePath = path.join(
    process.cwd(),
    "lib",
    "templates",
    "member-performance.hbs",
  );
  const cssPath = path.join(
    process.cwd(),
    "lib",
    "templates",
    "member-performance.css",
  );

  const [logoDataUri, templateSource, css] = await Promise.all([
    fileToDataUri("public/Inbervel-logo.png"),
    fs.readFile(templatePath, "utf8"),
    fs.readFile(cssPath, "utf8"),
  ]);

  const template = Handlebars.compile(templateSource, { strict: true });

  const html = template({
    logoDataUri,
    css,
    displayName,
    companyDisplay,
    email,
    reportDate: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date()),
    periodCovered,
    hasRecords,
    records: serialisedRecords,
    monthlyChartSvg,
    gpChartSvg,
    npChartSvg,
    ytdChartSvg,
    noteContent: note?.content ?? "",
  });

  const filenameBase = sanitizeFilename(companyDisplay);

  return {
    html,
    filenameBase,
    displayName,
    found: Boolean(member) || hasRecords,
  };
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  if (value === null || value === undefined) return null;
  // Prisma Decimal / BigInt / Date etc. — coerce via String()
  const n = Number(String(value));
  return Number.isFinite(n) ? n : null;
}

function formatCurrency(value: number | null, currency: string): string {
  if (value === null) return "—";
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return String(Math.round(value));
  }
}

function formatPct(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function sanitizeFilename(name: string): string {
  return String(name || "Member")
    .replace(/[\/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
