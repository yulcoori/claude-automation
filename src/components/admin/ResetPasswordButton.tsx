"use client";

import { useState } from "react";

export default function ResetPasswordButton({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const [busy, setBusy] = useState(false);

  async function reset() {
    const password = prompt(`${name}님의 새 비밀번호를 입력하세요 (4자 이상):`);
    if (!password) return;
    if (password.length < 4) {
      alert("비밀번호는 4자 이상이어야 합니다.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/users/${userId}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) {
      alert(`${name}님의 비밀번호가 재설정되었습니다.\n새 비밀번호를 본인에게 알려주세요.`);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "재설정에 실패했습니다.");
    }
  }

  return (
    <button
      type="button"
      onClick={reset}
      disabled={busy}
      className="text-xs text-stone-400 hover:text-brand-600"
    >
      {busy ? "..." : "비번 재설정"}
    </button>
  );
}
