import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({ id: z.string().min(1) });

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing or invalid id" }, { status: 400 });
  }
  const { id } = parsed.data;

  const action = await prisma.ninetyDayAction.findFirst({
    where: { id, userEmail: session.user.email },
    select: { id: true },
  });

  if (!action) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.ninetyDayAction.update({
    where: { id },
    data: { status: "PENDING", completedAt: null },
  });

  return NextResponse.json({ ok: true });
}
