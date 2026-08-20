import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { canManageMember, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveUpload, uploadRoot } from "@/lib/uploads";
import { applyMovementMedia, collectMovementMediaPaths } from "@/lib/chartMedia";

export const maxDuration = 300;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || user.status === "PENDING") {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const chart = await prisma.chart.findUnique({
    where: { id: params.id },
    include: { member: true },
  });
  if (!chart) return NextResponse.json({ error: "차트를 찾을 수 없습니다." }, { status: 404 });
  if (!canManageMember(user, chart.member)) {
    return NextResponse.json({ error: "수정 권한이 없습니다." }, { status: 403 });
  }

  const fd = await req.formData();
  const content = String(fd.get("content") ?? chart.content);
  try {
    JSON.parse(content);
  } catch {
    return NextResponse.json({ error: "차트 내용이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    let pdfPath = chart.pdfPath;
    const pdf = fd.get("pdf");
    if (pdf instanceof File && pdf.size > 0) {
      pdfPath = await saveUpload(pdf, chart.memberId);
    }

    // 움직임 평가 사진/영상 반영 + 삭제된 첨부 파일 정리
    const oldPaths = collectMovementMediaPaths(chart.content);
    const { content: finalContent, referenced } = await applyMovementMedia(
      fd,
      content,
      chart.memberId
    );

    await prisma.chart.update({
      where: { id: chart.id },
      data: { content: finalContent, pdfPath },
    });

    const removed = Array.from(oldPaths).filter((p) => !referenced.has(p));
    await Promise.allSettled(removed.map((p) => unlink(path.join(uploadRoot(), p))));
    return NextResponse.json({ id: chart.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "저장에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const chart = await prisma.chart.findUnique({
    where: { id: params.id },
    include: { member: true },
  });
  if (!chart) return NextResponse.json({ error: "차트를 찾을 수 없습니다." }, { status: 404 });
  if (!canManageMember(user, chart.member)) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  await prisma.chart.delete({ where: { id: chart.id } });

  // 첨부 파일 정리 (움직임 평가 미디어 + PDF)
  const paths = Array.from(collectMovementMediaPaths(chart.content));
  if (chart.pdfPath) paths.push(chart.pdfPath);
  await Promise.allSettled(paths.map((p) => unlink(path.join(uploadRoot(), p))));
  return NextResponse.json({ ok: true });
}
