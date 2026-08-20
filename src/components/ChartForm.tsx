"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  type ChartContent,
  type ChartMediaRef,
  FITNESS_LEVELS,
  MOVEMENT_ITEMS,
  PLAN_GUIDE,
  PLAN_PHASES,
} from "@/lib/chartTemplate";
import { BodyMarkEditor } from "@/components/BodyDiagram";

export default function ChartForm({
  memberId,
  chartId,
  milestone,
  memberName,
  instructorName,
  initial,
  existingPdf,
}: {
  memberId: string;
  chartId?: string; // 수정 모드일 때
  milestone: number;
  memberName: string;
  instructorName: string;
  initial: ChartContent;
  existingPdf?: string | null;
}) {
  const router = useRouter();
  const [content, setContent] = useState<ChartContent>(initial);
  const [pdf, setPdf] = useState<File | null>(null);
  // 움직임 평가에 새로 첨부할 사진/영상 (키: "행번호-start" | "행번호-now")
  const [pendingMedia, setPendingMedia] = useState<Record<string, File[]>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set<K extends keyof ChartContent>(key: K, value: ChartContent[K]) {
    setContent((c) => ({ ...c, [key]: value }));
  }

  function setPain(i: number, key: "area" | "pattern" | "vasStart" | "vasNow", value: string) {
    setContent((c) => {
      const pain = c.pain.map((row, idx) => (idx === i ? { ...row, [key]: value } : row));
      return { ...c, pain };
    });
  }

  function setMovement(i: number, key: "equipment" | "start" | "now", value: string) {
    setContent((c) => {
      const movement = c.movement.map((row, idx) => (idx === i ? { ...row, [key]: value } : row));
      return { ...c, movement };
    });
  }

  function addPendingMedia(key: string, files: File[]) {
    setPendingMedia((p) => ({ ...p, [key]: [...(p[key] ?? []), ...files].slice(0, 4) }));
  }

  function removePendingMedia(key: string, idx: number) {
    setPendingMedia((p) => ({ ...p, [key]: (p[key] ?? []).filter((_, k) => k !== idx) }));
  }

  function removeExistingMedia(i: number, field: "startMedia" | "nowMedia", idx: number) {
    setContent((c) => ({
      ...c,
      movement: c.movement.map((r, j) =>
        j === i ? { ...r, [field]: r[field].filter((_, k) => k !== idx) } : r
      ),
    }));
  }

  function setPlanLine(phase: "planShort" | "planMid" | "planLong", i: number, value: string) {
    setContent((c) => {
      const lines = [...c[phase]];
      lines[i] = value;
      return { ...c, [phase]: lines };
    });
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
    // 움직임 평가 첨부 파일
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
    <form onSubmit={submit} className="space-y-5">
      {/* 기본 정보 */}
      <section className="card space-y-3">
        <h2 className="font-bold text-stone-900">기본 정보</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="label">작성 월</label>
            <input
              className="input"
              placeholder="예: 8월"
              value={content.month}
              onChange={(e) => set("month", e.target.value)}
            />
          </div>
          <div>
            <label className="label">회원명</label>
            <input className="input bg-stone-50" value={memberName} readOnly />
          </div>
          <div>
            <label className="label">프로그램</label>
            <input
              className="input"
              placeholder="예: 1:1 리포머"
              value={content.program}
              onChange={(e) => set("program", e.target.value)}
            />
          </div>
          <div>
            <label className="label">강사명</label>
            <input className="input bg-stone-50" value={`${instructorName} T`} readOnly />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">전체횟수</label>
            <input
              className="input"
              value={content.totalCount}
              onChange={(e) => set("totalCount", e.target.value)}
            />
          </div>
          <div>
            <label className="label">사용횟수</label>
            <input
              className="input"
              value={content.usedCount}
              onChange={(e) => set("usedCount", e.target.value)}
            />
          </div>
          <div>
            <label className="label">리뉴횟수</label>
            <input
              className="input"
              value={content.renewCount}
              onChange={(e) => set("renewCount", e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">체력상태</label>
            <div className="flex gap-2">
              {FITNESS_LEVELS.map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => set("fitnessLevel", lv)}
                  className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition ${
                    content.fitnessLevel === lv
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-stone-200 text-stone-400"
                  }`}
                >
                  {lv}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">방문 목적도 달성(%)</label>
            <input
              type="number"
              min={0}
              max={100}
              className="input"
              placeholder="0~100"
              value={content.achievement}
              onChange={(e) => set("achievement", e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">회원님 운동목표</label>
          <textarea
            className="input"
            rows={2}
            value={content.goal}
            onChange={(e) => set("goal", e.target.value)}
          />
        </div>
      </section>

      {/* 통증척도 */}
      <section className="card">
        <h2 className="mb-1 font-bold text-stone-900">통증척도 (1회~30회)</h2>
        <p className="mb-3 text-xs text-stone-400">
          부위별 통증양상과 VAS(0~10) 점수를 1회차/현재로 기록합니다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs text-stone-400">
                <th className="w-20 py-2 pr-2 font-semibold">부위</th>
                <th className="py-2 pr-2 font-semibold">통증양상</th>
                <th className="w-24 py-2 pr-2 font-semibold">VAS 1회</th>
                <th className="w-24 py-2 font-semibold">VAS 현재</th>
              </tr>
            </thead>
            <tbody>
              {content.pain.map((row, i) => (
                <tr key={i} className="border-b border-stone-100">
                  <td className="py-1.5 pr-2">
                    {i === content.pain.length - 1 ? (
                      <input
                        className="input py-1.5 text-sm"
                        placeholder="기타"
                        value={row.area}
                        onChange={(e) => setPain(i, "area", e.target.value)}
                      />
                    ) : (
                      <span className="font-semibold text-stone-700">{row.area}</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      className="input py-1.5 text-sm"
                      value={row.pattern}
                      onChange={(e) => setPain(i, "pattern", e.target.value)}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      className="input py-1.5 text-sm"
                      placeholder="0~10"
                      value={row.vasStart}
                      onChange={(e) => setPain(i, "vasStart", e.target.value)}
                    />
                  </td>
                  <td className="py-1.5">
                    <input
                      className="input py-1.5 text-sm"
                      placeholder="0~10"
                      value={row.vasNow}
                      onChange={(e) => setPain(i, "vasNow", e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 움직임 평가 */}
      <section className="card">
        <h2 className="mb-1 font-bold text-stone-900">움직임 평가 (1회~30회)</h2>
        <p className="mb-3 text-xs text-stone-400">
          어떤 기구에서 했는지 체크하고 1회/현재 상태를 기록합니다. 각 동작의 사진·영상도 첨부할
          수 있어요.
        </p>
        <div className="space-y-3">
          {content.movement.map((row, i) => {
            const note = MOVEMENT_ITEMS[i]?.note;
            return (
              <div key={i} className="rounded-xl border border-stone-200 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="badge bg-brand-50 text-brand-700">{row.group}</span>
                  <span className="text-sm font-bold text-stone-800">
                    {row.name}
                    {note && <span className="ml-1 font-normal text-brand-500">{note}</span>}
                  </span>
                  <input
                    className="input ml-auto w-28 py-1.5 text-sm"
                    placeholder="기구"
                    value={row.equipment}
                    onChange={(e) => setMovement(i, "equipment", e.target.value)}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <MediaCell
                    label="1회"
                    value={row.start}
                    onChange={(v) => setMovement(i, "start", v)}
                    media={row.startMedia}
                    pending={pendingMedia[`${i}-start`] ?? []}
                    onAdd={(files) => addPendingMedia(`${i}-start`, files)}
                    onRemoveExisting={(idx) => removeExistingMedia(i, "startMedia", idx)}
                    onRemovePending={(idx) => removePendingMedia(`${i}-start`, idx)}
                  />
                  <MediaCell
                    label="현재"
                    value={row.now}
                    onChange={(v) => setMovement(i, "now", v)}
                    media={row.nowMedia}
                    pending={pendingMedia[`${i}-now`] ?? []}
                    onAdd={(files) => addPendingMedia(`${i}-now`, files)}
                    onRemoveExisting={(idx) => removeExistingMedia(i, "nowMedia", idx)}
                    onRemovePending={(idx) => removePendingMedia(`${i}-now`, idx)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 체형 그림 마킹 */}
      <section className="card">
        <h2 className="mb-2 font-bold text-stone-900">체형 그림 마킹</h2>
        <BodyMarkEditor marks={content.bodyMarks} onChange={(marks) => set("bodyMarks", marks)} />
      </section>

      {/* 체형 평가 */}
      <section className="card">
        <h2 className="mb-2 font-bold text-stone-900">체형 평가 내용 (정적평가)</h2>
        <textarea
          className="input"
          rows={4}
          placeholder="예: 우측 어깨 거상, 골반 전방경사, 흉추 후만 증가 등"
          value={content.posture}
          onChange={(e) => set("posture", e.target.value)}
        />
      </section>

      {/* 운동 계획 */}
      <section className="card space-y-4">
        <div>
          <h2 className="font-bold text-stone-900">운동 계획</h2>
          <p className="mt-1 text-xs text-stone-400">{PLAN_GUIDE}</p>
        </div>
        <div>
          <label className="label">*개선된 점과 앞으로 중점적으로 들어갈 운동</label>
          <textarea
            className="input"
            rows={2}
            value={content.improvements}
            onChange={(e) => set("improvements", e.target.value)}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {PLAN_PHASES.map((phase) => (
            <div key={phase.key} className="rounded-xl border border-stone-200 p-3">
              <h3 className="mb-2 text-center text-sm font-bold text-brand-700">{phase.label}</h3>
              <div className="space-y-1.5">
                {content[phase.key].map((line, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="w-4 text-right text-xs text-stone-400">{i + 1}</span>
                    <input
                      className="input py-1.5 text-sm"
                      value={line}
                      onChange={(e) => setPlanLine(phase.key, i, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PDF 첨부 */}
      <section className="card">
        <h2 className="mb-2 font-bold text-stone-900">차트 파일 첨부 (선택)</h2>
        <p className="mb-3 text-xs text-stone-400">
          종이/구글시트로 작성한 차트가 있다면 PDF 또는 사진으로 첨부할 수 있습니다.
        </p>
        {existingPdf && !pdf && (
          <p className="mb-2 text-sm text-stone-500">
            현재 첨부됨:{" "}
            <a href={`/api/files/${existingPdf}`} target="_blank" className="text-brand-600 underline">
              첨부 파일 보기
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

// 움직임 평가의 1회/현재 칸: 텍스트 평가 + 사진/영상 첨부
function MediaCell({
  label,
  value,
  onChange,
  media,
  pending,
  onAdd,
  onRemoveExisting,
  onRemovePending,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  media: ChartMediaRef[];
  pending: File[];
  onAdd: (files: File[]) => void;
  onRemoveExisting: (idx: number) => void;
  onRemovePending: (idx: number) => void;
}) {
  const full = media.length + pending.length >= 4;
  return (
    <div className="rounded-lg bg-stone-50 p-2">
      <div className="mb-1 text-xs font-semibold text-stone-500">{label}</div>
      <input
        className="input py-1.5 text-sm"
        placeholder="평가 내용"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {media.map((m, idx) => (
          <span key={`e-${idx}`} className="relative inline-block">
            {m.kind === "VIDEO" ? (
              <video
                src={`/api/files/${m.path}`}
                className="h-14 w-14 rounded-lg bg-stone-900 object-cover"
                muted
                preload="metadata"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/files/${m.path}`}
                alt=""
                className="h-14 w-14 rounded-lg object-cover"
              />
            )}
            <button
              type="button"
              onClick={() => onRemoveExisting(idx)}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-stone-700 text-[10px] text-white"
              aria-label="첨부 삭제"
            >
              ✕
            </button>
          </span>
        ))}
        {pending.map((f, idx) => (
          <span
            key={`p-${idx}`}
            className="inline-flex max-w-[9rem] items-center gap-1 rounded-full bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700"
          >
            {f.type.startsWith("video/") ? "🎬" : "🖼"}
            <span className="truncate">{f.name}</span>
            <button type="button" onClick={() => onRemovePending(idx)} aria-label="첨부 취소">
              ✕
            </button>
          </span>
        ))}
        {!full && (
          <label className="cursor-pointer rounded-lg border border-dashed border-stone-300 px-2 py-1 text-[11px] font-semibold text-stone-500 hover:border-brand-400 hover:text-brand-600">
            + 사진/영상
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                onAdd(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
