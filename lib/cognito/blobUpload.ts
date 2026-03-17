import { put } from "@vercel/blob";
import { safeKeyPart } from "./utils";

export async function uploadRemoteFileToBlob(opts: {
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
    allowOverwrite: true,
    addRandomSuffix: false,
  });

  return blob.url;
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
export async function uploadLogoToBlob(opts: {
  fileUrl: string;
  filename: string;
  contentType?: string;
  userEmail: string;
  companyName: string;
}): Promise<string> {
  const fileUrl = String(opts.fileUrl || "").trim();
  if (!fileUrl) throw new Error("uploadLogoToBlob: missing fileUrl");

  const filename = String(opts.filename || "logo").trim();
  const contentType =
    (opts.contentType && String(opts.contentType).trim()) ||
    "application/octet-stream";

  const nsEmail = safeKeyPart(opts.userEmail) || "unknown-email";
  const baseName = safeKeyPart(opts.companyName) || safeKeyPart(filename) || "company";
  const pathname = `user-uploads/${nsEmail}/${baseName}-logo`;

  return uploadRemoteFileToBlob({ fileUrl, pathname, contentTypeHint: contentType });
}
