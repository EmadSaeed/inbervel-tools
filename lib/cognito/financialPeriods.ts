import { prisma } from "@/lib/prisma";

/**
 * Called by form 41 (FORM_ID_CASH_FLOW) — creates/updates a period record
 * in the user's 12-month financial cycle.
 */
export async function handleFinancialPeriod(userEmail: string, payload: any) {
  const pl = payload?.ProfitAndLossReport;
  const ft = payload?.FinancialTargetsReport;

  const grossProfit = pl?.D30 ?? null;
  const netProfit = pl?.D57 ?? null;
  const revenue = ft?.B8 ?? null;

  console.log("[financialPeriod] values:", { grossProfit, netProfit, revenue, Month_Value: payload?.Month_Value, Year: payload?.Year });

  // Can't create a period record without at least one value
  if (grossProfit === null && netProfit === null && revenue === null) {
    console.log("[financialPeriod] skipped: no financial values found in payload");
    return;
  }

  // Use form payload Month_Value (1-12) and Year to determine the submission period
  const month = payload?.Month_Value as number | undefined;
  const year = payload?.Year ? Number(payload.Year) : undefined;
  if (!month || !year) {
    console.log("[financialPeriod] skipped: missing Month_Value or Year in payload");
    return;
  }

  const { cycleNumber, periodNumber, gapPeriods } = await resolveNextPeriod(userEmail, month, year);

  // Fill any missed months with zero values
  for (const gap of gapPeriods) {
    await createPeriodRecord(userEmail, gap.cycleNumber, gap.periodNumber, 0, 0, 0, gap.month, gap.year);
  }

  // Create/update the current period with actual values
  await createPeriodRecord(
    userEmail,
    cycleNumber,
    periodNumber,
    grossProfit ?? 0,
    revenue ?? 0,
    netProfit ?? 0,
    month,
    year,
  );
}

async function createPeriodRecord(
  userEmail: string,
  cycleNumber: number,
  periodNumber: number,
  grossProfit: number,
  revenue: number,
  netProfit: number,
  month: number,
  year: number,
) {
  // Compute accumulated values from prior periods in this cycle
  const priorRecords = await prisma.financialPeriodRecord.findMany({
    where: { userEmail, cycleNumber, periodNumber: { lt: periodNumber } },
    select: { grossProfit: true, revenue: true, netProfit: true },
  });

  const grossProfitAccum = priorRecords.reduce((sum, r) => sum + Number(r.grossProfit), 0) + grossProfit;
  const revenueAccum = priorRecords.reduce((sum, r) => sum + Number(r.revenue), 0) + revenue;
  const netProfitAccum = priorRecords.reduce((sum, r) => sum + Number(r.netProfit), 0) + netProfit;

  // Compute targets: periodNumber × monthly budget from FinancialMetric
  const targets = await computeTargets(userEmail, periodNumber);

  // Compute percentages
  const grossProfitPct = targets.grossProfitTarget && targets.grossProfitTarget !== 0
    ? (grossProfitAccum / targets.grossProfitTarget) * 100 : null;
  const revenuePct = targets.revenueTarget && targets.revenueTarget !== 0
    ? (revenueAccum / targets.revenueTarget) * 100 : null;
  const netProfitPct = targets.netProfitTarget && targets.netProfitTarget !== 0
    ? (netProfitAccum / targets.netProfitTarget) * 100 : null;

  await prisma.financialPeriodRecord.upsert({
    where: {
      userEmail_cycleNumber_periodNumber: { userEmail, cycleNumber, periodNumber },
    },
    create: {
      userEmail,
      cycleNumber,
      periodNumber,
      grossProfit,
      revenue,
      netProfit,
      grossProfitAccum,
      revenueAccum,
      netProfitAccum,
      grossProfitTarget: targets.grossProfitTarget,
      revenueTarget: targets.revenueTarget,
      netProfitTarget: targets.netProfitTarget,
      grossProfitPct,
      revenuePct,
      netProfitPct,
      recordedAt: new Date(year, month - 1, 1),
    },
    update: {
      grossProfit,
      revenue,
      netProfit,
      grossProfitAccum,
      revenueAccum,
      netProfitAccum,
      grossProfitTarget: targets.grossProfitTarget,
      revenueTarget: targets.revenueTarget,
      netProfitTarget: targets.netProfitTarget,
      grossProfitPct,
      revenuePct,
      netProfitPct,
      recordedAt: new Date(year, month - 1, 1),
    },
  });
}

/**
 * Determines the next period number and cycle, plus any gap periods to fill.
 */
async function resolveNextPeriod(userEmail: string, month: number, year: number): Promise<{
  cycleNumber: number;
  periodNumber: number;
  gapPeriods: { cycleNumber: number; periodNumber: number; month: number; year: number }[];
}> {
  const latest = await prisma.financialPeriodRecord.findFirst({
    where: { userEmail },
    orderBy: [{ cycleNumber: "desc" }, { periodNumber: "desc" }],
  });

  // First ever submission
  if (!latest) {
    return { cycleNumber: 1, periodNumber: 1, gapPeriods: [] };
  }

  const lastDate = new Date(latest.recordedAt);
  const lastMonth = lastDate.getMonth() + 1; // 1-based
  const lastYear = lastDate.getFullYear();

  // Same calendar month → overwrite current period
  if (year === lastYear && month === lastMonth) {
    return { cycleNumber: latest.cycleNumber, periodNumber: latest.periodNumber, gapPeriods: [] };
  }

  // Calculate months elapsed since last record
  const monthsElapsed = (year - lastYear) * 12 + (month - lastMonth);

  const gapPeriods: { cycleNumber: number; periodNumber: number; month: number; year: number }[] = [];
  let currentCycle = latest.cycleNumber;
  let currentPeriod = latest.periodNumber;
  let gapMonth = lastMonth;
  let gapYear = lastYear;

  // Fill gaps for missed months (monthsElapsed - 1 gaps, then the actual new period)
  for (let i = 1; i < monthsElapsed; i++) {
    currentPeriod++;
    if (currentPeriod > 12) {
      currentCycle++;
      currentPeriod = 1;
    }
    gapMonth++;
    if (gapMonth > 12) {
      gapMonth = 1;
      gapYear++;
    }
    gapPeriods.push({ cycleNumber: currentCycle, periodNumber: currentPeriod, month: gapMonth, year: gapYear });
  }

  // The actual new period
  currentPeriod++;
  if (currentPeriod > 12) {
    currentCycle++;
    currentPeriod = 1;
  }

  return { cycleNumber: currentCycle, periodNumber: currentPeriod, gapPeriods };
}

/**
 * Fetches monthly budgets from FinancialMetric and scales by periodNumber.
 */
async function computeTargets(userEmail: string, periodNumber: number) {
  const metrics = await prisma.financialMetric.findMany({
    where: { userEmail, period: "MONTH" },
    select: { type: true, budget: true },
  });

  const getMonthlyBudget = (type: string) => {
    const m = metrics.find((r) => r.type === type);
    return m?.budget ? Number(m.budget) : null;
  };

  const gpBudget = getMonthlyBudget("GROSS_PROFIT");
  const revBudget = getMonthlyBudget("REVENUE");
  const npBudget = getMonthlyBudget("NET_PROFIT");

  return {
    grossProfitTarget: gpBudget ? gpBudget * periodNumber : null,
    revenueTarget: revBudget ? revBudget * periodNumber : null,
    netProfitTarget: npBudget ? npBudget * periodNumber : null,
  };
}
