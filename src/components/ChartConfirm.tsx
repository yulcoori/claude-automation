"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format";

export default function ChartConfirm({
  chartId,
  isMember,
  memberName,
  confirmedAt,
  feedback,
}: {
  chartId: string;
  isMember: boolean; // 회원 본인인지
  memberName: string;
  confirmedAt: string | null;
  feedback: string | null;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(Boolean(confirmedAt));
  const [text, setText] = useState(feedback ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(nextChecked: boolean, nextText: string) {
    setSaving(true);
    setSaved(false);
    const res = await fetch(`/api/charts/${chartId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: nextChecked, feedback: nextText }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  // 강사·관리자가 보는 화면 (읽기 전용)
  if (!isMember) {
    return (
      <div className="border-t border-stone-200 bg-stone-50/60 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-bold text-stone-500">회원 확인</span>
          {confirmedAt ? (
            <span className="badge bg-emerald-100 text-emerald-700">
              ✓ {memberName} 회원님 확인 · {formatDateTime(confirmedAt)}
            </span>
          ) : (
            <span className="badge bg-stone-200 text-stone-500">아직 확인 전</span>
          )}
        </div>
        {feedback && (
          <div className="mt-2 rounded-lg bg-white px-3 py-2 ring-1 ring-stone-200">
            <div className="text-[11px] font-bold text-brand-600">회원 피드백</div>
            <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-5 text-stone-700">
              {feedback}
            </p>
          </div>
        )}
      </div>
    );
  }

  // 회원 본인이 보는 화면
  return (
    <div className="border-t border-stone-200 bg-brand-50/40 px-4 py-3">
      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={checked}
          disabled={saving}
          onChange={(e) => {
            setChecked(e.target.checked);
            submit(e.target.checked, text);
          }}
          className="h-5 w-5 shrink-0 accent-brand-600"
        />
        <span className="text-[14px] font-bold text-stone-800">
          차트를 확인했습니다
          {confirmedAt && (
            <span className="ml-2 text-[11px] font-normal text-emerald-600">
              ✓ {formatDateTime(confirmedAt)}
            </span>
          )}
        </span>
      </label>

      <div className="mt-2.5">
        <div className="mb-1 text-[12px] font-semibold text-stone-500">
          강사님께 남기는 피드백 (선택)
        </div>
        <textarea
          className="input text-sm"
          rows={2}
          placeholder="궁금한 점이나 느낀 점을 자유롭게 남겨주세요."
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSaved(false);
          }}
        />
        <div className="mt-1.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => submit(checked, text)}
            disabled={saving}
            className="btn-primary px-4 py-1.5 text-xs"
          >
            {saving ? "저장 중..." : "피드백 저장"}
          </button>
          {saved && <span className="text-xs font-semibold text-emerald-600">저장되었습니다</span>}
        </div>
      </div>
    </div>
  );
}
