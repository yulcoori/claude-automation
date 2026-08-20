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

  // 이전 회차 차트 내용을 그대로 이어받아 시작 (10회차 → 20회차 → 30회차)
  // 1회 기록·이전 회차 계획은 잠기고, 이번 회차 칸에만 추가로 적습니다.
  const prev = member.charts.filter((c) => c.milestone < milestone).pop();
  const initial = prev ? parseChartContent(prev.content) : emptyChartContent();
  const carriedOver = Boolean(prev);
  if (prev) {
    // 이번 회차에 새로 적을 칸은 비워둠 (1회 기록·이전 계획은 유지)
    initial.month = "";
    initial.improvements = "";
    initial.posture = "";
    initial.movement = initial.movement.map((r) => ({
      ...r,
      now: "",
      nowMedia: [],
    }));
    initial.pain = initial.pain.map((r) => ({ ...r, vasNow: "" }));
  }
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
          {prev &&
            ` · ${prev.milestone}회차 차트를 그대로 이어받았습니다. 회색 칸은 이전 기록이라 고정되고, 이번 회차 칸만 새로 적으시면 됩니다.`}
        </p>
        <ChartForm
          memberId={member.id}
          milestone={milestone}
          memberName={member.user.name}
          instructorName={user.name}
          initial={initial}
          carriedOver={carriedOver}
        />
      </main>
    </>
  );
}
