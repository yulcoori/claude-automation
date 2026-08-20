import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canManageMember, canViewMember, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NavBar from "@/components/NavBar";
import CommentSection from "@/components/CommentSection";
import PaperChart from "@/components/PaperChart";
import { parseChartContent } from "@/lib/chartTemplate";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ChartViewPage({
  params,
}: {
  params: { id: string; chartId: string };
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status === "PENDING") redirect("/pending");

  const chart = await prisma.chart.findUnique({
    where: { id: params.chartId },
    include: {
      instructor: true,
      member: { include: { user: true } },
      comments: { orderBy: { createdAt: "asc" }, include: { author: true } },
    },
  });
  if (!chart || chart.memberId !== params.id) notFound();
  if (!canViewMember(user, chart.member)) redirect("/dashboard");

  const isManager = canManageMember(user, chart.member);

  // 이 회차까지의 차트를 모아 회차별 비교로 표시 (20회차엔 10회차, 30회차엔 10·20회차)
  const allCharts = await prisma.chart.findMany({
    where: { memberId: chart.memberId, milestone: { lte: chart.milestone } },
    orderBy: { milestone: "asc" },
  });
  const timeline = allCharts.map((c) => ({
    milestone: c.milestone,
    content: parseChartContent(c.content),
  }));
  const current = parseChartContent(chart.content);
  const pdfs = allCharts.filter((c) => c.pdfPath);

  return (
    <>
      <NavBar user={user} />
      <main className="mx-auto w-full max-w-[1040px] space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-stone-900">
              {chart.member.user.name} 회원님 · {chart.milestone}회차 차트
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              {chart.instructor.name} 강사 · {formatDate(chart.updatedAt)} 작성
              {timeline.length > 1 &&
                ` · ${timeline.map((t) => `${t.milestone}회차`).join(" · ")} 함께 보기`}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/members/${chart.memberId}`} className="btn-secondary px-3 py-1.5 text-xs">
              ← 케어 페이지
            </Link>
            {isManager && (
              <Link
                href={`/members/${chart.memberId}/charts/${chart.id}/edit`}
                className="btn-primary px-3 py-1.5 text-xs"
              >
                수정
              </Link>
            )}
          </div>
        </div>

        <p className="text-xs text-stone-400 sm:hidden">
          ← 좌우로 밀어서 차트 전체를 볼 수 있어요.
        </p>

        <PaperChart
          memberName={chart.member.user.name}
          instructorName={chart.instructor.name}
          milestone={chart.milestone}
          content={current}
          timeline={timeline}
        />

        {pdfs.length > 0 && (
          <section className="card">
            <h2 className="mb-2 font-bold text-stone-900">첨부 파일</h2>
            <div className="flex flex-wrap gap-2">
              {pdfs.map((c) => (
                <a
                  key={c.id}
                  href={`/api/files/${c.pdfPath}`}
                  target="_blank"
                  className="btn-secondary text-sm"
                >
                  📎 {c.milestone}회차 차트 원본
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="card">
          <h2 className="font-bold text-stone-900">💬 소통</h2>
          <p className="mt-1 text-xs text-stone-400">
            차트에 대해 궁금한 점을 남겨주시면 강사님이 답변해 드려요.
          </p>
          <CommentSection
            chartId={chart.id}
            comments={chart.comments.map((cm) => ({
              id: cm.id,
              body: cm.body,
              createdAt: cm.createdAt.toISOString(),
              authorName: cm.author.name,
              authorRole: cm.author.role,
              mine: cm.author.id === user.id,
            }))}
          />
        </section>
      </main>
    </>
  );
}
