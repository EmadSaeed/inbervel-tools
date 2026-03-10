import { prisma } from "@/lib/prisma";
import { ActionCategory } from "@prisma/client";

function toDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const PILLAR_MAP: Array<{
  field: string;
  dateField: string;
  category: ActionCategory;
}> = [
  { field: "Finance",        dateField: "Date1", category: "FINANCE" },
  { field: "Operations",     dateField: "Date2", category: "OPERATIONS" },
  { field: "SalesMarketing", dateField: "Date3", category: "SALES_MARKETING" },
  { field: "People",         dateField: "Date4", category: "PEOPLE" },
];

export async function handleNext90DaysActions(userEmail: string, payload: any) {
  console.log("[90DayActions] called for", userEmail);

  const block = payload?._3Next90DaysBigMovesForEachPillar;
  if (!block) {
    console.log("[90DayActions] no _3Next90DaysBigMovesForEachPillar block found — skipping");
    return;
  }
  console.log("[90DayActions] block found:", JSON.stringify(block));

  for (const { field, dateField, category } of PILLAR_MAP) {
    const description = typeof block[field] === "string" ? block[field].trim() : null;
    const targetDate = toDate(block[dateField]);
    console.log(`[90DayActions] ${category}: description=${description ? "ok" : "null"}, targetDate=${targetDate}`);
    if (!description || !targetDate) {
      console.log(`[90DayActions] ${category}: skipping — missing description or targetDate`);
      continue;
    }

    const existing = await prisma.ninetyDayAction.findFirst({
      where: { userEmail, category },
      select: { id: true, description: true, targetDate: true },
    });

    if (existing) {
      const descriptionChanged = existing.description !== description;
      const targetDateChanged = existing.targetDate.getTime() !== targetDate.getTime();
      const hasChanged = descriptionChanged || targetDateChanged;

      console.log(`[90DayActions] ${category}: updating existing row id=${existing.id}, hasChanged=${hasChanged}`);
      await prisma.ninetyDayAction.update({
        where: { id: existing.id },
        data: {
          description,
          targetDate,
          ...(hasChanged ? { status: "PENDING", completedAt: null } : {}),
        },
      });
    } else {
      console.log(`[90DayActions] ${category}: creating new row`);
      await prisma.ninetyDayAction.create({
        data: { userEmail, category, description, targetDate },
      });
    }
    console.log(`[90DayActions] ${category}: done`);
  }
  console.log("[90DayActions] all pillars processed");
}
