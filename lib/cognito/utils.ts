export function toDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function safeKeyPart(v: string) {
  return v
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "");
}

export function getString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

export function normaliseEmail(v: string) {
  return v.toLowerCase().trim();
}

export function parseName(nameValue: unknown): { firstName: string | null; lastName: string | null } {
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

export function extractFromCognito(payload: any) {
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

  return { formId, formTitle, userEmail, entryCreatedAt, entryUpdatedAt };
}

export function getCompanyLogo(payload: any) {
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

export function getLatestDocumentUrl(payload: any): string | null {
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
