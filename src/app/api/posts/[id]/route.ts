import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { canManageMember, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadRoot } from "@/lib/uploads";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: { media: true, member: true },
  });
  if (!post) return NextResponse.json({ error: "게시물을 찾을 수 없습니다." }, { status: 404 });

  const allowed = post.authorId === user.id || canManageMember(user, post.member);
  if (!allowed) return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });

  await prisma.post.delete({ where: { id: params.id } });
  await Promise.allSettled(
    post.media.map((m) => unlink(path.join(uploadRoot(), m.filePath)))
  );
  return NextResponse.json({ ok: true });
}
