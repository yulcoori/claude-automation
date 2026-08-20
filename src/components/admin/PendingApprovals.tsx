"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format";

interface PendingUser {
  id: string;
  name: string;
  createdAt: string;
}

export default function PendingApprovals({
  pendingUsers,
  orphanUsers,
  instructors,
  linkTargets,
}: {
  pendingUsers: PendingUser[];
  orphanUsers: { id: string; name: string }[]; // 승인됐지만 회원 프로필이 없는 계정
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

  const allPending = [
    ...pendingUsers.map((u) => ({ ...u, pending: true })),
    ...orphanUsers.map((u) => ({ ...u, createdAt: "", pending: false })),
  ];

  return (
    <section className="card border-amber-200 bg-amber-50/50">
      <h2 className="mb-1 font-bold text-stone-900">🔔 승인 대기</h2>
      <p className="mb-3 text-xs text-stone-500">
        카카오로 가입한 계정입니다. 어떤 회원/강사인지 확인 후 역할을 지정해 주세요.
      </p>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="space-y-2">
        {allPending.map((u) => (
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
  user: { id: string; name: string; createdAt: string; pending: boolean };
  instructors: { id: string; name: string }[];
  linkTargets: { id: string; name: string; phone: string }[];
  busy: boolean;
  onAct: (body: Record<string, unknown>) => void;
}) {
  const [mode, setMode] = useState<"member" | "instructor" | "link">("member");
  const [instructorId, setInstructorId] = useState("");
  const [linkTargetId, setLinkTargetId] = useState("");

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <span className="font-semibold text-stone-800">{user.name}</span>
          {user.createdAt && (
            <span className="ml-2 text-xs text-stone-400">{formatDateTime(user.createdAt)} 가입</span>
          )}
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
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="input w-auto py-1.5 text-xs"
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
        >
          <option value="member">신규 회원으로 승인</option>
          <option value="instructor">강사로 승인</option>
          {linkTargets.length > 0 && <option value="link">기존 회원 계정과 연결</option>}
        </select>
        {mode === "member" && (
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
        {mode === "link" && (
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
        )}
        <button
          type="button"
          className="btn-primary px-3 py-1.5 text-xs"
          disabled={busy || (mode === "link" && !linkTargetId)}
          onClick={() => {
            if (mode === "link") onAct({ action: "link", targetUserId: linkTargetId });
            else if (mode === "instructor") onAct({ action: "activate", role: "INSTRUCTOR" });
            else onAct({ action: "activate", role: "MEMBER", instructorId: instructorId || null });
          }}
        >
          {busy ? "처리 중..." : "확인"}
        </button>
      </div>
    </div>
  );
}
