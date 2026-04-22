// POST /api/admin/member-performance/budgets
//
// Admin override for a member's monthly Rev / GP / NP budgets. Use when a
// client won't submit Form 25 themselves. Applies to every record in the
// member's current cycle and recomputes YTD budgets + pct fields.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { applyFinancialBudgets } from "@/lib/cognito/financialPeriods";
import { z } from "zod";

const bodySchema = z.object({
  userEmail: z.string().email(),
  revBudget: z.number().finite().nonnegative(),
  gpBudget: z.number().finite().nonnegative(),
  npBudget: z.number().finite().nonnegative(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const userEmail = parsed.data.userEmail.toLowerCase().trim();
  const { revBudget, gpBudget, npBudget } = parsed.data;

  await applyFinancialBudgets(userEmail, { gpBudget, revBudget, npBudget });

  return NextResponse.json({ ok: true });
}
