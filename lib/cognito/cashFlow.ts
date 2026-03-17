import { prisma } from "@/lib/prisma";

export async function handleCashFlow(userEmail: string, payload: any) {
  const report = payload?.FinancialTargetsReport;
  const amount = report?.B21 != null ? String(report.B21).trim() : null;
  const includesVat = report?.G21 != null ? String(report.G21).trim() : null;

  if (!amount) {
    console.warn("[cognitoHandler] Form 41: missing B21, skipping CashFlow upsert.");
    return;
  }

  const existing = await prisma.cashFlow.findFirst({ where: { userEmail } });

  if (existing) {
    await prisma.cashFlow.update({
      where: { id: existing.id },
      data: {
        amount,
        ...(includesVat !== null ? { includesVat } : {}),
        recordedAt: new Date(),
      },
    });
  } else {
    await prisma.cashFlow.create({
      data: { userEmail, amount, includesVat: includesVat ?? "", recordedAt: new Date() },
    });
  }
}
