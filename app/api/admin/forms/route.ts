// GET  /api/admin/forms      — list all CognitoForm records (admin only)
// PATCH /api/admin/forms     — update mutable fields on a single form (admin only)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/auth";
import { z } from "zod";

const patchSchema = z.object({
  id: z.string().min(1),
  formId: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  formUrl: z.string().url().optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const forms = await prisma.cognitoForm.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(forms);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", issues: parsed.error.issues }, { status: 400 });
  }

  const { id, ...fields } = parsed.data;
  const data: { formId?: string; title?: string; formUrl?: string } = {};
  if (fields.formId !== undefined) data.formId = fields.formId.trim();
  if (fields.title !== undefined) data.title = fields.title.trim();
  if (fields.formUrl !== undefined) data.formUrl = fields.formUrl.trim();

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.cognitoForm.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}
