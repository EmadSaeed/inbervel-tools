import { prisma } from "@/lib/prisma";
import { BUSINESS_PLAN_FORMS } from "@/lib/forms/requiredForms";

// Shape of the data object passed into the Handlebars PDF template.
// `css` and `riskChartDataUri` start empty and are filled in by the render step
// (renderTemplate.ts) just before the template is compiled, so the template
// always receives fully-populated data.
export type BusinessPlanTemplateDto = {
  planTitle: string;
  css: string;            // injected by renderTemplate.ts
  logoUrl: string;        // permanent Vercel Blob URL for the company logo
  riskChartDataUri: string; // base64 data URI, injected by renderTemplate.ts

  // Each field below is the raw JSON payload from the corresponding Cognito form.
  // The Handlebars template accesses fields directly, e.g. {{final.CompanyName}}.
  final: any;       // form 29 — Final Reflections & Summary (also has company logo)
  offerings: any;   // form 14 — Offerings Prioritisation
  advantage: any;   // form 11 — Competitive Advantage
  sectors: any;     // form 15 — Client Targeting / Sectors
  market: any;      // form 16 — Route to Market
  ratesCard: any;   // form 23 — Labour Rates Card
  swot: any;        // form 12 — SWOT Analysis
  objectives: any;  // form 8  — Objectives
  financial: any;   // form 25 — Financial Forecast
  risks: any;       // form 39 — Risk Identification
};

function getString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length ? trimmed : null;
}

function isHttpUrl(v: string): boolean {
  return /^https?:\/\//i.test(v);
}

function isBlobUrl(v: string): boolean {
  return /(^https?:\/\/)?[^/]*vercel-storage\.com\//i.test(v);
}

function pickLogoUrlFromFinalPayload(finalPayload: unknown): string | null {
  if (!finalPayload || typeof finalPayload !== "object") return null;
  const payload = finalPayload as Record<string, unknown>;

  // Prefer explicit blob URL fields if present in newer payload variants.
  const directCandidates = [
    payload.CompanyLogoBlobUrl,
    payload.companyLogoBlobUrl,
    payload.CompanyLogoUrl,
    payload.companyLogoUrl,
    payload.CompanyLogoBlob,
    payload.companyLogoBlob,
  ];

  for (const value of directCandidates) {
    const url = getString(value);
    if (url && isHttpUrl(url)) return url;
  }

  // Fallback to file-upload array shape: CompanyLogo[0].File.
  const companyLogo = payload.CompanyLogo;
  const firstLogoFile =
    Array.isArray(companyLogo) && companyLogo.length > 0
      ? (companyLogo[0] as { File?: unknown })?.File
      : null;
  const uploadFile = getString(firstLogoFile);
  if (!uploadFile) return null;

  // Ignore Cognito temporary URLs when possible; prefer persisted blob URLs.
  if (isBlobUrl(uploadFile)) return uploadFile;
  return null;
}

// Fetches all required form submissions for a given client from the database
// and assembles them into a single DTO ready to be passed into the PDF template.
// Throws if any required form is missing — all 10 must be present.
export async function buildBusinessPlanTemplateDto(
  userEmailRaw: string,
): Promise<BusinessPlanTemplateDto> {
  const userEmail = userEmailRaw.toLowerCase().trim();
  if (!userEmail) throw new Error("Missing email");

  const requiredFormIds = BUSINESS_PLAN_FORMS.map((f) => f.formId);

  // Fetch only the columns we need for PDF generation (avoids loading unnecessary data).
  const rows = await prisma.cognitoSubmission.findMany({
    where: { userEmail, formId: { in: requiredFormIds } },
    select: { formId: true, payload: true },
  });

  // Guard: if any required form has not been submitted, we cannot build the plan.
  const missing = requiredFormIds.filter(
    (id) => !rows.some((r) => r.formId === id),
  );
  if (missing.length)
    throw new Error(`Missing required forms: ${missing.join(", ")}`);

  // Helper shortcuts so we don't repeat the find call for every form.
  const getRow = (formId: string) => rows.find((r) => r.formId === formId)!;
  const getPayload = (formId: string) => getRow(formId).payload as any;

  const member = await prisma.user.findUnique({
    where: { email: userEmail },
    select: { companyLogoUrl: true },
  });
  const finalPayload = getPayload("29");
  const logoUrl =
    pickLogoUrlFromFinalPayload(finalPayload) ?? member?.companyLogoUrl ?? "";

  return {
    planTitle: "Business Plan",
    css: "",           // filled in by renderTemplate.ts
    logoUrl,
    riskChartDataUri: "", // filled in by renderTemplate.ts

    final: finalPayload,
    offerings: getPayload("14"),
    advantage: getPayload("11"),
    sectors: getPayload("15"),
    market: getPayload("16"),
    ratesCard: getPayload("23"),
    swot: getPayload("12"),
    objectives: getPayload("8"),
    financial: getPayload("25"),
    risks: getPayload("39"),
  };
}
