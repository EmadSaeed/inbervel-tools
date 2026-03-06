import { put } from "@vercel/blob";

function safeKeyPart(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "");
}

export async function uploadCompanyLogoToBlob(params: {
  userEmail: string;
  formId: string;
  fileUrl: string;
  filenameHint?: string;
}): Promise<string> {
  const { userEmail, formId, fileUrl, filenameHint } = params;

  const res = await fetch(fileUrl, { redirect: "follow" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Failed to fetch Cognito file: ${res.status} ${res.statusText} ${text}`.trim(),
    );
  }

  const contentType =
    res.headers.get("content-type") ?? "application/octet-stream";

  // ✅ Use Buffer for @vercel/blob
  const arrayBuffer = await res.arrayBuffer();
  const body = Buffer.from(arrayBuffer);

  const safeEmail = safeKeyPart(userEmail);
  const name = safeKeyPart(filenameHint?.trim() || "company-logo");

  // Stable path you control (if you want re-submits to overwrite)
  const blobPath = `logos/${safeEmail}/form-${safeKeyPart(formId)}/${name}`;

  const uploaded = await put(blobPath, body, {
    access: "public",
    contentType,
    addRandomSuffix: false,
  });

  return uploaded.url;
}
