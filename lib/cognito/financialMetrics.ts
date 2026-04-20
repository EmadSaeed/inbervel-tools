import { prisma } from "@/lib/prisma";

export interface MetricData {
  monthPercentage: number;
  yearPercentage: number;
  monthValue: string;
  yearValue: string;
}

const fmt = (v: { toString(): string } | null | undefined, currency = "GBP") =>
  v != null
    ? new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Number(v))
    : "—";

const EMPTY: MetricData = {
  monthPercentage: 0,
  yearPercentage: 0,
  monthValue: "—",
  yearValue: "—",
};

/**
 * Reads the latest FinancialPeriodRecord for the user and projects it into
 * the MetricData shape the business dashboard renders.
 *
 * Month gauge → Month* fields; Year gauge → YTD* fields.
 */
export async function getLatestFinancialSnapshot(userEmail: string): Promise<{
  grossProfit: MetricData;
  revenue: MetricData;
  netProfit: MetricData;
}> {
  const latest = await prisma.financialPeriodRecord.findFirst({
    where: { userEmail },
    orderBy: [{ cycleNumber: "desc" }, { periodNumber: "desc" }],
  });

  if (!latest) {
    return { grossProfit: EMPTY, revenue: EMPTY, netProfit: EMPTY };
  }

  const currency = latest.currency;
  const build = (
    monthVal: unknown,
    ytdVal: unknown,
    monthPct: number | null,
    ytdPct: number | null,
  ): MetricData => ({
    monthPercentage: monthPct ?? 0,
    yearPercentage: ytdPct ?? 0,
    monthValue: fmt(monthVal as never, currency),
    yearValue: fmt(ytdVal as never, currency),
  });

  return {
    grossProfit: build(latest.MonthGrossProfit, latest.YTDGrossProfit, latest.MonthGrossProfitPct, latest.YTDGrossProfitPct),
    revenue:     build(latest.MonthRevenue,     latest.YTDRevenue,     latest.MonthRevenuePct,     latest.YTDRevenuePct),
    netProfit:   build(latest.MonthNetProfit,   latest.YTDNetProfit,   latest.MonthNetProfitPct,   latest.YTDNetProfitPct),
  };
}
