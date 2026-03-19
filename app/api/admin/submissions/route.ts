// GET /api/admin/submissions?email=<email>
//
// Returns all Cognito form submissions for a given client email address,
// along with a checklist of which required forms are present or missing,
// and a `readyToGenerate` flag that the admin UI uses to enable/disable
// the "Generate Business Plan PDF" button.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CompanyPayload = {
  CompanyName?: string;
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const email = req.nextUrl.searchParams.get("email")?.toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  // Fetch all submissions for this client, newest first.
  // We select the payload column here only to extract companyName as a fallback.
  const [submissions, member, forms] = await Promise.all([
    prisma.cognitoSubmission.findMany({
      where: { userEmail: email },
      select: {
        formId: true,
        formTitle: true,
        entryUpdatedAt: true,
        updatedAt: true,
        payload: true,
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
    prisma.user.findUnique({
      where: { email },
      select: { companyName: true },
    }),
    prisma.cognitoForm.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  // If the email doesn't exist in either the user table or submission records, return 404.
  if (!member && submissions.length === 0) {
    return NextResponse.json(
      { error: "No client found with that email address." },
      { status: 404 }
    );
  }

  // Resolve the company name: prefer the dedicated column (populated by the webhook handler),
  // but fall back to digging it out of the raw JSON payload if the column is empty.
  const companyName =
    member?.companyName ??
    (submissions.find(
      (s) => (s.payload as CompanyPayload).CompanyName,
    )?.payload as CompanyPayload | undefined)?.CompanyName ??
    null;

  // Build a checklist row for every required form so the UI can show which
  // forms have been submitted (green tick) and which are still missing (red cross).
  const presentFormIds = new Set(submissions.map((s) => s.formId));
  const required = forms.map((f) => ({
    formId: f.formId,
    key: f.key,
    title: f.title,
    present: presentFormIds.has(f.formId),
  }));

  // Only these 10 keys are needed for PDF generation — extra DB forms (e.g. Form 41) are excluded.
  const PDF_FORM_KEYS = new Set([
    "final", "offerings", "advantage", "sectors", "market",
    "ratesCard", "swot", "objectives", "financial", "risks",
  ]);
  const readyToGenerate = required
    .filter((r) => PDF_FORM_KEYS.has(r.key))
    .every((r) => r.present);

  // Strip the payload column before sending to the client — it can be large
  // and the UI only needs the metadata (formId, title, dates).
  const slimSubmissions = submissions.map((s) => ({
    formId: s.formId,
    formTitle: s.formTitle,
    entryUpdatedAt: s.entryUpdatedAt ? s.entryUpdatedAt.toISOString() : null,
    updatedAt: s.updatedAt.toISOString(),
  }));

  return NextResponse.json(
    {
      email,
      companyName,
      submissions: slimSubmissions,
      required,
      readyToGenerate,
    },
    { status: 200 }
  );
}
