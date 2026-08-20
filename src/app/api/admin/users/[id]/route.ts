import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadRoot } from "@/lib/uploads";
import { collectMovementMediaPaths } from "@/lib/chartMedia";

// 회원/강사 정보 수정 (관리자 전용)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    include: { memberProfile: true },
  });
  if (!target) return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
  if (target.role === "ADMIN" && target.id !== admin.id) {
    return NextResponse.json({ error: "다른 관리자 계정은 수정할 수 없습니다." }, { status: 403 });
  }

  const body = await req.json();
  const userData: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) {
    userData.name = body.name.trim();
  }
  if (typeof body.phone === "string") {
    const phone = body.phone.replace(/\D/g, "");
    if (phone.length < 10) {
      return NextResponse.json({ error: "전화번호를 정확히 입력해 주세요." }, { status: 400 });
    }
    if (phone !== target.phone) {
      const dup = await prisma.user.findUnique({ where: { phone } });
      if (dup) {
        return NextResponse.json({ error: "이미 사용 중인 전화번호입니다." }, { status: 409 });
      }
      userData.phone = phone;
    }
  }
  if (typeof body.password === "string" && body.password) {
    if (body.password.length < 4) {
      return NextResponse.json({ error: "비밀번호는 4자 이상이어야 합니다." }, { status: 400 });
    }
    userData.passwordHash = await bcrypt.hash(body.password, 10);
  }
  if (body.role === "MEMBER" || body.role === "INSTRUCTOR") {
    userData.role = body.role;
  }

  // 회원 프로필 정보
  const profileData: Record<string, unknown> = {};
  if ("instructorId" in body) profileData.instructorId = body.instructorId || null;
  if ("program" in body) profileData.program = body.program ? String(body.program).trim() : null;
  if ("goal" in body) profileData.goal = body.goal ? String(body.goal).trim() : null;
  if ("memo" in body) profileData.memo = body.memo ? String(body.memo).trim() : null;
  if ("totalSessions" in body) {
    profileData.totalSessions = Math.max(1, Number(body.totalSessions) || 30);
  }
  if ("baseSessions" in body) {
    profileData.baseSessions = Math.max(0, Number(body.baseSessions) || 0);
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(userData).length > 0) {
      await tx.user.update({ where: { id: params.id }, data: userData });
    }
    const finalRole = (userData.role as string) ?? target.role;
    if (finalRole === "MEMBER") {
      if (target.memberProfile) {
        if (Object.keys(profileData).length > 0) {
          await tx.memberProfile.update({ where: { userId: params.id }, data: profileData });
        }
      } else {
        await tx.memberProfile.create({
          data: { userId: params.id, startedAt: new Date(), ...profileData },
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}

// 회원/강사 삭제 (관리자 전용) — 관련 기록과 업로드 파일도 함께 정리
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (params.id === admin.id) {
    return NextResponse.json({ error: "본인 계정은 삭제할 수 없습니다." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      memberProfile: {
        include: { posts: { include: { media: true } }, charts: true },
      },
      instructedMembers: { select: { id: true } },
    },
  });
  if (!target) return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
  if (target.role === "ADMIN") {
    return NextResponse.json({ error: "관리자 계정은 삭제할 수 없습니다." }, { status: 403 });
  }

  // 삭제할 업로드 파일 목록 (회원인 경우)
  const filePaths: string[] = [];
  if (target.memberProfile) {
    for (const post of target.memberProfile.posts) {
      for (const m of post.media) filePaths.push(m.filePath);
    }
    for (const chart of target.memberProfile.charts) {
      if (chart.pdfPath) filePaths.push(chart.pdfPath);
      filePaths.push(...Array.from(collectMovementMediaPaths(chart.content)));
    }
  }

  await prisma.$transaction(async (tx) => {
    // 강사인 경우: 담당 회원을 미배정으로 돌리고, 작성한 차트는 관리자 명의로 이관
    if (target.instructedMembers.length > 0) {
      await tx.memberProfile.updateMany({
        where: { instructorId: params.id },
        data: { instructorId: null },
      });
    }
    await tx.chart.updateMany({ where: { instructorId: params.id }, data: { instructorId: admin.id } });
    await tx.post.updateMany({ where: { authorId: params.id }, data: { authorId: admin.id } });
    await tx.comment.deleteMany({ where: { authorId: params.id } });
    await tx.sessionLog.updateMany({
      where: { instructorId: params.id },
      data: { instructorId: null },
    });
    await tx.user.delete({ where: { id: params.id } });
  });

  await Promise.allSettled(filePaths.map((p) => unlink(path.join(uploadRoot(), p))));
  return NextResponse.json({ ok: true });
}
