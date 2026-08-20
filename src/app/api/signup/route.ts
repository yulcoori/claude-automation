import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// 셀프 가입: 회원은 즉시 사용 가능, 강사는 관리자 승인 대기
export async function POST(req: Request) {
  const { role, name, phone, password } = await req.json();

  if (role !== "MEMBER" && role !== "INSTRUCTOR") {
    return NextResponse.json({ error: "잘못된 구분입니다." }, { status: 400 });
  }
  const trimmedName = String(name ?? "").trim();
  const normalizedPhone = String(phone ?? "").replace(/\D/g, "");
  if (!trimmedName) {
    return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });
  }
  if (normalizedPhone.length < 10) {
    return NextResponse.json({ error: "전화번호를 정확히 입력해 주세요." }, { status: 400 });
  }
  if (!password || String(password).length < 4) {
    return NextResponse.json({ error: "비밀번호는 4자 이상이어야 합니다." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
  if (existing) {
    return NextResponse.json(
      { error: "이미 가입된 전화번호입니다. 로그인해 주세요." },
      { status: 409 }
    );
  }

  await prisma.user.create({
    data: {
      name: trimmedName,
      phone: normalizedPhone,
      passwordHash: await bcrypt.hash(String(password), 10),
      role,
      // 회원: 바로 사용 가능 / 강사: 원장님 승인 후 사용
      status: role === "MEMBER" ? "ACTIVE" : "PENDING",
      ...(role === "MEMBER"
        ? { memberProfile: { create: { startedAt: new Date() } } }
        : {}),
    },
  });

  // 원장님(관리자)에게 알림
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "SIGNUP",
        message:
          role === "INSTRUCTOR"
            ? `🔔 ${trimmedName}님이 강사로 가입 신청했습니다. 승인해 주세요.`
            : `🙋 ${trimmedName}님이 회원으로 가입했습니다. 담당 강사를 지정해 주세요.`,
        link: "/dashboard",
      })),
    });
  }

  return NextResponse.json({ ok: true });
}
