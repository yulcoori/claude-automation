import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import SignOutButton from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "PENDING") redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-5 text-center">
      <div className="card w-full space-y-4 py-10">
        <div className="text-5xl">⏳</div>
        <h1 className="text-xl font-bold text-stone-900">승인 대기 중입니다</h1>
        <p className="text-sm leading-6 text-stone-500">
          {user.name}님, 가입이 완료되었습니다.
          <br />
          원장님 승인 후 바로 이용하실 수 있어요.
          <br />
          센터에 말씀해 주시면 빠르게 승인해 드리겠습니다.
        </p>
        <SignOutButton className="btn-secondary" />
      </div>
    </main>
  );
}
