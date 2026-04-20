import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getLatestFinancialSnapshot } from "@/lib/cognito/financialMetrics";
import BusinessDashboardClient from "./BusinessDashboardClient";

export default async function BusinessDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/business-dashboard/login");

  const userEmail = session.user.email as string;

  const [actions, actionToolRows, forms, submissions, member, cashFlow, productivity, financialSnapshot] = await Promise.all([
    prisma.ninetyDayAction.findMany({
      where: { userEmail },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        category: true,
        description: true,
        targetDate: true,
        status: true,
      },
    }),
    prisma.actionTool.findMany({
      where: { userEmail, formId: { not: null } },
      select: { formId: true, status: true },
    }),
    prisma.cognitoForm.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.cognitoSubmission.findMany({
      where: { userEmail },
      select: { formId: true, outputPdfUrl: true },
    }),
    prisma.user.findUnique({
      where: { email: userEmail },
      select: { companyName: true, companyLogoUrl: true },
    }),
    prisma.cashFlow.findFirst({
      where: { userEmail },
      select: { amount: true, includesVat: true },
      orderBy: { recordedAt: "desc" },
    }),
    prisma.productivityRecord.findUnique({
      where: { userEmail },
      select: { percentage: true, breakEvenRpp: true, theMonthRpp: true, targetFigure: true },
    }),
    getLatestFinancialSnapshot(userEmail),
  ]);

  const submittedFormIds = new Set(submissions.filter((s) => s.outputPdfUrl).map((s) => s.formId));

  // Merge CognitoForm definitions with any submitted ActionTool rows.
  const toolByFormId = new Map(actionToolRows.map((r) => [r.formId, r]));
  const actionTools = forms.map((form) => {
    const row = toolByFormId.get(form.formId);
    return {
      formId: form.formId,
      title: form.title,
      formUrl: form.formUrl,
      sortOrder: form.sortOrder,
      status: (row?.status ?? "INCOMPLETE") as "COMPLETE" | "INCOMPLETE",
      fileUrl: submittedFormIds.has(form.formId) && form.key !== "final"
        ? `/api/business-dashboard/download-tool-pdf?formId=${encodeURIComponent(form.formId)}`
        : null,
    };
  });

  const PDF_FORM_KEYS = new Set([
    "final", "offerings", "advantage", "sectors", "market",
    "ratesCard", "swot", "objectives", "financial", "risks",
  ]);
  const pdfFormIds = new Set(forms.filter((f) => PDF_FORM_KEYS.has(f.key)).map((f) => f.formId));
  const readyToGenerate = pdfFormIds.size > 0 && actionTools
    .filter((t) => pdfFormIds.has(t.formId))
    .every((t) => t.status === "COMPLETE");

  // Fetch the private company logo server-side and convert to a base64 data URL
  // so the browser can display it without hitting the private blob directly.
  let companyLogoDataUrl: string | null = null;
  if (member?.companyLogoUrl) {
    try {
      const res = await fetch(member.companyLogoUrl, {
        headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
      });
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const contentType = res.headers.get("content-type") ?? "image/png";
        companyLogoDataUrl = `data:${contentType};base64,${base64}`;
      }
    } catch {
      // logo fetch failed — fall back to text logo
    }
  }

  return (
    <BusinessDashboardClient
      ninetyDayActions={actions}
      userEmail={userEmail}
      actionTools={actionTools}
      readyToGenerate={readyToGenerate}
      companyName={member?.companyName ?? null}
      companyLogoUrl={companyLogoDataUrl}
      cashFlow={cashFlow ? { amount: cashFlow.amount.toString(), includesVat: String(cashFlow.includesVat) } : null}
      grossProfit={financialSnapshot.grossProfit}
      revenue={financialSnapshot.revenue}
      netProfit={financialSnapshot.netProfit}
      productivity={productivity ? {
        percentage: productivity.percentage,
        breakEvenRpp: productivity.breakEvenRpp?.toString() ?? null,
        theMonthRpp: productivity.theMonthRpp?.toString() ?? null,
        targetFigure: productivity.targetFigure?.toString() ?? null,
      } : null}
    />
  );
}
