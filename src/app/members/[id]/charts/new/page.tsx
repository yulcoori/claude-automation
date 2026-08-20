import { notFound, redirect } from "next/navigation";
import { canManageMember, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NavBar from "@/components/NavBar";
import ChartForm from "@/components/ChartForm";
import { emptyChartContent, parseChartContent } from "@/lib/chartTemplate";

export const dynamic = "force-dynamic";

export default async function NewChartPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { milestone?: string };
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status === "PENDING") redirect("/pending");

  const member = await prisma.memberProfile.findUnique({
    where: { id: params.id },
    include: { user: true, charts: { orderBy: { milestone: "desc" } } },
  });
  if (!member) notFound();
  if (!canManageMember(user, member)) redirect(`/members/${member.id}`);

  const milestone = Number(searchParams.milestone) || 10;
  const existing = member.charts.find((c) => c.milestone === milestone);
  if (existing) redirect(`/members/${member.id}/charts/${existing.id}/edit`);

  // 이전 차트가 있으면 기본 정보/통증/움직임 평가를 이어받아 시작
  // (사진/영상 첨부는 각 회차 차트에 따로 올리므로 이어받지 않음 — 회차별 비교 화면에서 함께 보임)
  const prev = member.charts.find((c) => c.milestone < milestone);
  const initial = prev ? parseChartContent(prev.content) : emptyChartContent();
  initial.movement = initial.movement.map((r) => ({ ...r, startMedia: [], nowMedia: [] }));
  if (!initial.goal && member.goal) initial.goal = member.goal;
  if (!initial.program && member.program) initial.program = member.program;

  return (
    <>
      <NavBar user={user} />
      <main className="mx-auto w-full max-w-[1040px] px-4 py-6">
        <h1 className="text-xl font-bold text-stone-900">
          체형 분석 차트 · <span className="text-brand-600">{milestone}회차</span>
        </h1>
        <p className="mb-5 mt-1 text-sm text-stone-500">
          {member.user.name} 회원님
          {prev && ` · ${prev.milestone}회차 차트 내용을 불러왔습니다. 변경된 부분만 수정하세요.`}
        </p>
        <ChartForm
          memberId={member.id}
          milestone={milestone}
          memberName={member.user.name}
          instructorName={user.name}
          initial={initial}
        />
      </main>
    </>
  );
}
