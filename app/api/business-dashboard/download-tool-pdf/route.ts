// GET /api/business-dashboard/download-tool-pdf?formId=<formId>
//
// Downloads the action tool PDF for the authenticated member.
// Fetches the private Vercel Blob URL server-to-server and streams the response
// back to the browser so the client never needs direct blob access.

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const formId = req.nextUrl.searchParams.get("formId")?.trim();
  if (!formId) {
    return new Response("Missing formId", { status: 400 });
  }

  const userEmail = session.user.email.toLowerCase().trim();

  const submission = await prisma.cognitoSubmission.findUnique({
    where: { formId_userEmail: { formId, userEmail } },
    select: { outputPdfUrl: true, formTitle: true },
  });

  if (!submission?.outputPdfUrl) {
    return new Response("Not found", { status: 404 });
  }

  // Fetch the private blob server-to-server using the read/write token.
  const blobRes = await fetch(submission.outputPdfUrl, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
  if (!blobRes.ok) {
    return new Response("Failed to fetch PDF", { status: 502 });
  }

  const safeLabel = (submission.formTitle ?? "tool")
    .replace(/[\/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return new Response(blobRes.body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeLabel}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
