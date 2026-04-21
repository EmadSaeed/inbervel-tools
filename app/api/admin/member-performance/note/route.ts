// POST /api/admin/member-performance/note
//
// Upserts a single MemberPerformanceNote per member (keyed on userEmail).
// Admin only. `updatedBy` is set to the acting admin's email.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/auth";
import { z } from "zod";

const bodySchema = z.object({
  userEmail: z.string().email(),
  content: z.string().max(20000),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const userEmail = parsed.data.userEmail.toLowerCase().trim();
  const content = parsed.data.content;
  const updatedBy = session.user.email ?? "unknown";

  const saved = await prisma.memberPerformanceNote.upsert({
    where: { userEmail },
    create: { userEmail, content, updatedBy },
    update: { content, updatedBy },
    select: { content: true, updatedAt: true, updatedBy: true },
  });

  return NextResponse.json({
    content: saved.content,
    updatedAt: saved.updatedAt.toISOString(),
    updatedBy: saved.updatedBy,
  });
}
