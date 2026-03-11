import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import BusinessDashboardClient from "./BusinessDashboardClient";

export default async function BusinessDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/business-dashboard/login");

  const userEmail = session.user.email as string;

  const [actions, actionToolRows, forms, submissions, member] = await Promise.all([
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

  const readyToGenerate = actionTools.length > 0 && actionTools.every((t) => t.status === "COMPLETE");

  return (
    <BusinessDashboardClient
      ninetyDayActions={actions}
      userEmail={userEmail}
      actionTools={actionTools}
      readyToGenerate={readyToGenerate}
      companyName={member?.companyName ?? null}
      companyLogoUrl={member?.companyLogoUrl ?? null}
    />
  );
}
