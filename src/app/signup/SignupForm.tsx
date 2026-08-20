"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SignupForm() {
  const router = useRouter();
  const [role, setRole] = useState<"MEMBER" | "INSTRUCTOR">("MEMBER");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 4) {
      setError("비밀번호는 4자 이상이어야 합니다.");
      return;
    }
    if (password !== confirm) {
      setError("비밀번호가 서로 일치하지 않습니다.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, name, phone, password }),
    });
    if (!res.ok) {
      setLoading(false);
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "가입에 실패했습니다.");
      return;
    }
    // 가입 후 자동 로그인
    await signIn("credentials", { phone, password, redirect: false });
    setLoading(false);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="card space-y-4">
      <div>
        <label className="label">구분</label>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["MEMBER", "회원"],
              ["INSTRUCTOR", "강사"],
            ] as const
          ).map(([r, label]) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                role === r
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-stone-200 bg-white text-stone-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {role === "INSTRUCTOR" && (
          <p className="mt-1.5 text-xs text-amber-600">
            강사 계정은 가입 후 원장님이 승인해야 이용할 수 있어요.
          </p>
        )}
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">이름</label>
          <input
            className="input"
            placeholder="실명을 입력해 주세요"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">비밀번호</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
            />
          </div>
          <div>
            <label className="label">비밀번호 확인</label>
            <input
              type="password"
              className="input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? "가입 중..." : "가입하기"}
        </button>
      </form>
      <p className="text-center text-xs text-stone-400">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          로그인
        </Link>
      </p>
    </div>
  );
}
