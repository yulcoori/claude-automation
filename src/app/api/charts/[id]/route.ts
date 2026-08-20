import { NextResponse } from "next/server";
import { canManageMember, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveUpload } from "@/lib/uploads";

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

    await prisma.chart.update({ where: { id: chart.id }, data: { content, pdfPath } });
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
  return NextResponse.json({ ok: true });
}
