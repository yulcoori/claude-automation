"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginForm({ kakaoEnabled }: { kakaoEnabled: boolean }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", { phone, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("전화번호 또는 비밀번호가 올바르지 않습니다.");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="card space-y-5">
      {kakaoEnabled && (
        <>
          <button
            type="button"
            onClick={() => signIn("kakao", { callbackUrl: "/dashboard" })}
            className="btn-kakao w-full py-3"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.76 1.86 5.18 4.65 6.56-.2.75-.75 2.72-.86 3.14-.13.52.19.51.4.37.17-.11 2.65-1.8 3.72-2.53.67.1 1.37.16 2.09.16 5.52 0 10-3.48 10-7.7S17.52 3 12 3z" />
            </svg>
            카카오로 시작하기
          </button>
          <div className="flex items-center gap-3 text-xs text-stone-400">
            <div className="h-px flex-1 bg-stone-200" />
            또는 전화번호로 로그인
            <div className="h-px flex-1 bg-stone-200" />
          </div>
        </>
      )}
      <form onSubmit={handleCredentials} className="space-y-3">
        <div>
          <label className="label">전화번호</label>
          <input
            type="tel"
            className="input"
            placeholder="01012345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">비밀번호</label>
          <input
            type="password"
            className="input"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
      <p className="text-center text-xs leading-5 text-stone-400">
        처음이신가요?{" "}
        <Link href="/signup" className="font-semibold text-brand-600 hover:underline">
          회원가입
        </Link>
        <br />
        비밀번호를 잊으셨다면 센터에 문의해 주세요.
      </p>
    </div>
  );
}
