import { NextRequest } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { businessPlanSchema } from "./schema";
import { renderBusinessPlanTemplate } from "@/lib/pdf/renderTemplate";
import { htmlToPdfBuffer } from "@/lib/pdf/generatePdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mimeFromExt(ext: string) {
  const e = ext.toLowerCase();
  if (e === ".png") return "image/png";
  if (e === ".jpg" || e === ".jpeg") return "image/jpeg";
  if (e === ".webp") return "image/webp";
  if (e === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

async function publicFileToDataUrl(publicPath: string): Promise<string> {
  // publicPath is like "/IPEXSOFT-logo.jpg"
  const cleaned = publicPath.replace(/^\//, ""); // remove leading slash
  const filePath = path.join(process.cwd(), "public", cleaned);

  const buf = await fs.readFile(filePath);
  const ext = path.extname(filePath);
  const mime = mimeFromExt(ext);

  return `data:${mime};base64,${buf.toString("base64")}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const parsed = businessPlanSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify(parsed.error.issues, null, 2), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = parsed.data;
    const html = await renderBusinessPlanTemplate(data);
    const pdfBuffer = await htmlToPdfBuffer(html);

    // Stream response (avoids Vercel/TS BodyInit mismatch)
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(pdfBuffer));
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="business-plan.pdf"',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(`Error: ${message}`, { status: 500 });
  }
}
