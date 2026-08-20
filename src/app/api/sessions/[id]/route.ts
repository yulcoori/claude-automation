import { NextResponse } from "next/server";
import { canManageMember, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const log = await prisma.sessionLog.findUnique({
    where: { id: params.id },
    include: { member: true },
  });
  if (!log) return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
  if (!canManageMember(user, log.member)) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  await prisma.sessionLog.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
