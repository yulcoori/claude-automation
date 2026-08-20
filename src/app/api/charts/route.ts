import { NextResponse } from "next/server";
import { canManageMember, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveUpload } from "@/lib/uploads";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.status === "PENDING") {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const fd = await req.formData();
  const memberId = String(fd.get("memberId") ?? "");
  const milestone = Number(fd.get("milestone"));
  const content = String(fd.get("content") ?? "{}");

  const member = await prisma.memberProfile.findUnique({ where: { id: memberId } });
  if (!member) return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  if (!canManageMember(user, member)) {
    return NextResponse.json({ error: "담당 강사 또는 관리자만 작성할 수 있습니다." }, { status: 403 });
  }
  if (!milestone || milestone < 1) {
    return NextResponse.json({ error: "회차가 올바르지 않습니다." }, { status: 400 });
  }

  const existing = await prisma.chart.findFirst({ where: { memberId, milestone } });
  if (existing) {
    return NextResponse.json({ error: `${milestone}회차 차트가 이미 있습니다.` }, { status: 409 });
  }

  try {
    JSON.parse(content);
  } catch {
    return NextResponse.json({ error: "차트 내용이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    let pdfPath: string | null = null;
    const pdf = fd.get("pdf");
    if (pdf instanceof File && pdf.size > 0) {
      pdfPath = await saveUpload(pdf, memberId);
    }

    const chart = await prisma.chart.create({
      data: { memberId, instructorId: user.id, milestone, content, pdfPath },
    });
    return NextResponse.json({ id: chart.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "저장에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
