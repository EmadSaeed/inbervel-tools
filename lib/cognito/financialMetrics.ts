import { prisma } from "@/lib/prisma";

export async function upsertFinancialMetric(
  userEmail: string,
  type: "GROSS_PROFIT" | "REVENUE" | "NET_PROFIT",
  period: "MONTH" | "YEAR",
  value: number | null,
  percentage: number | null,
  budget: number | null = null,
) {
  const existing = await prisma.financialMetric.findFirst({
    where: { userEmail, type, period },
  });

  if (existing) {
    await prisma.financialMetric.update({
      where: { id: existing.id },
      data: {
        ...(value !== null ? { value } : {}),
        ...(percentage !== null ? { percentage } : {}),
        ...(budget !== null ? { budget } : {}),
        recordedAt: new Date(),
      },
    });
  } else {
    if (value === null) return; // can't create without a value
    await prisma.financialMetric.create({
      data: { userEmail, type, period, value, percentage: percentage ?? undefined, budget: budget ?? undefined, recordedAt: new Date() },
    });
  }
}

export async function recalculateGrossProfitPercentage(userEmail: string, period: "MONTH" | "YEAR") {
  const metric = await prisma.financialMetric.findFirst({
    where: { userEmail, type: "GROSS_PROFIT", period },
  });

  if (!metric || metric.budget === null) return;

  const value = Number(metric.value);
  const budget = Number(metric.budget);
  if (budget === 0) return;

  const percentage = value / budget * 100;

  await prisma.financialMetric.update({
    where: { id: metric.id },
    data: { percentage },
  });
}

export async function recalculateRevenuePercentage(userEmail: string, period: "MONTH" | "YEAR") {
  const revenue = await prisma.financialMetric.findFirst({ where: { userEmail, type: "REVENUE", period } });
  if (!revenue || revenue.budget === null) return;

  const revenueValue = Number(revenue.value);
  const budget = Number(revenue.budget);
  if (budget === 0) return;

  const percentage = revenueValue / budget * 100;

  await prisma.financialMetric.update({
    where: { id: revenue.id },
    data: { percentage },
  });
}

export async function recalculateNetProfitPercentage(userEmail: string, period: "MONTH" | "YEAR") {
  const netProfit = await prisma.financialMetric.findFirst({ where: { userEmail, type: "NET_PROFIT", period } });
  if (!netProfit || netProfit.budget === null) return;

  const netProfitValue = Number(netProfit.value);
  const budget = Number(netProfit.budget);
  if (budget === 0) return;

  const percentage = netProfitValue / budget * 100;

  await prisma.financialMetric.update({
    where: { id: netProfit.id },
    data: { percentage },
  });
}

async function recalculateAllPercentages(userEmail: string) {
  await recalculateGrossProfitPercentage(userEmail, "MONTH");
  await recalculateGrossProfitPercentage(userEmail, "YEAR");
  await recalculateRevenuePercentage(userEmail, "MONTH");
  await recalculateRevenuePercentage(userEmail, "YEAR");
  await recalculateNetProfitPercentage(userEmail, "MONTH");
  await recalculateNetProfitPercentage(userEmail, "YEAR");
}

// Called by form 41 — upserts values from ProfitAndLoss + FinancialTargets reports.
export async function handleFinancialMetrics(userEmail: string, payload: any) {
  const pl = payload?.ProfitAndLossReport;
  const ft = payload?.FinancialTargetsReport;

  await Promise.all([
    upsertFinancialMetric(userEmail, "GROSS_PROFIT", "MONTH", pl?.D30 ?? null, null),
    upsertFinancialMetric(userEmail, "GROSS_PROFIT", "YEAR",  pl?.D30 ?? null, null),
    upsertFinancialMetric(userEmail, "NET_PROFIT",   "MONTH", pl?.D57 ?? null, null),
    upsertFinancialMetric(userEmail, "NET_PROFIT",   "YEAR",  pl?.D57 ?? null, null),
    upsertFinancialMetric(userEmail, "REVENUE",      "MONTH", ft?.B8  ?? null, null),
    upsertFinancialMetric(userEmail, "REVENUE",      "YEAR",  ft?.B8  ?? null, null),
  ]);

  await recalculateAllPercentages(userEmail);
}

// Called by form 25 — upserts budget figures from ProfitAndLoss report.
export async function handleFinancialBudgets(userEmail: string, payload: any) {
  const pl = payload?.ProfitAndLossReport;

  await Promise.all([
    upsertFinancialMetric(userEmail, "GROSS_PROFIT", "MONTH", null, null, pl?.H28 ?? null),
    upsertFinancialMetric(userEmail, "GROSS_PROFIT", "YEAR",  null, null, pl?.I28 ?? null),
    upsertFinancialMetric(userEmail, "REVENUE",      "MONTH", null, null, pl?.H9  ?? null),
    upsertFinancialMetric(userEmail, "REVENUE",      "YEAR",  null, null, pl?.I9  ?? null),
    upsertFinancialMetric(userEmail, "NET_PROFIT",   "MONTH", null, null, pl?.H52 ?? null),
    upsertFinancialMetric(userEmail, "NET_PROFIT",   "YEAR",  null, null, pl?.I52 ?? null),
  ]);

  await recalculateAllPercentages(userEmail);
}
