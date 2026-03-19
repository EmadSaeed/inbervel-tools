// POST /api/business-dashboard/generate-business-plan
//
// Generates a business plan PDF for the currently authenticated member.
// The member can only generate their own plan (email comes from the session).

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { buildBusinessPlanTemplateDto } from "@/lib/buildBusinessPlanTemplateDto";
import { renderBusinessPlanTemplate } from "@/lib/pdf/renderTemplate";
import { htmlToPdfBuffer } from "@/lib/pdf/generatePdf";
import { authOptions } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFilenamePart(value: string) {
  return value
    .replace(/[\/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return new Response("Unauthorized", { status: 401 });
    }

    const email = session.user.email.toLowerCase().trim();

    const dto = await buildBusinessPlanTemplateDto(email);
    const html = await renderBusinessPlanTemplate(dto);
    const pdfBuffer = await htmlToPdfBuffer(html, {
      title: "Business Plan",
      subtitle: dto?.final?.CompanyName ?? "Company",
    });

    const companyName = safeFilenamePart(
      String(dto?.final?.CompanyName ?? "Company"),
    );
    const filename = `${companyName} Business Plan.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    console.error("member generate-business-plan error:", err);
    return new Response("An unexpected error occurred.", { status: 500 });
  }
}
