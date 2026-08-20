import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canManageMember, canViewMember, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NavBar from "@/components/NavBar";
import CommentSection from "@/components/CommentSection";
import {
  type ChartContent,
  type ChartMediaRef,
  MOVEMENT_ITEMS,
  PLAN_PHASES,
  parseChartContent,
} from "@/lib/chartTemplate";
import { BodyMarkViewer } from "@/components/BodyDiagram";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "모모필라테스";

interface TimelineChart {
  id: string;
  milestone: number;
  updatedAt: Date;
  instructorName: string;
  pdfPath: string | null;
  content: ChartContent;
}

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

  // 이 회차까지의 모든 차트 (10회차 → 20회차 → …): 누적으로 한눈에 보여줌
  const allCharts = await prisma.chart.findMany({
    where: { memberId: chart.memberId, milestone: { lte: chart.milestone } },
    orderBy: { milestone: "asc" },
    include: { instructor: true },
  });
  const timeline: TimelineChart[] = allCharts.map((c) => ({
    id: c.id,
    milestone: c.milestone,
    updatedAt: c.updatedAt,
    instructorName: c.instructor.name,
    pdfPath: c.pdfPath,
    content: parseChartContent(c.content),
  }));
  const current = timeline.find((t) => t.id === chart.id) ?? timeline[timeline.length - 1];
  const earliest = timeline[0];
  const c = current.content;

  // 통증척도: 행 인덱스별로 회차 변화를 한 줄에
  const painRows = c.pain
    .map((row, i) => ({
      area: row.area || earliest.content.pain[i]?.area || "",
      pattern: row.pattern || earliest.content.pain[i]?.pattern || "",
      vasStart: earliest.content.pain[i]?.vasStart || row.vasStart,
      byMilestone: timeline.map((t) => t.content.pain[i]?.vasNow ?? ""),
    }))
    .filter((r) => r.area || r.pattern || r.vasStart || r.byMilestone.some(Boolean));

  // 움직임 평가: 행별 1회 + 회차별 기록
  const movementRows = c.movement
    .map((row, i) => {
      const note = MOVEMENT_ITEMS[i]?.note;
      const startText = earliest.content.movement[i]?.start || row.start;
      const startMedia = earliest.content.movement[i]?.startMedia ?? [];
      const equipment =
        row.equipment ||
        timeline
          .map((t) => t.content.movement[i]?.equipment)
          .filter(Boolean)
          .pop() ||
        "";
      const stages = timeline.map((t) => ({
        milestone: t.milestone,
        isCurrent: t.id === current.id,
        text: t.content.movement[i]?.now ?? "",
        media: (t.content.movement[i]?.nowMedia ?? []) as ChartMediaRef[],
      }));
      return { group: row.group, name: row.name, note, equipment, startText, startMedia, stages };
    })
    .filter(
      (r) =>
        r.equipment ||
        r.startText ||
        r.startMedia.length > 0 ||
        r.stages.some((s) => s.text || s.media.length > 0)
    );

  // 정적평가/개선점: 회차별로 쌓아서
  const postures = timeline.filter((t) => t.content.posture.trim());
  const improvements = timeline.filter((t) => t.content.improvements.trim());

  // 운동 계획: 종이 차트처럼 단기(10)/중기(20)/장기(30) 3열 — 해당 회차 차트의 내용을 사용
  const planColumns = PLAN_PHASES.map((phase, idx) => {
    const sourceMilestone = [10, 20, 30][idx];
    const source =
      timeline.find((t) => t.milestone === sourceMilestone)?.content ?? c;
    const lines = source[phase.key].filter((l: string) => l.trim());
    return { label: phase.label, lines };
  });

  const pdfs = timeline.filter((t) => t.pdfPath);

  return (
    <>
      <NavBar user={user} />
      <main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6">
        {/* 상단 */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-brand-600">{APP_NAME} 체형 분석 차트</p>
            <h1 className="text-xl font-bold text-stone-900">
              {chart.member.user.name} 회원님 · {chart.milestone}회차
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              {c.month && `${c.month} · `}
              {chart.instructor.name} 강사 · {formatDate(chart.updatedAt)} 작성
              {timeline.length > 1 &&
                ` · ${timeline.map((t) => `${t.milestone}회차`).join(" → ")} 누적 보기`}
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

        {/* 통증척도: 회차별 변화 한눈에 */}
        {painRows.length > 0 && (
          <section className="card">
            <h2 className="mb-3 font-bold text-stone-900">통증척도 (VAS 변화)</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-xs text-stone-400">
                    <th className="py-2 pr-3 font-semibold">부위</th>
                    <th className="py-2 pr-3 font-semibold">통증양상</th>
                    <th className="py-2 pr-3 font-semibold">1회</th>
                    {timeline.map((t) => (
                      <th
                        key={t.id}
                        className={`py-2 pr-3 font-semibold ${
                          t.id === current.id ? "text-brand-600" : ""
                        }`}
                      >
                        {t.milestone}회
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {painRows.map((row, i) => (
                    <tr key={i} className="border-b border-stone-100">
                      <td className="py-2 pr-3 font-semibold text-stone-700">{row.area || "-"}</td>
                      <td className="py-2 pr-3 text-stone-600">{row.pattern || "-"}</td>
                      <td className="py-2 pr-3 text-stone-600">{row.vasStart || "-"}</td>
                      {row.byMilestone.map((v, j) => (
                        <td key={j} className="py-2 pr-3">
                          <VasChange start={row.vasStart} now={v} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 움직임 평가: 1회 → 회차별 비교 (사진/영상 포함) */}
        {movementRows.length > 0 && (
          <section className="card">
            <h2 className="mb-3 font-bold text-stone-900">움직임 평가 (1회~30회)</h2>
            <div className="space-y-3">
              {movementRows.map((row, i) => (
                <div key={i} className="rounded-xl border border-stone-200 p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="badge bg-brand-50 text-brand-700">{row.group}</span>
                    <span className="text-sm font-bold text-stone-800">
                      {row.name}
                      {row.note && (
                        <span className="ml-1 font-normal text-brand-500">{row.note}</span>
                      )}
                    </span>
                    {row.equipment && (
                      <span className="ml-auto text-xs text-stone-500">기구: {row.equipment}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StageBlock label="1회" text={row.startText} media={row.startMedia} />
                    {row.stages.map((s) => (
                      <StageBlock
                        key={s.milestone}
                        label={`${s.milestone}회`}
                        text={s.text}
                        media={s.media}
                        highlight={s.isCurrent}
                      />
                    ))}
                  </div>
                </div>
              ))}
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

        {/* 체형 평가 내용 (정적평가) - 회차별 */}
        {postures.length > 0 && (
          <section className="card space-y-3">
            <h2 className="font-bold text-stone-900">체형 평가 내용 (정적평가)</h2>
            {postures.map((t) => (
              <div key={t.id} className="rounded-xl bg-stone-50 px-4 py-3 text-sm">
                <span
                  className={`text-xs font-bold ${
                    t.id === current.id ? "text-brand-600" : "text-stone-500"
                  }`}
                >
                  {t.milestone}회차
                </span>
                <p className="mt-1 whitespace-pre-wrap leading-6 text-stone-700">
                  {t.content.posture}
                </p>
              </div>
            ))}
          </section>
        )}

        {/* 개선점 - 회차별 */}
        {improvements.length > 0 && (
          <section className="card space-y-3">
            <h2 className="font-bold text-stone-900">
              개선된 점과 앞으로 중점적으로 들어갈 운동
            </h2>
            {improvements.map((t) => (
              <div key={t.id} className="rounded-xl bg-stone-50 px-4 py-3 text-sm">
                <span
                  className={`text-xs font-bold ${
                    t.id === current.id ? "text-brand-600" : "text-stone-500"
                  }`}
                >
                  {t.milestone}회차
                </span>
                <p className="mt-1 whitespace-pre-wrap leading-6 text-stone-700">
                  {t.content.improvements}
                </p>
              </div>
            ))}
          </section>
        )}

        {/* 운동 계획: 단기/중기/장기 3열 (종이 차트와 동일) */}
        {planColumns.some((p) => p.lines.length > 0) && (
          <section className="card">
            <h2 className="mb-3 font-bold text-stone-900">운동 계획</h2>
            <div className="grid gap-4 lg:grid-cols-3">
              {planColumns.map((col) => (
                <div key={col.label} className="rounded-xl border border-stone-200 p-4">
                  <h3 className="mb-2 text-center text-sm font-bold text-brand-700">{col.label}</h3>
                  {col.lines.length > 0 ? (
                    <ol className="list-decimal space-y-1 pl-5 text-sm text-stone-700">
                      {col.lines.map((line: string, i: number) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-center text-xs text-stone-300">-</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 첨부 파일 */}
        {pdfs.length > 0 && (
          <section className="card">
            <h2 className="mb-2 font-bold text-stone-900">첨부 파일</h2>
            <div className="flex flex-wrap gap-2">
              {pdfs.map((t) => (
                <a
                  key={t.id}
                  href={`/api/files/${t.pdfPath}`}
                  target="_blank"
                  className="btn-secondary text-sm"
                >
                  📎 {t.milestone}회차 차트 원본
                </a>
              ))}
            </div>
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
  if (!now) return <span className="text-stone-300">-</span>;
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

// 움직임 평가 회차별 블록 (텍스트 + 사진/영상)
function StageBlock({
  label,
  text,
  media,
  highlight,
}: {
  label: string;
  text: string;
  media: ChartMediaRef[];
  highlight?: boolean;
}) {
  if (!text && media.length === 0) return null;
  return (
    <div
      className={`min-w-[9rem] flex-1 rounded-lg p-2 ${
        highlight ? "bg-brand-50 ring-1 ring-brand-200" : "bg-stone-50"
      }`}
    >
      <div className={`text-xs font-bold ${highlight ? "text-brand-600" : "text-stone-500"}`}>
        {label}
      </div>
      {text && <p className="mt-0.5 whitespace-pre-wrap text-sm text-stone-700">{text}</p>}
      {media.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {media.map((m, i) =>
            m.kind === "VIDEO" ? (
              <video
                key={i}
                src={`/api/files/${m.path}`}
                controls
                playsInline
                preload="metadata"
                className="max-h-32 w-full rounded-lg bg-stone-900"
              />
            ) : (
              <a key={i} href={`/api/files/${m.path}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/files/${m.path}`}
                  alt=""
                  className="h-20 w-20 rounded-lg object-cover"
                  loading="lazy"
                />
              </a>
            )
          )}
        </div>
      )}
    </div>
  );
}
