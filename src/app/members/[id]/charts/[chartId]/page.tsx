import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canManageMember, canViewMember, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NavBar from "@/components/NavBar";
import CommentSection from "@/components/CommentSection";
import { MOVEMENT_ITEMS, PLAN_PHASES, parseChartContent } from "@/lib/chartTemplate";
import { BodyMarkViewer } from "@/components/BodyDiagram";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "모모필라테스";

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
  const c = parseChartContent(chart.content);

  const painRows = c.pain.filter((p) => p.area || p.pattern || p.vasStart || p.vasNow);
  const hasPlan = (lines: string[]) => lines.some((l) => l.trim());

  return (
    <>
      <NavBar user={user} />
      <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-brand-600">{APP_NAME} 체형 분석 차트</p>
            <h1 className="text-xl font-bold text-stone-900">
              {chart.member.user.name} 회원님 · {chart.milestone}회차
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              {c.month && `${c.month} · `}
              {chart.instructor.name} 강사 · {formatDate(chart.updatedAt)} 작성
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

        {/* 기본 정보 */}
        <section className="card">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
            <Info label="프로그램" value={c.program} />
            <Info label="전체횟수" value={c.totalCount} />
            <Info label="사용횟수" value={c.usedCount} />
            <Info label="리뉴횟수" value={c.renewCount} />
            <Info label="체력상태" value={c.fitnessLevel && `${c.fitnessLevel} (상/중/하)`} />
            <Info label="방문 목적도 달성" value={c.achievement && `${c.achievement}%`} />
          </div>
          {c.goal && (
            <div className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm">
              <span className="font-semibold text-brand-700">🎯 회원님 운동목표</span>
              <p className="mt-1 whitespace-pre-wrap text-stone-700">{c.goal}</p>
            </div>
          )}
        </section>

        {/* 통증척도 */}
        {painRows.length > 0 && (
          <section className="card">
            <h2 className="mb-3 font-bold text-stone-900">통증척도 (1회~30회)</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-xs text-stone-400">
                    <th className="py-2 pr-3 font-semibold">부위</th>
                    <th className="py-2 pr-3 font-semibold">통증양상</th>
                    <th className="py-2 pr-3 font-semibold">VAS 1회</th>
                    <th className="py-2 font-semibold">VAS 현재</th>
                  </tr>
                </thead>
                <tbody>
                  {painRows.map((row, i) => (
                    <tr key={i} className="border-b border-stone-100">
                      <td className="py-2 pr-3 font-semibold text-stone-700">{row.area || "-"}</td>
                      <td className="py-2 pr-3 text-stone-600">{row.pattern || "-"}</td>
                      <td className="py-2 pr-3 text-stone-600">{row.vasStart || "-"}</td>
                      <td className="py-2">
                        <VasChange start={row.vasStart} now={row.vasNow} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 움직임 평가 */}
        {c.movement.some((m) => m.equipment || m.start || m.now) && (
          <section className="card">
            <h2 className="mb-3 font-bold text-stone-900">움직임 평가 (1회~30회)</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-xs text-stone-400">
                    <th className="py-2 pr-3 font-semibold">부위</th>
                    <th className="py-2 pr-3 font-semibold">동작</th>
                    <th className="py-2 pr-3 font-semibold">기구</th>
                    <th className="py-2 pr-3 font-semibold">1회</th>
                    <th className="py-2 font-semibold">현재</th>
                  </tr>
                </thead>
                <tbody>
                  {c.movement.map((row, i) => {
                    if (!row.equipment && !row.start && !row.now) return null;
                    const note = MOVEMENT_ITEMS[i]?.note;
                    return (
                      <tr key={i} className="border-b border-stone-100">
                        <td className="py-2 pr-3 text-xs font-bold text-brand-700">{row.group}</td>
                        <td className="py-2 pr-3 font-semibold text-stone-700">
                          {row.name}
                          {note && <span className="ml-1 text-xs text-brand-500">{note}</span>}
                        </td>
                        <td className="py-2 pr-3 text-stone-600">{row.equipment || "-"}</td>
                        <td className="py-2 pr-3 text-stone-600">{row.start || "-"}</td>
                        <td className="py-2 text-stone-600">{row.now || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 체형 그림 마킹 */}
        {c.bodyMarks.length > 0 && (
          <section className="card">
            <h2 className="mb-3 font-bold text-stone-900">체형 그림 마킹</h2>
            <BodyMarkViewer marks={c.bodyMarks} />
          </section>
        )}

        {/* 체형 평가 */}
        {c.posture && (
          <section className="card">
            <h2 className="mb-2 font-bold text-stone-900">체형 평가 내용 (정적평가)</h2>
            <p className="whitespace-pre-wrap text-sm leading-6 text-stone-700">{c.posture}</p>
          </section>
        )}

        {/* 운동 계획 */}
        {(c.improvements || PLAN_PHASES.some((p) => hasPlan(c[p.key]))) && (
          <section className="card space-y-4">
            <h2 className="font-bold text-stone-900">운동 계획</h2>
            {c.improvements && (
              <div className="rounded-xl bg-stone-50 px-4 py-3 text-sm">
                <span className="text-xs font-semibold text-stone-500">
                  *개선된 점과 앞으로 중점적으로 들어갈 운동
                </span>
                <p className="mt-1 whitespace-pre-wrap leading-6 text-stone-700">{c.improvements}</p>
              </div>
            )}
            <div className="grid gap-4 lg:grid-cols-3">
              {PLAN_PHASES.map((phase) => {
                const lines = c[phase.key].filter((l: string) => l.trim());
                if (lines.length === 0) return null;
                return (
                  <div key={phase.key} className="rounded-xl border border-stone-200 p-4">
                    <h3 className="mb-2 text-center text-sm font-bold text-brand-700">
                      {phase.label}
                    </h3>
                    <ol className="list-decimal space-y-1 pl-5 text-sm text-stone-700">
                      {lines.map((line: string, i: number) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 첨부 파일 */}
        {chart.pdfPath && (
          <section className="card">
            <h2 className="mb-2 font-bold text-stone-900">첨부 파일</h2>
            <a
              href={`/api/files/${chart.pdfPath}`}
              target="_blank"
              className="btn-secondary text-sm"
            >
              📎 차트 원본 파일 보기
            </a>
          </section>
        )}

        {/* 댓글 */}
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

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs font-semibold text-stone-400">{label}</div>
      <div className="mt-0.5 font-semibold text-stone-800">{value || "-"}</div>
    </div>
  );
}

function VasChange({ start, now }: { start: string; now: string }) {
  if (!now) return <span className="text-stone-600">-</span>;
  const s = Number(start);
  const n = Number(now);
  const improved = !Number.isNaN(s) && !Number.isNaN(n) && n < s;
  return (
    <span className={improved ? "font-bold text-emerald-600" : "text-stone-600"}>
      {now}
      {improved && " ↓"}
    </span>
  );
}
