import { NextResponse } from "next/server";
import { canManageMember, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendCompletionAlimtalk } from "@/lib/alimtalk";

const CHART_MILESTONES = [10, 20, 30];

// 회차 도달 시 알림: 10/20/30회차 → 강사·관리자에게 차트 작성 안내,
// 전체 회차 완료 → 회원 축하 알림 + 카카오 알림톡 발송
async function handleMilestones(memberId: string) {
  const member = await prisma.memberProfile.findUnique({
    where: { id: memberId },
    include: { user: true, _count: { select: { sessionLogs: true } } },
  });
  if (!member) return;
  const current = member.baseSessions + member._count.sessionLogs;
  const isComplete = current === member.totalSessions;
  const isChartMilestone = CHART_MILESTONES.includes(current);
  if (!isComplete && !isChartMilestone) return;

  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  const staffIds = Array.from(
    new Set([member.instructorId, ...admins.map((a) => a.id)].filter((id): id is string => !!id))
  );

  if (isChartMilestone) {
    await prisma.notification.createMany({
      data: staffIds.map((userId) => ({
        userId,
        type: "CHART",
        message: `📋 ${member.user.name} 회원님이 ${current}회차에 도달했습니다. 체형 분석 차트를 작성해 주세요.`,
        link: `/members/${member.id}`,
      })),
    });
  }

  if (isComplete) {
    await prisma.notification.createMany({
      data: [
        {
          userId: member.userId,
          type: "COMPLETE",
          message: `🎉 축하합니다! ${member.totalSessions}회차를 모두 완료하셨습니다.`,
          link: `/members/${member.id}`,
        },
        ...staffIds.map((userId) => ({
          userId,
          type: "COMPLETE",
          message: `🎉 ${member.user.name} 회원님이 전체 ${member.totalSessions}회차를 완료했습니다. 차트를 확인·전송해 주세요.`,
          link: `/members/${member.id}`,
        })),
      ],
    });
    // 카카오 알림톡 (환경변수 설정 시에만 실제 발송)
    await sendCompletionAlimtalk(member.user.phone, member.user.name, current);
  }
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.status === "PENDING") {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { memberId, memo } = await req.json();
  const member = await prisma.memberProfile.findUnique({ where: { id: memberId } });
  if (!member) return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });
  if (!canManageMember(user, member)) {
    return NextResponse.json({ error: "담당 강사 또는 관리자만 기록할 수 있습니다." }, { status: 403 });
  }

  const log = await prisma.sessionLog.create({
    data: { memberId, instructorId: user.id, memo: memo ? String(memo).trim() : null },
  });
  await handleMilestones(memberId);
  return NextResponse.json({ id: log.id });
}
