import { prisma } from "@/lib/prisma";

const pct = (num: unknown, denom: number): number | null =>
  denom > 0 ? (Number(num) / denom) * 100 : null;

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

  if (grossProfit === null && netProfit === null && revenue === null) {
    console.log("[financialPeriod] skipped: no financial values found in payload");
    return;
  }

  const month = payload?.Month_Value as number | undefined;
  const year = payload?.Year ? Number(payload.Year) : undefined;
  if (!month || !year) {
    console.log("[financialPeriod] skipped: missing Month_Value or Year in payload");
    return;
  }

  const { cycleNumber, periodNumber, gapPeriods } = await resolveNextPeriod(userEmail, month, year);

  for (const gap of gapPeriods) {
    await createPeriodRecord(userEmail, gap.cycleNumber, gap.periodNumber, 0, 0, 0, gap.month, gap.year);
  }

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
  // Prior records in the same cycle (used for YTD accumulation and budget inheritance)
  const priorRecords = await prisma.financialPeriodRecord.findMany({
    where: { userEmail, cycleNumber, periodNumber: { lt: periodNumber } },
    orderBy: { periodNumber: "desc" },
    select: {
      MonthGrossProfit: true,
      MonthRevenue: true,
      MonthNetProfit: true,
      MonthGrossProfitBudget: true,
      MonthRevenueBudget: true,
      MonthNetProfitBudget: true,
    },
  });

  const YTDGrossProfit = priorRecords.reduce((s, r) => s + Number(r.MonthGrossProfit), 0) + grossProfit;
  const YTDRevenue     = priorRecords.reduce((s, r) => s + Number(r.MonthRevenue),     0) + revenue;
  const YTDNetProfit   = priorRecords.reduce((s, r) => s + Number(r.MonthNetProfit),   0) + netProfit;

  const prior = priorRecords[0]; // most recent prior period
  const gpBudget = prior ? Number(prior.MonthGrossProfitBudget) : 0;
  const revBudget = prior ? Number(prior.MonthRevenueBudget) : 0;
  const npBudget = prior ? Number(prior.MonthNetProfitBudget) : 0;

  const YTDGpBudget = gpBudget * periodNumber;
  const YTDRevBudget = revBudget * periodNumber;
  const YTDNpBudget = npBudget * periodNumber;

  const data = {
    MonthGrossProfit: grossProfit,
    MonthRevenue: revenue,
    MonthNetProfit: netProfit,
    MonthGrossProfitBudget: gpBudget,
    MonthRevenueBudget: revBudget,
    MonthNetProfitBudget: npBudget,
    MonthGrossProfitPct: pct(grossProfit, gpBudget),
    MonthRevenuePct:     pct(revenue,     revBudget),
    MonthNetProfitPct:   pct(netProfit,   npBudget),
    YTDGrossProfit,
    YTDRevenue,
    YTDNetProfit,
    YTDGrossProfitBudget: YTDGpBudget,
    YTDRevenueBudget: YTDRevBudget,
    YTDNetProfitBudget: YTDNpBudget,
    YTDGrossProfitPct: pct(YTDGrossProfit, YTDGpBudget),
    YTDRevenuePct:     pct(YTDRevenue,     YTDRevBudget),
    YTDNetProfitPct:   pct(YTDNetProfit,   YTDNpBudget),
    recordedAt: new Date(year, month - 1, 1),
  };

  await prisma.financialPeriodRecord.upsert({
    where: {
      userEmail_cycleNumber_periodNumber: { userEmail, cycleNumber, periodNumber },
    },
    create: { userEmail, cycleNumber, periodNumber, ...data },
    update: data,
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

  // Budget-only seed (no Month values written yet) → overwrite it in place
  const isSeed =
    Number(latest.MonthGrossProfit) === 0 &&
    Number(latest.MonthRevenue) === 0 &&
    Number(latest.MonthNetProfit) === 0;
  if (isSeed) {
    return { cycleNumber: latest.cycleNumber, periodNumber: latest.periodNumber, gapPeriods: [] };
  }

  const lastDate = new Date(latest.recordedAt);
  const lastMonth = lastDate.getMonth() + 1; // 1-based
  const lastYear = lastDate.getFullYear();

  // Same calendar month → overwrite current period
  if (year === lastYear && month === lastMonth) {
    return { cycleNumber: latest.cycleNumber, periodNumber: latest.periodNumber, gapPeriods: [] };
  }

  const monthsElapsed = (year - lastYear) * 12 + (month - lastMonth);

  const gapPeriods: { cycleNumber: number; periodNumber: number; month: number; year: number }[] = [];
  let currentCycle = latest.cycleNumber;
  let currentPeriod = latest.periodNumber;
  let gapMonth = lastMonth;
  let gapYear = lastYear;

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

  currentPeriod++;
  if (currentPeriod > 12) {
    currentCycle++;
    currentPeriod = 1;
  }

  return { cycleNumber: currentCycle, periodNumber: currentPeriod, gapPeriods };
}

/**
 * Called by form 25 (FORM_ID_FINANCIAL) — writes monthly budgets into the
 * user's current cycle of FinancialPeriodRecord rows, recomputing YTD budgets
 * and all six percentage fields for each affected record.
 *
 * If the user has no records yet, creates a P1/cycle1 seed (zero values, budgets only).
 */
export async function handleFinancialBudgets(userEmail: string, payload: any) {
  const pl = payload?.ProfitAndLossReport;
  const gpBudget = Number(pl?.H28 ?? 0);
  const revBudget = Number(pl?.H9 ?? 0);
  const npBudget = Number(pl?.H52 ?? 0);

  if (!gpBudget && !revBudget && !npBudget) {
    console.log("[financialBudgets] skipped: no budget values in payload");
    return;
  }

  const latest = await prisma.financialPeriodRecord.findFirst({
    where: { userEmail },
    orderBy: [{ cycleNumber: "desc" }, { periodNumber: "desc" }],
  });

  if (!latest) {
    await prisma.financialPeriodRecord.create({
      data: {
        userEmail,
        cycleNumber: 1,
        periodNumber: 1,
        MonthGrossProfit: 0,
        MonthRevenue: 0,
        MonthNetProfit: 0,
        MonthGrossProfitBudget: gpBudget,
        MonthRevenueBudget: revBudget,
        MonthNetProfitBudget: npBudget,
        MonthGrossProfitPct: null,
        MonthRevenuePct: null,
        MonthNetProfitPct: null,
        YTDGrossProfit: 0,
        YTDRevenue: 0,
        YTDNetProfit: 0,
        YTDGrossProfitBudget: gpBudget,
        YTDRevenueBudget: revBudget,
        YTDNetProfitBudget: npBudget,
        YTDGrossProfitPct: null,
        YTDRevenuePct: null,
        YTDNetProfitPct: null,
        recordedAt: new Date(),
      },
    });
    return;
  }

  const records = await prisma.financialPeriodRecord.findMany({
    where: { userEmail, cycleNumber: latest.cycleNumber },
    orderBy: { periodNumber: "asc" },
  });

  for (const r of records) {
    const ytdGp = gpBudget * r.periodNumber;
    const ytdRev = revBudget * r.periodNumber;
    const ytdNp = npBudget * r.periodNumber;
    await prisma.financialPeriodRecord.update({
      where: { id: r.id },
      data: {
        MonthGrossProfitBudget: gpBudget,
        MonthRevenueBudget: revBudget,
        MonthNetProfitBudget: npBudget,
        YTDGrossProfitBudget: ytdGp,
        YTDRevenueBudget: ytdRev,
        YTDNetProfitBudget: ytdNp,
        MonthGrossProfitPct: pct(r.MonthGrossProfit, gpBudget),
        MonthRevenuePct:     pct(r.MonthRevenue,     revBudget),
        MonthNetProfitPct:   pct(r.MonthNetProfit,   npBudget),
        YTDGrossProfitPct:   pct(r.YTDGrossProfit, ytdGp),
        YTDRevenuePct:       pct(r.YTDRevenue,     ytdRev),
        YTDNetProfitPct:     pct(r.YTDNetProfit,   ytdNp),
      },
    });
  }
}
