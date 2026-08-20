"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface EditableUser {
  userId: string;
  name: string;
  phone: string;
  role: "MEMBER" | "INSTRUCTOR";
  // 회원일 때만
  program?: string | null;
  instructorId?: string | null;
  baseSessions?: number;
  totalSessions?: number;
  goal?: string | null;
}

export default function EditUserDialog({
  user,
  instructors,
  onClose,
}: {
  user: EditableUser;
  instructors: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone.replace(/\D/g, ""));
  const [password, setPassword] = useState("");
  const [program, setProgram] = useState(user.program ?? "");
  const [instructorId, setInstructorId] = useState(user.instructorId ?? "");
  const [baseSessions, setBaseSessions] = useState(String(user.baseSessions ?? 0));
  const [totalSessions, setTotalSessions] = useState(String(user.totalSessions ?? 30));
  const [goal, setGoal] = useState(user.goal ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isMember = user.role === "MEMBER";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch(`/api/admin/users/${user.userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone,
        ...(password ? { password } : {}),
        ...(isMember
          ? {
              program,
              instructorId: instructorId || null,
              baseSessions: Number(baseSessions) || 0,
              totalSessions: Number(totalSessions) || 30,
              goal,
            }
          : {}),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "저장에 실패했습니다.");
      return;
    }
    onClose();
    router.refresh();
  }

  async function remove() {
    const label = isMember ? "회원" : "강사";
    if (
      !confirm(
        `${user.name} ${label}님을 정말 삭제할까요?\n\n` +
          (isMember
            ? "이 회원의 사진·영상·차트·수업기록이 모두 함께 삭제되며 되돌릴 수 없습니다."
            : "담당 회원들은 '미배정'으로 바뀌고, 작성한 차트와 게시물은 유지됩니다.")
      )
    )
      return;
    if (!confirm("정말 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;

    setLoading(true);
    const res = await fetch(`/api/admin/users/${user.userId}`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "삭제에 실패했습니다.");
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-stone-900">
            {isMember ? "회원" : "강사"} 정보 수정
          </h2>
          <button type="button" onClick={onClose} className="text-sm text-stone-400">
            닫기 ✕
          </button>
        </div>

        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="label">이름</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">전화번호</label>
              <input
                type="tel"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">새 비밀번호 (선택)</label>
              <input
                className="input"
                placeholder="변경 시에만 입력"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {isMember && (
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
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? "저장 중..." : "저장"}
          </button>
        </form>

        <div className="mt-5 border-t border-stone-200 pt-4">
          <button
            type="button"
            onClick={remove}
            disabled={loading}
            className="btn w-full border border-red-200 bg-red-50 py-2.5 text-sm text-red-600 hover:bg-red-100"
          >
            🗑 {isMember ? "회원" : "강사"} 삭제
          </button>
          <p className="mt-2 text-center text-xs text-stone-400">
            {isMember
              ? "사진·영상·차트가 모두 삭제되며 되돌릴 수 없습니다."
              : "담당 회원은 미배정으로 바뀌고 작성 기록은 유지됩니다."}
          </p>
        </div>
      </div>
    </div>
  );
}
