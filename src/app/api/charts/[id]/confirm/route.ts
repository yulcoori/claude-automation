import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 회원 본인이 차트를 확인했다고 체크하고 피드백을 남깁니다.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user || user.status === "PENDING") {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const chart = await prisma.chart.findUnique({
    where: { id: params.id },
    include: { member: { include: { user: true } } },
  });
  if (!chart) return NextResponse.json({ error: "차트를 찾을 수 없습니다." }, { status: 404 });

  // 회원 본인만 확인 체크 가능
  if (chart.member.userId !== user.id) {
    return NextResponse.json(
      { error: "회원 본인만 확인할 수 있습니다." },
      { status: 403 }
    );
  }

  const { confirmed, feedback } = await req.json();
  const updated = await prisma.chart.update({
    where: { id: params.id },
    data: {
      confirmedAt: confirmed ? new Date() : null,
      memberFeedback: typeof feedback === "string" ? feedback.trim() || null : chart.memberFeedback,
    },
  });

  // 확인 시 담당 강사·관리자에게 알림
  if (confirmed && !chart.confirmedAt) {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    const staffIds = Array.from(
      new Set(
        [chart.member.instructorId, ...admins.map((a) => a.id)].filter(
          (id): id is string => !!id && id !== user.id
        )
      )
    );
    if (staffIds.length > 0) {
      await prisma.notification.createMany({
        data: staffIds.map((userId) => ({
          userId,
          type: "CHART",
          message: `✅ ${chart.member.user.name} 회원님이 ${chart.milestone}회차 차트를 확인했습니다.`,
          link: `/members/${chart.memberId}/charts/${chart.id}`,
        })),
      });
    }
  }

  return NextResponse.json({ ok: true, confirmedAt: updated.confirmedAt });
}
