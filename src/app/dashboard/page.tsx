import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NavBar from "@/components/NavBar";
import ProgressBar from "@/components/ProgressBar";
import PendingApprovals from "@/components/admin/PendingApprovals";
import MemberTable from "@/components/admin/MemberTable";
import NoticeBanner from "@/components/NoticeBanner";
import InstructorList from "@/components/admin/InstructorList";
import { formatPhone } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status === "PENDING") redirect("/pending");

  // 회원은 자신의 케어 페이지로 바로 이동
  if (user.role === "MEMBER") {
    const profile = await prisma.memberProfile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      return (
        <>
          <NavBar user={user} />
          <main className="mx-auto w-full max-w-md px-5 py-16 text-center">
            <div className="card py-10">
              <p className="text-sm leading-6 text-stone-500">
                아직 회원 정보가 준비되지 않았습니다.
                <br />
                센터에 문의해 주세요.
              </p>
            </div>
          </main>
        </>
      );
    }
    redirect(`/members/${profile.id}`);
  }

  if (user.role === "INSTRUCTOR") {
    return <InstructorDashboard user={user} />;
  }

  return <AdminDashboard user={user} />;
}

async function InstructorDashboard({
  user,
}: {
  user: { id: string; name: string; role: string };
}) {
  const members = await prisma.memberProfile.findMany({
    where: { instructorId: user.id },
    include: {
      user: true,
      _count: { select: { sessionLogs: true, charts: true, posts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <NavBar user={user} />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <div className="mb-5">
          <NoticeBanner />
        </div>
        <h1 className="mb-1 text-xl font-bold text-stone-900">담당 회원</h1>
        {/* 회원 수는 관리자(원장님)만 볼 수 있습니다 */}
        <p className="mb-5 text-sm text-stone-500">{user.name} 강사님이 담당하는 회원입니다.</p>
        {members.length === 0 ? (
          <div className="card py-12 text-center text-sm text-stone-400">
            아직 담당 회원이 없습니다. 관리자에게 배정을 요청하세요.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((m) => {
              const current = m.baseSessions + m._count.sessionLogs;
              return (
                <Link key={m.id} href={`/members/${m.id}`} className="card block transition hover:border-brand-300 hover:shadow-md">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-stone-900">{m.user.name}</div>
                      <div className="text-xs text-stone-400">{m.program ?? "프로그램 미지정"}</div>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-lg">
                      💪
                    </div>
                  </div>
                  <ProgressBar current={current} total={m.totalSessions} />
                  <div className="mt-3 flex gap-3 text-xs text-stone-400">
                    <span>차트 {m._count.charts}</span>
                    <span>게시물 {m._count.posts}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

async function AdminDashboard({ user }: { user: { id: string; name: string; role: string } }) {
  // 회원인데 프로필이 없는 계정 보정 (예전 데이터 호환)
  const usersWithoutProfile = await prisma.user.findMany({
    where: { role: "MEMBER", status: "ACTIVE", memberProfile: null },
    select: { id: true },
  });
  if (usersWithoutProfile.length > 0) {
    await prisma.memberProfile.createMany({
      data: usersWithoutProfile.map((u) => ({ userId: u.id, startedAt: new Date() })),
    });
  }

  const [pendingUsers, members, instructors] = await Promise.all([
    prisma.user.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" } }),
    prisma.memberProfile.findMany({
      include: {
        user: true,
        instructor: true,
        _count: { select: { sessionLogs: true, charts: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { role: "INSTRUCTOR", status: "ACTIVE" },
      orderBy: { name: "asc" },
      include: { _count: { select: { instructedMembers: true } } },
    }),
  ]);

  return (
    <>
      <NavBar user={user} />
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-stone-900">센터 관리</h1>
            <p className="text-sm text-stone-500">
              회원 {members.length}명 · 강사 {instructors.length}명
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/notices/new" className="btn-secondary">
              📢 공지 작성
            </Link>
            <Link href="/admin/register" className="btn-primary">
              + 회원/강사 등록
            </Link>
          </div>
        </div>

        <PendingApprovals
          pendingUsers={pendingUsers.map((u) => ({
            id: u.id,
            name: u.name,
            phone: formatPhone(u.phone),
            role: u.role,
            viaKakao: Boolean(u.kakaoId),
            createdAt: u.createdAt.toISOString(),
          }))}
          instructors={instructors.map((i) => ({ id: i.id, name: i.name }))}
          linkTargets={members.map((m) => ({
            id: m.user.id,
            name: m.user.name,
            phone: formatPhone(m.user.phone),
          }))}
        />

        <InstructorList
          instructors={instructors.map((i) => ({
            id: i.id,
            name: i.name,
            phone: formatPhone(i.phone),
            memberCount: i._count.instructedMembers,
          }))}
        />

        <MemberTable
          members={members.map((m) => ({
            id: m.id,
            userId: m.user.id,
            name: m.user.name,
            phone: formatPhone(m.user.phone),
            program: m.program,
            instructorId: m.instructorId,
            instructorName: m.instructor?.name ?? null,
            current: m.baseSessions + m._count.sessionLogs,
            total: m.totalSessions,
            baseSessions: m.baseSessions,
            goal: m.goal,
            charts: m._count.charts,
          }))}
          instructors={instructors.map((i) => ({ id: i.id, name: i.name }))}
        />
      </main>
    </>
  );
}
