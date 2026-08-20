"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";

interface LogItem {
  id: string;
  number: number;
  date: string;
  memo: string | null;
  instructorName: string | null;
}

export default function SessionLogPanel({
  memberId,
  isManager,
  logs,
}: {
  memberId: string;
  isManager: boolean;
  logs: LogItem[];
}) {
  const router = useRouter();
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  async function addLog(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, memo: memo.trim() || null }),
    });
    setLoading(false);
    setMemo("");
    router.refresh();
  }

  async function removeLog(id: string) {
    if (!confirm("이 수업 기록을 삭제할까요?")) return;
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const visible = showAll ? logs : logs.slice(0, 5);

  return (
    <div className="card">
      {isManager && (
        <form onSubmit={addLog} className="mb-4 flex gap-2">
          <input
            className="input flex-1"
            placeholder="오늘 수업 메모 (선택)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
          <button type="submit" disabled={loading} className="btn-primary whitespace-nowrap">
            {loading ? "기록 중..." : "+ 수업 완료"}
          </button>
        </form>
      )}
      {logs.length === 0 ? (
        <p className="py-6 text-center text-sm text-stone-400">아직 수업 기록이 없습니다.</p>
      ) : (
        <>
          <ul className="space-y-2">
            {visible.map((log) => (
              <li key={log.id} className="flex items-start justify-between rounded-xl bg-stone-50 px-3 py-2.5">
                <div className="flex items-start gap-3">
                  <span className="badge mt-0.5 bg-brand-600 text-white">{log.number}회</span>
                  <div className="text-sm">
                    <div className="text-stone-700">
                      {formatDate(log.date)}
                      {log.instructorName && (
                        <span className="ml-2 text-xs text-stone-400">{log.instructorName} 강사</span>
                      )}
                    </div>
                    {log.memo && <p className="mt-0.5 text-xs text-stone-500">{log.memo}</p>}
                  </div>
                </div>
                {isManager && (
                  <button
                    type="button"
                    onClick={() => removeLog(log.id)}
                    className="text-xs text-stone-300 hover:text-red-500"
                  >
                    삭제
                  </button>
                )}
              </li>
            ))}
          </ul>
          {logs.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="mt-3 w-full text-center text-xs font-semibold text-brand-600"
            >
              {showAll ? "접기 ▲" : `전체 ${logs.length}개 보기 ▼`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
