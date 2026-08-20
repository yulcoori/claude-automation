import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if ("instructorId" in body) data.instructorId = body.instructorId || null;
  if ("program" in body) data.program = body.program ? String(body.program).trim() : null;
  if ("goal" in body) data.goal = body.goal ? String(body.goal).trim() : null;
  if ("totalSessions" in body) data.totalSessions = Math.max(1, Number(body.totalSessions) || 30);
  if ("baseSessions" in body) data.baseSessions = Math.max(0, Number(body.baseSessions) || 0);

  await prisma.memberProfile.update({ where: { id: params.id }, data });
  return NextResponse.json({ ok: true });
}
