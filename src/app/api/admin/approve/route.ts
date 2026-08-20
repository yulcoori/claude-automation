import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { userId, action, role, instructorId, targetUserId } = await req.json();
  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { memberProfile: true },
  });
  if (!target) {
    return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
  }

  if (action === "delete") {
    if (target.role === "ADMIN") {
      return NextResponse.json({ error: "관리자 계정은 삭제할 수 없습니다." }, { status: 400 });
    }
    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json({ ok: true });
  }

  if (action === "link") {
    // 카카오 신규 계정을 기존(전화번호 등록) 계정과 연결
    if (!targetUserId || !target.kakaoId) {
      return NextResponse.json({ error: "연결 대상이 올바르지 않습니다." }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!existing) {
      return NextResponse.json({ error: "기존 계정을 찾을 수 없습니다." }, { status: 404 });
    }
    if (existing.kakaoId) {
      return NextResponse.json(
        { error: "이미 카카오가 연결된 계정입니다." },
        { status: 409 }
      );
    }
    const kakaoId = target.kakaoId;
    await prisma.$transaction([
      prisma.user.delete({ where: { id: userId } }),
      prisma.user.update({ where: { id: targetUserId }, data: { kakaoId } }),
    ]);
    return NextResponse.json({ ok: true });
  }

  if (action === "activate") {
    if (role !== "MEMBER" && role !== "INSTRUCTOR") {
      return NextResponse.json({ error: "잘못된 역할입니다." }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: userId },
      data: {
        role,
        status: "ACTIVE",
        ...(role === "MEMBER" && !target.memberProfile
          ? {
              memberProfile: {
                create: { instructorId: instructorId || null, startedAt: new Date() },
              },
            }
          : {}),
      },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "알 수 없는 요청입니다." }, { status: 400 });
}
