import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NavBar from "@/components/NavBar";
import PasswordForm from "./PasswordForm";
import { formatPhone } from "@/lib/format";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "관리자",
  INSTRUCTOR: "강사",
  MEMBER: "회원",
};

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status === "PENDING") redirect("/pending");

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) redirect("/login");

  return (
    <>
      <NavBar user={user} />
      <main className="mx-auto w-full max-w-lg space-y-5 px-4 py-6">
        <h1 className="text-xl font-bold text-stone-900">⚙️ 내 정보</h1>

        <section className="card">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs font-semibold text-stone-400">이름</div>
              <div className="mt-0.5 font-semibold text-stone-800">{dbUser.name}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-stone-400">구분</div>
              <div className="mt-0.5 font-semibold text-stone-800">
                {ROLE_LABEL[dbUser.role] ?? dbUser.role}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-stone-400">전화번호</div>
              <div className="mt-0.5 font-semibold text-stone-800">{formatPhone(dbUser.phone)}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-stone-400">카카오 연결</div>
              <div className="mt-0.5 font-semibold text-stone-800">
                {dbUser.kakaoId ? "연결됨 ✅" : "미연결"}
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <h2 className="mb-1 font-bold text-stone-900">비밀번호 변경</h2>
          {dbUser.phone ? (
            <>
              <p className="mb-4 text-xs text-stone-400">
                전화번호 로그인에 사용하는 비밀번호입니다.
              </p>
              <PasswordForm hasPassword={Boolean(dbUser.passwordHash)} />
            </>
          ) : (
            <p className="py-4 text-sm text-stone-400">
              카카오 로그인 전용 계정입니다. 전화번호 로그인이 필요하면 센터에 문의해 주세요.
            </p>
          )}
        </section>
      </main>
    </>
  );
}
