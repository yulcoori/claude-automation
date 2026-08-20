import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();
  if (!newPassword || String(newPassword).length < 4) {
    return NextResponse.json({ error: "새 비밀번호는 4자 이상이어야 합니다." }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
  if (!dbUser.phone) {
    return NextResponse.json(
      { error: "전화번호가 등록된 계정만 비밀번호를 사용할 수 있습니다." },
      { status: 400 }
    );
  }

  if (dbUser.passwordHash) {
    const ok = await bcrypt.compare(String(currentPassword ?? ""), dbUser.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "현재 비밀번호가 올바르지 않습니다." }, { status: 400 });
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(String(newPassword), 10) },
  });
  return NextResponse.json({ ok: true });
}
