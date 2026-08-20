import { NextResponse } from "next/server";
import { canManageMember, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { kindOf, saveUpload } from "@/lib/uploads";

export const maxDuration = 300;

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.status === "PENDING") {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const fd = await req.formData();
  const memberId = String(fd.get("memberId") ?? "");
  const type = String(fd.get("type") ?? "");
  const sessionNumberRaw = fd.get("sessionNumber");
  const caption = fd.get("caption") ? String(fd.get("caption")) : null;

  const member = await prisma.memberProfile.findUnique({ where: { id: memberId } });
  if (!member) return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  if (!canManageMember(user, member)) {
    return NextResponse.json({ error: "담당 강사 또는 관리자만 업로드할 수 있습니다." }, { status: 403 });
  }
  if (type !== "BEFORE_AFTER" && type !== "MEDIA") {
    return NextResponse.json({ error: "잘못된 게시물 유형입니다." }, { status: 400 });
  }

  try {
    const mediaData: { kind: string; slot: string; filePath: string; mimeType: string }[] = [];

    if (type === "BEFORE_AFTER") {
      const before = fd.get("before");
      const after = fd.get("after");
      if (!(before instanceof File) || !(after instanceof File)) {
        return NextResponse.json({ error: "비포/애프터 파일이 필요합니다." }, { status: 400 });
      }
      for (const [file, slot] of [
        [before, "BEFORE"],
        [after, "AFTER"],
      ] as const) {
        const kind = kindOf(file.type);
        if (!kind || kind === "PDF") {
          return NextResponse.json({ error: "사진 또는 영상만 업로드할 수 있습니다." }, { status: 400 });
        }
        const filePath = await saveUpload(file, memberId);
        mediaData.push({ kind, slot, filePath, mimeType: file.type });
      }
    } else {
      const files = fd.getAll("files").filter((f): f is File => f instanceof File);
      if (files.length === 0) {
        return NextResponse.json({ error: "업로드할 파일이 없습니다." }, { status: 400 });
      }
      if (files.length > 10) {
        return NextResponse.json({ error: "한 번에 최대 10개까지 업로드할 수 있습니다." }, { status: 400 });
      }
      for (const file of files) {
        const kind = kindOf(file.type);
        if (!kind || kind === "PDF") {
          return NextResponse.json({ error: "사진 또는 영상만 업로드할 수 있습니다." }, { status: 400 });
        }
        const filePath = await saveUpload(file, memberId);
        mediaData.push({ kind, slot: "NORMAL", filePath, mimeType: file.type });
      }
    }

    const post = await prisma.post.create({
      data: {
        memberId,
        authorId: user.id,
        type,
        sessionNumber: sessionNumberRaw ? Number(sessionNumberRaw) || null : null,
        caption,
        media: { create: mediaData },
      },
    });

    return NextResponse.json({ id: post.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "업로드에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
