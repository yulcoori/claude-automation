"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format";

export interface PendingUser {
  id: string;
  name: string;
  phone: string;
  role: string; // 본인이 가입할 때 선택한 구분
  viaKakao: boolean;
  createdAt: string;
}

export default function PendingApprovals({
  pendingUsers,
  instructors,
  linkTargets,
}: {
  pendingUsers: PendingUser[];
  instructors: { id: string; name: string }[];
  linkTargets: { id: string; name: string; phone: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function act(userId: string, body: Record<string, unknown>) {
    setBusy(userId);
    setError("");
    const res = await fetch("/api/admin/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...body }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "처리에 실패했습니다.");
    } else {
      router.refresh();
    }
  }

  if (pendingUsers.length === 0) return null;

  return (
    <section className="card border-amber-200 bg-amber-50/50">
      <h2 className="mb-1 font-bold text-stone-900">🔔 승인 대기 ({pendingUsers.length})</h2>
      <p className="mb-3 text-xs text-stone-500">
        본인이 직접 가입한 계정입니다. 맞는 분인지 확인 후 승인해 주세요.
      </p>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="space-y-2">
        {pendingUsers.map((u) => (
          <PendingRow
            key={u.id}
            user={u}
            instructors={instructors}
            linkTargets={linkTargets}
            busy={busy === u.id}
            onAct={(body) => act(u.id, body)}
          />
        ))}
      </div>
    </section>
  );
}

function PendingRow({
  user,
  instructors,
  linkTargets,
  busy,
  onAct,
}: {
  user: PendingUser;
  instructors: { id: string; name: string }[];
  linkTargets: { id: string; name: string; phone: string }[];
  busy: boolean;
  onAct: (body: Record<string, unknown>) => void;
}) {
  const wantsInstructor = user.role === "INSTRUCTOR";
  const [role, setRole] = useState<"MEMBER" | "INSTRUCTOR">(
    wantsInstructor ? "INSTRUCTOR" : "MEMBER"
  );
  const [instructorId, setInstructorId] = useState("");
  const [linkTargetId, setLinkTargetId] = useState("");
  const [linking, setLinking] = useState(false);

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-stone-800">{user.name}</span>
          <span className="badge bg-stone-100 text-stone-500">{user.phone}</span>
          <span
            className={`badge ${
              wantsInstructor ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"
            }`}
          >
            {wantsInstructor ? "강사로 신청" : "회원으로 신청"}
          </span>
          {user.viaKakao && <span className="badge bg-[#FEE500] text-[#191919]">카카오</span>}
          <span className="text-xs text-stone-400">{formatDateTime(user.createdAt)}</span>
        </div>
        <button
          type="button"
          className="text-xs text-stone-400 hover:text-red-600"
          disabled={busy}
          onClick={() => {
            if (confirm(`${user.name} 계정을 삭제할까요?`)) onAct({ action: "delete" });
          }}
        >
          삭제
        </button>
      </div>

      {linking ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input w-auto py-1.5 text-xs"
            value={linkTargetId}
            onChange={(e) => setLinkTargetId(e.target.value)}
          >
            <option value="">연결할 기존 회원 선택</option>
            {linkTargets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.phone})
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-primary px-3 py-1.5 text-xs"
            disabled={busy || !linkTargetId}
            onClick={() => onAct({ action: "link", targetUserId: linkTargetId })}
          >
            연결
          </button>
          <button
            type="button"
            className="text-xs text-stone-400"
            onClick={() => setLinking(false)}
          >
            취소
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input w-auto py-1.5 text-xs"
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
          >
            <option value="MEMBER">회원으로 승인</option>
            <option value="INSTRUCTOR">강사로 승인</option>
          </select>
          {role === "MEMBER" && (
            <select
              className="input w-auto py-1.5 text-xs"
              value={instructorId}
              onChange={(e) => setInstructorId(e.target.value)}
            >
              <option value="">담당 강사 선택(선택사항)</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} 강사
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="btn-primary px-4 py-1.5 text-xs"
            disabled={busy}
            onClick={() =>
              onAct({
                action: "activate",
                role,
                instructorId: role === "MEMBER" ? instructorId || null : null,
              })
            }
          >
            {busy ? "처리 중..." : "✓ 승인"}
          </button>
          {user.viaKakao && linkTargets.length > 0 && (
            <button
              type="button"
              className="text-xs text-stone-400 hover:text-brand-600"
              onClick={() => setLinking(true)}
            >
              기존 계정과 연결
            </button>
          )}
        </div>
      )}
    </div>
  );
}
