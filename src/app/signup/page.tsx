import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import SignupForm from "./SignupForm";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "모모필라테스";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-600 text-3xl text-white shadow-lg">
          🧘
        </div>
        <h1 className="text-2xl font-bold text-stone-900">{APP_NAME} 회원가입</h1>
        <p className="mt-2 text-sm text-stone-500">
          회원님은 가입 후 바로 이용할 수 있어요.
          <br />
          강사님은 원장님 승인 후 이용할 수 있습니다.
        </p>
      </div>
      <SignupForm />
    </main>
  );
}
