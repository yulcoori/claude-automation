import { NextResponse } from "next/server";
import { canViewMember, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.status === "PENDING") {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { postId, chartId, body } = await req.json();
  if (!body || !String(body).trim()) {
    return NextResponse.json({ error: "댓글 내용을 입력하세요." }, { status: 400 });
  }
  if (!postId && !chartId) {
    return NextResponse.json({ error: "대상이 없습니다." }, { status: 400 });
  }

  // 해당 회원 페이지를 볼 수 있는 사람만 댓글 작성 가능
  let member;
  if (postId) {
    const post = await prisma.post.findUnique({ where: { id: postId }, include: { member: true } });
    if (!post) return NextResponse.json({ error: "게시물을 찾을 수 없습니다." }, { status: 404 });
    member = post.member;
  } else {
    const chart = await prisma.chart.findUnique({
      where: { id: chartId },
      include: { member: true },
    });
    if (!chart) return NextResponse.json({ error: "차트를 찾을 수 없습니다." }, { status: 404 });
    member = chart.member;
  }
  if (!canViewMember(user, member)) {
    return NextResponse.json({ error: "댓글 권한이 없습니다." }, { status: 403 });
  }

  const comment = await prisma.comment.create({
    data: {
      postId: postId ?? null,
      chartId: chartId ?? null,
      authorId: user.id,
      body: String(body).trim(),
    },
  });
  return NextResponse.json({ id: comment.id });
}
