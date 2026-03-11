// GET  /api/admin/forms      — list all CognitoForm records (admin only)
// PATCH /api/admin/forms     — update mutable fields on a single form (admin only)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/auth";

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

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const data: { formId?: string; title?: string; formUrl?: string } = {};

  if (typeof body.formId === "string") data.formId = body.formId.trim();
  if (typeof body.title === "string") data.title = body.title.trim();
  if (typeof body.formUrl === "string") data.formUrl = body.formUrl.trim();

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.cognitoForm.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}
