import { NextResponse } from "next/server";
import { canManageMember, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.status === "PENDING") {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { memberId, memo } = await req.json();
  const member = await prisma.memberProfile.findUnique({ where: { id: memberId } });
  if (!member) return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  if (!canManageMember(user, member)) {
    return NextResponse.json({ error: "담당 강사 또는 관리자만 기록할 수 있습니다." }, { status: 403 });
  }

  const log = await prisma.sessionLog.create({
    data: { memberId, instructorId: user.id, memo: memo ? String(memo).trim() : null },
  });
  return NextResponse.json({ id: log.id });
}
