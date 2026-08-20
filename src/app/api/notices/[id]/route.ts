import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { kindOf, saveUpload, uploadRoot } from "@/lib/uploads";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 수정할 수 있습니다." }, { status: 403 });
  }

  const notice = await prisma.notice.findUnique({
    where: { id: params.id },
    include: { images: true },
  });
  if (!notice) return NextResponse.json({ error: "공지를 찾을 수 없습니다." }, { status: 404 });

  const fd = await req.formData();
  const title = String(fd.get("title") ?? notice.title).trim();
  const body = String(fd.get("body") ?? notice.body).trim();
  const pinned = fd.get("pinned") === "true";
  if (!title) return NextResponse.json({ error: "제목을 입력하세요." }, { status: 400 });

  try {
    // 삭제할 기존 사진
    let removeIds: string[] = [];
    try {
      removeIds = JSON.parse(String(fd.get("removeImageIds") ?? "[]"));
    } catch {
      removeIds = [];
    }
    const toRemove = notice.images.filter((img) => removeIds.includes(img.id));

    // 새로 첨부할 사진
    const files = fd.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
    const newImages: { filePath: string; mimeType: string }[] = [];
    for (const file of files) {
      if (kindOf(file.type) !== "IMAGE") {
        return NextResponse.json({ error: "공지에는 사진만 첨부할 수 있습니다." }, { status: 400 });
      }
      newImages.push({ filePath: await saveUpload(file, "notices"), mimeType: file.type });
    }

    await prisma.notice.update({
      where: { id: notice.id },
      data: {
        title,
        body,
        pinned,
        images: {
          deleteMany: toRemove.length ? { id: { in: toRemove.map((i) => i.id) } } : undefined,
          create: newImages,
        },
      },
    });
    await Promise.allSettled(toRemove.map((img) => unlink(path.join(uploadRoot(), img.filePath))));
    return NextResponse.json({ id: notice.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "저장에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자만 삭제할 수 있습니다." }, { status: 403 });
  }

  const notice = await prisma.notice.findUnique({
    where: { id: params.id },
    include: { images: true },
  });
  if (!notice) return NextResponse.json({ error: "공지를 찾을 수 없습니다." }, { status: 404 });

  await prisma.notice.delete({ where: { id: params.id } });
  await Promise.allSettled(
    notice.images.map((img) => unlink(path.join(uploadRoot(), img.filePath)))
  );
  return NextResponse.json({ ok: true });
}
