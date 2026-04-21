// GET /api/admin/member-performance?email=<email>
//
// Returns the member's FinancialPeriodRecord history plus their
// saved MemberPerformanceNote for the admin dashboard.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/auth";
import { getFinancialPeriodRecords } from "@/lib/cognito/financialPeriods";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const email = req.nextUrl.searchParams.get("email")?.toLowerCase().trim();
  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  const [member, records, note] = await Promise.all([
    prisma.user.findUnique({
      where: { email },
      select: { companyName: true, firstName: true, lastName: true },
    }),
    getFinancialPeriodRecords(email),
    prisma.memberPerformanceNote.findUnique({
      where: { userEmail: email },
      select: { content: true, updatedAt: true, updatedBy: true },
    }),
  ]);

  if (!member && records.length === 0) {
    return NextResponse.json(
      { error: "No client found with that email address." },
      { status: 404 },
    );
  }

  const serialised = records.map((r) => ({
    id: r.id,
    cycleNumber: r.cycleNumber,
    periodNumber: r.periodNumber,
    month: r.month,
    year: r.year,
    MonthGrossProfit: Number(r.MonthGrossProfit),
    MonthRevenue: Number(r.MonthRevenue),
    MonthNetProfit: Number(r.MonthNetProfit),
    MonthGrossProfitBudget: Number(r.MonthGrossProfitBudget),
    MonthRevenueBudget: Number(r.MonthRevenueBudget),
    MonthNetProfitBudget: Number(r.MonthNetProfitBudget),
    MonthGrossProfitPct: r.MonthGrossProfitPct,
    MonthRevenuePct: r.MonthRevenuePct,
    MonthNetProfitPct: r.MonthNetProfitPct,
    YTDGrossProfit: Number(r.YTDGrossProfit),
    YTDRevenue: Number(r.YTDRevenue),
    YTDNetProfit: Number(r.YTDNetProfit),
    YTDGrossProfitBudget: Number(r.YTDGrossProfitBudget),
    YTDRevenueBudget: Number(r.YTDRevenueBudget),
    YTDNetProfitBudget: Number(r.YTDNetProfitBudget),
    YTDGrossProfitPct: r.YTDGrossProfitPct,
    YTDRevenuePct: r.YTDRevenuePct,
    YTDNetProfitPct: r.YTDNetProfitPct,
    currency: r.currency,
    recordedAt: r.recordedAt.toISOString(),
  }));

  return NextResponse.json(
    {
      email,
      companyName: member?.companyName ?? null,
      memberName:
        [member?.firstName, member?.lastName].filter(Boolean).join(" ").trim() ||
        null,
      records: serialised,
      note: note
        ? {
            content: note.content,
            updatedAt: note.updatedAt.toISOString(),
            updatedBy: note.updatedBy,
          }
        : null,
    },
    { status: 200 },
  );
}
