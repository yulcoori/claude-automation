import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = await req.json();
  const { role, name, phone, password, program, instructorId, baseSessions, totalSessions, goal } =
    body;

  if (!name || !phone || !password) {
    return NextResponse.json({ error: "이름/전화번호/비밀번호는 필수입니다." }, { status: 400 });
  }
  if (role !== "MEMBER" && role !== "INSTRUCTOR") {
    return NextResponse.json({ error: "잘못된 구분입니다." }, { status: 400 });
  }

  const normalizedPhone = String(phone).replace(/\D/g, "");
  const existing = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
  if (existing) {
    return NextResponse.json({ error: "이미 등록된 전화번호입니다." }, { status: 409 });
  }

  const created = await prisma.user.create({
    data: {
      name: String(name).trim(),
      phone: normalizedPhone,
      passwordHash: await bcrypt.hash(String(password), 10),
      role,
      status: "ACTIVE",
      ...(role === "MEMBER"
        ? {
            memberProfile: {
              create: {
                program: program ? String(program).trim() : null,
                instructorId: instructorId || null,
                baseSessions: Math.max(0, Number(baseSessions) || 0),
                totalSessions: Math.max(1, Number(totalSessions) || 30),
                goal: goal ? String(goal).trim() : null,
                startedAt: new Date(),
              },
            },
          }
        : {}),
    },
  });

  return NextResponse.json({ id: created.id });
}
