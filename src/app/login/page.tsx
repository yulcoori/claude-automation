import LoginForm from "./LoginForm";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "모모필라테스";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const kakaoEnabled = Boolean(process.env.KAKAO_CLIENT_ID);
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-600 text-3xl text-white shadow-lg">
          🧘
        </div>
        <h1 className="text-2xl font-bold text-stone-900">{APP_NAME}</h1>
        <p className="mt-2 text-sm text-stone-500">
          회원님과 강사님을 잇는 프라이빗 케어 공간
        </p>
      </div>
      <LoginForm kakaoEnabled={kakaoEnabled} />
    </main>
  );
}
