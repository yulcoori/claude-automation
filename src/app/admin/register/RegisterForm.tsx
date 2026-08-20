"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterForm({
  instructors,
}: {
  instructors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [role, setRole] = useState<"MEMBER" | "INSTRUCTOR">("MEMBER");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [program, setProgram] = useState("");
  const [instructorId, setInstructorId] = useState("");
  const [baseSessions, setBaseSessions] = useState("0");
  const [totalSessions, setTotalSessions] = useState("30");
  const [goal, setGoal] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role,
        name,
        phone,
        password,
        program,
        instructorId: instructorId || null,
        baseSessions: Number(baseSessions) || 0,
        totalSessions: Number(totalSessions) || 30,
        goal,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "등록에 실패했습니다.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <div>
        <label className="label">구분</label>
        <div className="grid grid-cols-2 gap-2">
          {(["MEMBER", "INSTRUCTOR"] as const).map((r) => (
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
              {r === "MEMBER" ? "회원" : "강사"}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">이름 *</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">전화번호 *</label>
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
          <label className="label">초기 비밀번호 *</label>
          <input
            className="input"
            placeholder="예: momo1234"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={4}
          />
        </div>
      </div>

      {role === "MEMBER" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">프로그램</label>
              <input
                className="input"
                placeholder="예: 1:1 리포머"
                value={program}
                onChange={(e) => setProgram(e.target.value)}
              />
            </div>
            <div>
              <label className="label">담당 강사</label>
              <select
                className="input"
                value={instructorId}
                onChange={(e) => setInstructorId(e.target.value)}
              >
                <option value="">미배정</option>
                {instructors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} 강사
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">이미 진행한 회차</label>
              <input
                type="number"
                min={0}
                className="input"
                value={baseSessions}
                onChange={(e) => setBaseSessions(e.target.value)}
              />
            </div>
            <div>
              <label className="label">전체 회차</label>
              <input
                type="number"
                min={1}
                className="input"
                value={totalSessions}
                onChange={(e) => setTotalSessions(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">운동 목표</label>
            <textarea
              className="input"
              rows={2}
              placeholder="예: 거북목 개선, 코어 강화"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full py-3">
        {loading ? "등록 중..." : role === "MEMBER" ? "회원 등록" : "강사 등록"}
      </button>
    </form>
  );
}
