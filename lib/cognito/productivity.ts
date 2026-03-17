import { prisma } from "@/lib/prisma";

export async function recalculateProductivityPercentage(userEmail: string) {
  const record = await prisma.productivityRecord.findUnique({ where: { userEmail } });
  if (!record?.theMonthRpp || !record?.targetFigure) return;

  const theMonthRpp = Number(record.theMonthRpp);
  const targetFigure = Number(record.targetFigure);
  if (targetFigure === 0) return;

  const percentage = (theMonthRpp / targetFigure) * 100;
  await prisma.productivityRecord.update({
    where: { userEmail },
    data: { percentage },
  });
}
