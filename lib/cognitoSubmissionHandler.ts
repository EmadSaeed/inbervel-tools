import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";

// Safely parses an ISO date string into a Date object.
// Returns null if the value is missing or not a valid date.
function toDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Sanitises a string so it is safe to use as part of a Vercel Blob path.
// Converts to lowercase, replaces spaces with hyphens, and strips special characters.
function safeKeyPart(v: string) {
  return v
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "");
}

// Pulls all the fields we care about out of the raw Cognito Forms webhook payload.
// Cognito sends everything as a flat JSON object — this function normalises the fields
// into a clean, typed structure that the rest of the handler can use.
function extractFromCognito(payload: any) {
  const formId = String(payload?.Form?.Id ?? "");
  const formTitle = payload?.Form?.Name ? String(payload.Form.Name) : null;

  // Cognito sometimes prefixes email values with "mailto:" — strip that prefix.
  const rawEmail = payload?.Email ? String(payload.Email) : "";
  const userEmail = rawEmail
    .replace(/^mailto:/i, "")
    .toLowerCase()
    .trim();

  const entryCreatedAt = toDate(payload?.Entry?.DateCreated);
  const entryUpdatedAt = toDate(payload?.Entry?.DateUpdated);

  if (!formId) throw new Error("Missing Form.Id");
  if (!userEmail) throw new Error("Missing Email");

  return {
    formId,
    formTitle,
    userEmail,
    entryCreatedAt,
    entryUpdatedAt,
  };
}

// Extracts the company logo file object from the Cognito payload.
// CompanyLogo is an array of uploaded file objects; we only ever use the first one.
// Returns null if no file was uploaded.
function getCompanyLogo(payload: any) {
  const fileObj = payload?.CompanyLogo?.[0];
  if (!fileObj?.File) return null;

  return {
    fileUrl: String(fileObj.File),
    filename: fileObj?.Name ? String(fileObj.Name) : "company-logo",
    contentType: fileObj?.ContentType
      ? String(fileObj.ContentType)
      : "application/octet-stream",
  };
}

async function uploadRemoteFileToBlob(opts: {
  fileUrl: string;
  pathname: string;
  contentTypeHint?: string;
}): Promise<string> {
  const fileUrl = String(opts.fileUrl || "").trim();
  if (!fileUrl) throw new Error("uploadRemoteFileToBlob: missing fileUrl");

  const res = await fetch(fileUrl, { redirect: "follow" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `uploadRemoteFileToBlob: failed to download (${res.status} ${res.statusText}) ${text}`.trim(),
    );
  }

  const contentType =
    opts.contentTypeHint?.trim() ||
    res.headers.get("content-type") ||
    "application/octet-stream";

  const arrayBuffer = await res.arrayBuffer();
  const body = Buffer.from(arrayBuffer);

  const blob = await put(opts.pathname, body, {
    access: "private",
    contentType,
    addRandomSuffix: false,
  });

  return blob.url;
}

function getLatestDocumentUrl(payload: any): string | null {
  const entry = payload?.Entry && typeof payload.Entry === "object" ? payload.Entry : null;
  if (!entry) return null;

  const matches: Array<{ index: number; url: string }> = [];

  for (const [key, value] of Object.entries(entry)) {
    const m = /^Document(\d+)$/i.exec(key);
    if (!m) continue;
    if (typeof value !== "string") continue;

    const url = value.trim();
    if (!/^https?:\/\//i.test(url)) continue;

    matches.push({ index: Number(m[1]), url });
  }

  if (!matches.length) return null;
  matches.sort((a, b) => b.index - a.index);
  return matches[0].url;
}

/**
 * Downloads a company logo from its temporary Cognito-hosted URL and re-uploads
 * it to Vercel Blob for permanent storage.
 *
 * This is necessary because Cognito file URLs expire — by moving the file to
 * Vercel Blob we get a stable public URL that we can embed in the PDF at any time.
 *
 * Requires BLOB_READ_WRITE_TOKEN in the environment.
 */
async function uploadLogoToBlob(opts: {
  fileUrl: string;
  filename: string; // e.g. "ipex_soft_logo-3.png"
  contentType?: string; // e.g. "image/png"
  userEmail: string; // used to namespace the blob path
  companyName: string;
}): Promise<string> {
  const fileUrl = String(opts.fileUrl || "").trim();
  if (!fileUrl) throw new Error("uploadLogoToBlob: missing fileUrl");

  const filename = String(opts.filename || "logo").trim();
  const contentType =
    (opts.contentType && String(opts.contentType).trim()) ||
    "application/octet-stream";

  // Build a deterministic blob path: user-uploads/<email>/<company>-logo
  const nsEmail = safeKeyPart(opts.userEmail) || "unknown-email";
  const baseName = safeKeyPart(opts.companyName) || safeKeyPart(filename) || "company";
  const pathname = `user-uploads/${nsEmail}/${baseName}-logo`;

  // Return the permanent public URL for storage in the database.
  return uploadRemoteFileToBlob({
    fileUrl,
    pathname,
    contentTypeHint: contentType,
  });
}

function getString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function normaliseEmail(v: string) {
  return v.toLowerCase().trim();
}

function parseName(nameValue: unknown): { firstName: string | null; lastName: string | null } {
  if (nameValue && typeof nameValue === "object") {
    const maybeObj = nameValue as { First?: unknown; Last?: unknown };
    const firstName = getString(maybeObj.First);
    const lastName = getString(maybeObj.Last);
    if (firstName || lastName) return { firstName, lastName };
  }

  const value = getString(nameValue);
  if (!value) return { firstName: null, lastName: null };

  const parts = value.split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

// Main entry point called by the webhook route.
// Parses the incoming Cognito payload, optionally uploads the company logo,
// then upserts the submission into the database (insert on first submit, update on re-submit).
export async function cognitoSubmissionHandler(payload: any) {
  const data = extractFromCognito(payload);
  const userEmail = normaliseEmail(data.userEmail);
  const companyName = getString(payload?.CompanyName);
  const parsedName = parseName(payload?.Name);
  const phone = getString(payload?.PhoneNumber);
  const companyWebsite = getString(payload?.CompanyWebsite);
  const position = getString(payload?.JobTitle);

  // Upsert: if a row already exists for this (formId, userEmail) pair, update it;
  // otherwise create a new row. This handles clients who re-submit a form.
  // Submissions are keyed by (formId, userEmail), so re-submits update the same row.
  await prisma.cognitoSubmission.upsert({
    where: {
      formId_userEmail: { formId: data.formId, userEmail: data.userEmail },
    },
    create: {
      formId: data.formId,
      formTitle: data.formTitle,
      userEmail,
      entryCreatedAt: data.entryCreatedAt,
      entryUpdatedAt: data.entryUpdatedAt,
      payload,
    },
    update: {
      formTitle: data.formTitle,
      entryCreatedAt: data.entryCreatedAt,
      entryUpdatedAt: data.entryUpdatedAt,
      payload,
    },
  });

  await prisma.user.upsert({
    where: { email: userEmail },
    create: {
      email: userEmail,
      firstName: parsedName.firstName,
      lastName: parsedName.lastName,
      companyName,
      phone,
      companyWebsite,
      position,
    },
    update: {
      ...(parsedName.firstName ? { firstName: parsedName.firstName } : {}),
      ...(parsedName.lastName ? { lastName: parsedName.lastName } : {}),
      ...(companyName ? { companyName } : {}),
      ...(phone ? { phone } : {}),
      ...(companyWebsite ? { companyWebsite } : {}),
      ...(position ? { position } : {}),
    },
  });

  const latestDocumentUrl = getLatestDocumentUrl(payload);
  if (latestDocumentUrl) {
    try {
      const nsEmail = safeKeyPart(userEmail) || "unknown-email";
      const nsFormId = safeKeyPart(data.formId) || "unknown-form";
      const fileTitle =
        safeKeyPart(data.formTitle || `form-${data.formId}`) ||
        `form-${data.formId}`;
      const pathname = `user-uploads/${nsEmail}/${nsFormId}/${fileTitle}.pdf`;

      const outputPdfUrl = await uploadRemoteFileToBlob({
        fileUrl: latestDocumentUrl,
        pathname,
        contentTypeHint: "application/pdf",
      });

      await prisma.cognitoSubmission.update({
        where: {
          formId_userEmail: { formId: data.formId, userEmail },
        },
        data: { outputPdfUrl },
      });
    } catch (error) {
      console.warn("Document upload failed; submission row kept.", {
        formId: data.formId,
        userEmail,
        error,
      });
    }
  }

  // Only form 29 (Final Step) includes the company logo upload field.
  // For all other forms we skip the logo handling entirely.
  if (data.formId === "29") {
    const logo = getCompanyLogo(payload);

    if (logo?.fileUrl?.startsWith("http")) {
      try {
        const companyLogoUrl = await uploadLogoToBlob({
          userEmail,
          companyName: companyName ?? "company",
          fileUrl: logo.fileUrl,
          filename: logo.filename,
          contentType: logo.contentType,
        });

        await prisma.user.update({
          where: { email: userEmail },
          data: { companyLogoUrl },
        });
      } catch (error) {
        console.warn("Company logo upload failed; user row kept.", {
          formId: data.formId,
          userEmail,
          error,
        });
      }
    }
  }
}
