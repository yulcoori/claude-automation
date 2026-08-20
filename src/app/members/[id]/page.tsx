import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canManageMember, canViewMember, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NavBar from "@/components/NavBar";
import ProgressBar from "@/components/ProgressBar";
import PostCard from "@/components/PostCard";
import UploadPanel from "@/components/UploadPanel";
import SessionLogPanel from "@/components/SessionLogPanel";
import NoticeBanner from "@/components/NoticeBanner";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const MILESTONES = [10, 20, 30];

export default async function MemberPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status === "PENDING") redirect("/pending");

  const member = await prisma.memberProfile.findUnique({
    where: { id: params.id },
    include: {
      user: true,
      instructor: true,
      posts: {
        orderBy: { createdAt: "desc" },
        include: {
          media: true,
          author: true,
          comments: { orderBy: { createdAt: "asc" }, include: { author: true } },
        },
      },
      charts: { orderBy: { milestone: "asc" }, include: { instructor: true } },
      sessionLogs: { orderBy: { date: "desc" }, include: { instructor: true } },
    },
  });
  if (!member) notFound();
  if (!canViewMember(user, member)) redirect("/dashboard");

  const isManager = canManageMember(user, member);
  const currentSessions = member.baseSessions + member.sessionLogs.length;
  const beforeAfterPosts = member.posts.filter((p) => p.type === "BEFORE_AFTER");
  const mediaPosts = member.posts.filter((p) => p.type === "MEDIA");

  const serializeComments = (
    comments: { id: string; body: string; createdAt: Date; author: { id: string; name: string; role: string } }[]
  ) =>
    comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      authorName: c.author.name,
      authorRole: c.author.role,
      mine: c.author.id === user.id,
    }));

  return (
    <>
      <NavBar user={user} />
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
        <NoticeBanner />

        {/* 회원 프로필 헤더 */}
        <section className="card">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-stone-900">{member.user.name} 회원님</h1>
              <p className="mt-1 text-sm text-stone-500">
                {member.program ?? "프로그램 미지정"} ·{" "}
                {member.instructor ? `${member.instructor.name} 강사` : "담당 강사 미배정"}
                {member.startedAt && ` · ${formatDate(member.startedAt)} 시작`}
              </p>
            </div>
            {user.role !== "MEMBER" && (
              <Link href="/dashboard" className="text-xs text-stone-400 hover:text-stone-600">
                ← 목록
              </Link>
            )}
          </div>
          <ProgressBar current={currentSessions} total={member.totalSessions} />
          {member.goal && (
            <div className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm">
              <span className="font-semibold text-brand-700">🎯 운동 목표</span>
              <p className="mt-1 whitespace-pre-wrap text-stone-700">{member.goal}</p>
            </div>
          )}
        </section>

        {/* 빠른 이동 탭 */}
        <nav className="sticky top-14 z-10 -mx-4 flex gap-1 overflow-x-auto border-b border-stone-200 bg-stone-50/95 px-4 py-2 backdrop-blur">
          {[
            ["#charts", "📋 월말차트"],
            ["#before-after", "📸 비포&애프터"],
            ["#media", "🎬 사진·영상"],
            ["#sessions", "🗓 수업 기록"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-white hover:shadow-sm"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* 월말차트 */}
        <section id="charts" className="scroll-mt-28">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-stone-900">📋 월말차트 (체형 분석)</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {MILESTONES.map((m) => {
              const chart = member.charts.find((c) => c.milestone === m);
              const reached = currentSessions >= m;
              return (
                <div
                  key={m}
                  className={`card ${chart ? "border-brand-200" : ""} ${
                    !chart && !reached ? "opacity-70" : ""
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-bold text-stone-800">{m}회차</span>
                    {chart ? (
                      <span className="badge bg-brand-600 text-white">작성됨</span>
                    ) : reached ? (
                      <span className="badge bg-amber-100 text-amber-700">작성 필요</span>
                    ) : (
                      <span className="badge bg-stone-100 text-stone-400">예정</span>
                    )}
                  </div>
                  {chart ? (
                    <div className="space-y-2">
                      <p className="text-xs text-stone-400">
                        {chart.instructor.name} 강사 · {formatDate(chart.updatedAt)}
                      </p>
                      <Link
                        href={`/members/${member.id}/charts/${chart.id}`}
                        className="btn-secondary w-full text-xs"
                      >
                        차트 보기
                      </Link>
                    </div>
                  ) : isManager ? (
                    <Link
                      href={`/members/${member.id}/charts/new?milestone=${m}`}
                      className="btn-primary w-full text-xs"
                    >
                      + 차트 작성
                    </Link>
                  ) : (
                    <p className="text-xs text-stone-400">
                      {reached ? "강사님이 곧 작성해 드릴 거예요." : `${m}회차 도달 시 작성됩니다.`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {member.charts.some((c) => !MILESTONES.includes(c.milestone)) && (
            <div className="mt-3 space-y-2">
              {member.charts
                .filter((c) => !MILESTONES.includes(c.milestone))
                .map((c) => (
                  <Link
                    key={c.id}
                    href={`/members/${member.id}/charts/${c.id}`}
                    className="card flex items-center justify-between text-sm hover:border-brand-300"
                  >
                    <span className="font-semibold">{c.milestone}회차 차트</span>
                    <span className="text-xs text-stone-400">{formatDate(c.updatedAt)}</span>
                  </Link>
                ))}
            </div>
          )}
        </section>

        {/* 업로드 (강사/관리자 전용) */}
        {isManager && <UploadPanel memberId={member.id} currentSessions={currentSessions} />}

        {/* 비포&애프터 */}
        <section id="before-after" className="scroll-mt-28">
          <h2 className="mb-3 font-bold text-stone-900">
            📸 비포&애프터{" "}
            <span className="text-sm font-normal text-stone-400">({beforeAfterPosts.length})</span>
          </h2>
          {beforeAfterPosts.length === 0 ? (
            <div className="card py-10 text-center text-sm text-stone-400">
              아직 비포&애프터 기록이 없습니다.
            </div>
          ) : (
            <div className="space-y-4">
              {beforeAfterPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={{
                    id: post.id,
                    type: post.type,
                    sessionNumber: post.sessionNumber,
                    caption: post.caption,
                    createdAt: post.createdAt.toISOString(),
                    authorName: post.author.name,
                    canDelete: isManager || post.authorId === user.id,
                    media: post.media.map((m) => ({
                      id: m.id,
                      kind: m.kind,
                      slot: m.slot,
                      url: `/api/files/${m.filePath}`,
                    })),
                  }}
                  comments={serializeComments(post.comments)}
                />
              ))}
            </div>
          )}
        </section>

        {/* 사진·영상 */}
        <section id="media" className="scroll-mt-28">
          <h2 className="mb-3 font-bold text-stone-900">
            🎬 사진·영상{" "}
            <span className="text-sm font-normal text-stone-400">({mediaPosts.length})</span>
          </h2>
          {mediaPosts.length === 0 ? (
            <div className="card py-10 text-center text-sm text-stone-400">
              아직 업로드된 사진/영상이 없습니다.
            </div>
          ) : (
            <div className="space-y-4">
              {mediaPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={{
                    id: post.id,
                    type: post.type,
                    sessionNumber: post.sessionNumber,
                    caption: post.caption,
                    createdAt: post.createdAt.toISOString(),
                    authorName: post.author.name,
                    canDelete: isManager || post.authorId === user.id,
                    media: post.media.map((m) => ({
                      id: m.id,
                      kind: m.kind,
                      slot: m.slot,
                      url: `/api/files/${m.filePath}`,
                    })),
                  }}
                  comments={serializeComments(post.comments)}
                />
              ))}
            </div>
          )}
        </section>

        {/* 수업 기록 */}
        <section id="sessions" className="scroll-mt-28">
          <h2 className="mb-3 font-bold text-stone-900">
            🗓 수업 기록{" "}
            <span className="text-sm font-normal text-stone-400">
              (총 {currentSessions}회{member.baseSessions > 0 && `, 앱 도입 전 ${member.baseSessions}회 포함`})
            </span>
          </h2>
          <SessionLogPanel
            memberId={member.id}
            isManager={isManager}
            logs={member.sessionLogs.map((l, idx) => ({
              id: l.id,
              number: currentSessions - idx,
              date: l.date.toISOString(),
              memo: l.memo,
              instructorName: l.instructor?.name ?? null,
            }))}
          />
        </section>
      </main>
    </>
  );
}
