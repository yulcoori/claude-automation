import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  await prisma.notification.updateMany({
    where: { id: params.id, userId: user.id },
    data: { read: true },
  });
  return NextResponse.json({ ok: true });
}
