import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getDownloadUrl } from "@vercel/blob";
import BusinessDashboardClient from "./BusinessDashboardClient";

export default async function BusinessDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/business-dashboard/login");

  const userEmail = session.user.email;

  const [actions, actionToolRows, forms, submissions] = await Promise.all([
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
  ]);

  // Build a map of formId -> signed download URL from CognitoSubmission.outputPdfUrl
  const pdfUrlByFormId = new Map<string, string>();
  for (const sub of submissions) {
    if (sub.outputPdfUrl) {
      pdfUrlByFormId.set(sub.formId, getDownloadUrl(sub.outputPdfUrl));
    }
  }

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
      fileUrl: pdfUrlByFormId.get(form.formId) ?? null,
    };
  });

  const readyToGenerate = actionTools.length > 0 && actionTools.every((t) => t.status === "COMPLETE");

  return (
    <BusinessDashboardClient
      ninetyDayActions={actions}
      userEmail={userEmail}
      actionTools={actionTools}
      readyToGenerate={readyToGenerate}
    />
  );
}
