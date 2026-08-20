import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NavBar from "@/components/NavBar";
import RegisterForm from "./RegisterForm";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const instructors = await prisma.user.findMany({
    where: { role: "INSTRUCTOR", status: "ACTIVE" },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <NavBar user={user} />
      <main className="mx-auto w-full max-w-lg px-4 py-6">
        <h1 className="mb-1 text-xl font-bold text-stone-900">회원/강사 등록</h1>
        <p className="mb-5 text-sm text-stone-500">
          등록 후 전화번호와 초기 비밀번호를 알려주시면 바로 로그인할 수 있습니다. 카카오로
          가입한 경우에는 대시보드의 승인 대기 목록에서 연결하세요.
        </p>
        <RegisterForm instructors={instructors.map((i) => ({ id: i.id, name: i.name }))} />
      </main>
    </>
  );
}
