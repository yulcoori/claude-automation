import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { kindOf, saveUpload } from "@/lib/uploads";
import { notifyNewNotice } from "@/lib/notifications";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 공지를 작성할 수 있습니다." }, { status: 403 });
  }

  const fd = await req.formData();
  const title = String(fd.get("title") ?? "").trim();
  const body = String(fd.get("body") ?? "").trim();
  const pinned = fd.get("pinned") === "true";

  if (!title) return NextResponse.json({ error: "제목을 입력하세요." }, { status: 400 });

  try {
    const files = fd.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > 10) {
      return NextResponse.json({ error: "사진은 최대 10장까지 첨부할 수 있습니다." }, { status: 400 });
    }
    const images: { filePath: string; mimeType: string }[] = [];
    for (const file of files) {
      if (kindOf(file.type) !== "IMAGE") {
        return NextResponse.json({ error: "공지에는 사진만 첨부할 수 있습니다." }, { status: 400 });
      }
      images.push({ filePath: await saveUpload(file, "notices"), mimeType: file.type });
    }

    const notice = await prisma.notice.create({
      data: { authorId: user.id, title, body, pinned, images: { create: images } },
    });
    await notifyNewNotice(user.id, title);
    return NextResponse.json({ id: notice.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "저장에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
