"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type ChartContent } from "@/lib/chartTemplate";
import PaperChart from "@/components/PaperChart";

export default function ChartForm({
  memberId,
  chartId,
  milestone,
  memberName,
  instructorName,
  initial,
  existingPdf,
  carriedOver = false,
}: {
  memberId: string;
  chartId?: string;
  milestone: number;
  memberName: string;
  instructorName: string;
  initial: ChartContent;
  existingPdf?: string | null;
  carriedOver?: boolean;
}) {
  const router = useRouter();
  const [content, setContent] = useState<ChartContent>(initial);
  const [pdf, setPdf] = useState<File | null>(null);
  // 움직임 평가 첨부 (키: "행번호-start" | "행번호-now")
  const [pendingMedia, setPendingMedia] = useState<Record<string, File[]>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function addPendingMedia(key: string, files: File[]) {
    setPendingMedia((p) => ({ ...p, [key]: [...(p[key] ?? []), ...files].slice(0, 4) }));
  }
  function removePendingMedia(key: string, idx: number) {
    setPendingMedia((p) => ({ ...p, [key]: (p[key] ?? []).filter((_, k) => k !== idx) }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData();
    fd.set("memberId", memberId);
    fd.set("milestone", String(milestone));
    fd.set("content", JSON.stringify(content));
    if (pdf) fd.set("pdf", pdf);
    for (const [key, files] of Object.entries(pendingMedia)) {
      for (const f of files) fd.append(`mm-${key}`, f);
    }

    const res = await fetch(chartId ? `/api/charts/${chartId}` : "/api/charts", {
      method: chartId ? "PATCH" : "POST",
      body: fd,
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "저장에 실패했습니다.");
      return;
    }
    const data = await res.json();
    router.push(`/members/${memberId}/charts/${data.id ?? chartId}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-xs text-stone-400 sm:hidden">
        ← 좌우로 밀어서 차트 전체를 볼 수 있어요. 가로로 돌리면 더 편합니다.
      </p>

      <PaperChart
        memberName={memberName}
        instructorName={instructorName}
        milestone={milestone}
        content={content}
        editable
        onChange={setContent}
        pendingMedia={pendingMedia}
        onAddMedia={addPendingMedia}
        onRemovePendingMedia={removePendingMedia}
        carriedOver={carriedOver}
      />

      {/* 종이/시트 차트 원본 첨부 */}
      <section className="card">
        <h2 className="mb-1 font-bold text-stone-900">차트 원본 파일 첨부 (선택)</h2>
        <p className="mb-3 text-xs text-stone-400">
          종이나 구글시트로 작성한 차트가 따로 있다면 PDF·사진으로 함께 보관할 수 있습니다.
        </p>
        {existingPdf && !pdf && (
          <p className="mb-2 text-sm text-stone-500">
            현재 첨부됨:{" "}
            <a
              href={`/api/files/${existingPdf}`}
              target="_blank"
              className="text-brand-600 underline"
            >
              파일 보기
            </a>
          </p>
        )}
        <input
          type="file"
          accept="application/pdf,image/*"
          className="input text-xs"
          onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
        />
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary w-full py-3.5">
        {loading ? "저장 중... (영상 첨부 시 시간이 걸릴 수 있어요)" : `${milestone}회차 차트 저장`}
      </button>
    </form>
  );
}
