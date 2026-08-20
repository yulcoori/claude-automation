"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  type ChartContent,
  FITNESS_LEVELS,
  MOVEMENT_ITEMS,
  PLAN_GUIDE,
  PLAN_PHASES,
} from "@/lib/chartTemplate";

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
        <p className="mb-3 text-xs text-stone-400">어떤 기구에서 했는지 체크하고 1회/현재 상태를 기록합니다.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs text-stone-400">
                <th className="w-16 py-2 pr-2 font-semibold">부위</th>
                <th className="py-2 pr-2 font-semibold">동작</th>
                <th className="py-2 pr-2 font-semibold">기구</th>
                <th className="py-2 pr-2 font-semibold">1회</th>
                <th className="py-2 font-semibold">현재</th>
              </tr>
            </thead>
            <tbody>
              {content.movement.map((row, i) => {
                const showGroup = i === 0 || content.movement[i - 1].group !== row.group;
                const note = MOVEMENT_ITEMS[i]?.note;
                return (
                  <tr key={i} className="border-b border-stone-100">
                    <td className="py-1.5 pr-2 text-xs font-bold text-brand-700">
                      {showGroup ? row.group : ""}
                    </td>
                    <td className="py-1.5 pr-2 text-xs font-semibold text-stone-700">
                      {row.name}
                      {note && <span className="ml-1 text-brand-500">{note}</span>}
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        className="input w-24 py-1.5 text-sm"
                        value={row.equipment}
                        onChange={(e) => setMovement(i, "equipment", e.target.value)}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        className="input w-28 py-1.5 text-sm"
                        value={row.start}
                        onChange={(e) => setMovement(i, "start", e.target.value)}
                      />
                    </td>
                    <td className="py-1.5">
                      <input
                        className="input w-28 py-1.5 text-sm"
                        value={row.now}
                        onChange={(e) => setMovement(i, "now", e.target.value)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
        {loading ? "저장 중..." : `${milestone}회차 차트 저장`}
      </button>
    </form>
  );
}
