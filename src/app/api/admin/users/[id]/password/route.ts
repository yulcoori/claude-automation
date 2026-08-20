import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 관리자가 회원/강사 비밀번호를 재설정 (본인 관리자 계정은 /settings 에서 변경)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { password } = await req.json();
  if (!password || String(password).length < 4) {
    return NextResponse.json({ error: "비밀번호는 4자 이상이어야 합니다." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
  if (target.role === "ADMIN" && target.id !== admin.id) {
    return NextResponse.json(
      { error: "다른 관리자의 비밀번호는 재설정할 수 없습니다." },
      { status: 403 }
    );
  }

  await prisma.user.update({
    where: { id: params.id },
    data: { passwordHash: await bcrypt.hash(String(password), 10) },
  });
  return NextResponse.json({ ok: true });
}
