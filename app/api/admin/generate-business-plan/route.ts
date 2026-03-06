// POST /api/admin/generate-business-plan
//
// Orchestrates the full PDF generation pipeline for a given client email:
//   1. Fetch and assemble all form submissions into a template DTO
//   2. Render the Handlebars template into an HTML string
//   3. Print the HTML to a PDF buffer using headless Chromium
//   4. Stream the PDF back to the browser as a file download

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { buildBusinessPlanTemplateDto } from "@/lib/buildBusinessPlanTemplateDto";
import { renderBusinessPlanTemplate } from "@/lib/pdf/renderTemplate";
import { htmlToPdfBuffer } from "@/lib/pdf/generatePdf";
import { authOptions } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Strips characters that are illegal in filenames on Windows and macOS so the
// downloaded file has a safe name regardless of what the company typed.
function safeFilenamePart(value: string) {
  return value
    .replace(/[\/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return new Response("Forbidden", { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? "")
      .toLowerCase()
      .trim();

    if (!email) {
      return new Response("Missing email", { status: 400 });
    }

    // Step 1: fetch all form submission payloads for this client and shape them
    // into the DTO expected by the Handlebars template.
    const dto = await buildBusinessPlanTemplateDto(email);

    // Step 2: compile the Handlebars template with the DTO, inlining CSS and images.
    const html = await renderBusinessPlanTemplate(dto);

    // Step 3: launch headless Chromium and print the HTML to a PDF buffer.
    // The company name appears as the subtitle in the running page header.
    const pdfBuffer = await htmlToPdfBuffer(html, {
      title: "Business Plan",
      subtitle: dto?.final?.CompanyName ?? "Company",
    });

    // Build a safe filename: "<CompanyName> Business Plan.pdf"
    const companyName = safeFilenamePart(
      String(dto?.final?.CompanyName ?? "Company"),
    );
    const filename = `${companyName} Business Plan.pdf`;

    // Step 4: return the PDF as a binary download response.
    // Cache-Control: no-store prevents the PDF from being cached by the browser
    // or any intermediate proxy — each generation should always be fresh.
    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("generate-business-plan error:", err);
    return new Response(`Error: ${message}`, { status: 500 });
  }
}
