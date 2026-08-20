"use client";

import { useState } from "react";

export default function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next.length < 4) {
      setMsg({ ok: false, text: "새 비밀번호는 4자 이상이어야 합니다." });
      return;
    }
    if (next !== confirm) {
      setMsg({ ok: false, text: "새 비밀번호가 서로 일치하지 않습니다." });
      return;
    }
    setLoading(true);
    const res = await fetch("/api/settings/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg({ ok: false, text: data.error ?? "변경에 실패했습니다." });
      return;
    }
    setMsg({ ok: true, text: "비밀번호가 변경되었습니다." });
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {hasPassword && (
        <div>
          <label className="label">현재 비밀번호</label>
          <input
            type="password"
            className="input"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">새 비밀번호</label>
          <input
            type="password"
            className="input"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={4}
          />
        </div>
        <div>
          <label className="label">새 비밀번호 확인</label>
          <input
            type="password"
            className="input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
      </div>
      {msg && (
        <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>
      )}
      <button type="submit" disabled={loading} className="btn-primary w-full py-3">
        {loading ? "변경 중..." : "비밀번호 변경"}
      </button>
    </form>
  );
}
