"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ResetPasswordButton from "./ResetPasswordButton";

interface MemberRow {
  id: string;
  userId: string;
  name: string;
  phone: string;
  program: string | null;
  instructorId: string | null;
  instructorName: string | null;
  current: number;
  total: number;
  charts: number;
}

export default function MemberTable({
  members,
  instructors,
}: {
  members: MemberRow[];
  instructors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function assign(memberId: string, instructorId: string) {
    setBusy(memberId);
    await fetch(`/api/admin/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instructorId: instructorId || null }),
    });
    setBusy(null);
    router.refresh();
  }

  const filtered = members.filter((m) => m.name.includes(query.trim()));

  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-bold text-stone-900">회원 목록</h2>
        <input
          className="input w-40 py-1.5 text-xs sm:w-56"
          placeholder="이름 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-stone-400">등록된 회원이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs text-stone-400">
                <th className="py-2 pr-3 font-semibold">이름</th>
                <th className="py-2 pr-3 font-semibold">연락처</th>
                <th className="py-2 pr-3 font-semibold">프로그램</th>
                <th className="py-2 pr-3 font-semibold">진행</th>
                <th className="py-2 pr-3 font-semibold">담당 강사</th>
                <th className="py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b border-stone-100">
                  <td className="py-2.5 pr-3 font-semibold text-stone-800">{m.name}</td>
                  <td className="py-2.5 pr-3 text-stone-500">{m.phone}</td>
                  <td className="py-2.5 pr-3 text-stone-500">{m.program ?? "-"}</td>
                  <td className="py-2.5 pr-3 text-stone-500">
                    {m.current}/{m.total}회
                  </td>
                  <td className="py-2.5 pr-3">
                    <select
                      className="input w-auto py-1 text-xs"
                      value={m.instructorId ?? ""}
                      disabled={busy === m.id}
                      onChange={(e) => assign(m.id, e.target.value)}
                    >
                      <option value="">미배정</option>
                      {instructors.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <ResetPasswordButton userId={m.userId} name={m.name} />
                      <Link href={`/members/${m.id}`} className="text-xs font-semibold text-brand-600 hover:underline">
                        상세 →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
