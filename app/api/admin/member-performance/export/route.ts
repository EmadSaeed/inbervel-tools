// POST /api/admin/member-performance/export
//
// Generates a 3-page PDF (cover + Monthly + YTD) of a member's performance
// data for the admin to save or share. Mirrors the business-plan PDF stack:
// Puppeteer + Handlebars + inlined assets. Admin auth required.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { z } from "zod";
import { renderMemberPerformanceTemplate } from "@/lib/pdf/renderMemberPerformance";
import { htmlToPdfBuffer } from "@/lib/pdf/generatePdf";

const bodySchema = z.object({
  userEmail: z.string().email(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { html, filenameBase, displayName, found } =
    await renderMemberPerformanceTemplate(parsed.data.userEmail);

  if (!found) {
    return NextResponse.json(
      { error: "No client found with that email address." },
      { status: 404 },
    );
  }

  const pdf = await htmlToPdfBuffer(html, {
    title: "Member Performance",
    subtitle: displayName,
    footerLeft: "© Inbervel",
  });

  const filename = `${filenameBase} — Member Performance.pdf`;
  // ASCII fallback for the plain filename= parameter (HTTP header values must
  // be Latin-1), plus RFC 5987 filename*= that carries the real Unicode name
  // (em dash) for modern clients.
  const asciiFilename = filename
    .replace(/[^\x20-\x7E]/g, "-")
    .replace(/"/g, "");
  const encodedFilename = encodeURIComponent(filename);

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "no-store",
    },
  });
}
