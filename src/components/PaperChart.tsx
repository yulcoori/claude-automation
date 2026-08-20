"use client";

import { useState } from "react";
import {
  type ChartContent,
  type ChartMediaRef,
  BODY_VIEWS,
  FITNESS_LEVELS,
  MOVEMENT_ITEMS,
  PLAN_GUIDE,
  PLAN_LINE_COUNT,
  PLAN_PHASES,
} from "@/lib/chartTemplate";
import { BodyFigure, BODY_MARK_TYPES_PUBLIC } from "@/components/BodyDiagram";

const APP_NAME = "MOMO PILATES";

// 움직임 평가를 부위별로 묶기
const MOVEMENT_GROUPS = MOVEMENT_ITEMS.reduce<{ group: string; rows: number[] }[]>(
  (acc, item, idx) => {
    const last = acc[acc.length - 1];
    if (last && last.group === item.group) last.rows.push(idx);
    else acc.push({ group: item.group, rows: [idx] });
    return acc;
  },
  []
);

const PAIN_ROWS = ["목", "어깨", "허리", "골반", ""] as const;

// 회차별로 어떤 계획 칸을 쓰는지 (10→단기, 20→중기, 30→장기)
const PHASE_MILESTONE: Record<string, number> = {
  planShort: 10,
  planMid: 20,
  planLong: 30,
};

interface Stage {
  milestone: number;
  content: ChartContent;
}

interface Props {
  memberName: string;
  instructorName: string;
  milestone: number;
  content: ChartContent;
  editable?: boolean;
  onChange?: (c: ChartContent) => void;
  pendingMedia?: Record<string, File[]>;
  onAddMedia?: (key: string, files: File[]) => void;
  onRemovePendingMedia?: (key: string, idx: number) => void;
  timeline?: Stage[];
  /** 이전 회차에서 이어받은 칸을 잠글지 (20·30회차 작성 시) */
  carriedOver?: boolean;
  footer?: React.ReactNode;
}

export default function PaperChart({
  memberName,
  instructorName,
  milestone,
  content,
  editable = false,
  onChange,
  pendingMedia = {},
  onAddMedia,
  onRemovePendingMedia,
  timeline,
  carriedOver = false,
  footer,
}: Props) {
  const [markType, setMarkType] = useState<"pain" | "tight" | "improved">("pain");

  // 이전 회차 값을 이어받아 잠그는 칸: 첫 차트(10회차)가 아니면 "1회" 열은 고정
  const lockFirstVisit = editable && carriedOver;

  function set<K extends keyof ChartContent>(key: K, value: ChartContent[K]) {
    onChange?.({ ...content, [key]: value });
  }
  function setPain(i: number, key: "area" | "pattern" | "vasStart" | "vasNow", value: string) {
    onChange?.({
      ...content,
      pain: content.pain.map((row, idx) => (idx === i ? { ...row, [key]: value } : row)),
    });
  }
  function setMovement(i: number, key: "equipment" | "start" | "now", value: string) {
    onChange?.({
      ...content,
      movement: content.movement.map((row, idx) =>
        idx === i ? { ...row, [key]: value } : row
      ),
    });
  }
  function removeMedia(i: number, field: "startMedia" | "nowMedia", idx: number) {
    onChange?.({
      ...content,
      movement: content.movement.map((r, j) =>
        j === i ? { ...r, [field]: r[field].filter((_, k) => k !== idx) } : r
      ),
    });
  }
  function setPlanLine(phase: "planShort" | "planMid" | "planLong", i: number, value: string) {
    const lines = [...content[phase]];
    lines[i] = value;
    onChange?.({ ...content, [phase]: lines });
  }

  const stages = timeline ?? [{ milestone, content }];

  return (
    <div className="paper-scroll">
      <div className="paper mx-auto">
        {/* ── 머리글 ── */}
        <div className="p-title border-b border-stone-200">
          <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-brand-600">
            {APP_NAME}
          </div>
          <h2 className="mt-1 text-[22px] font-bold tracking-tight text-stone-900">
            체형 분석 차트
          </h2>
          <div className="mt-1 text-[12px] text-stone-400">
            {milestone}회차
            {timeline && timeline.length > 1 && (
              <span> · {timeline.map((t) => `${t.milestone}회`).join(" · ")} 누적</span>
            )}
          </div>
        </div>

        {/* ── 기본 정보 ── */}
        <table>
          <tbody>
            <tr>
              <td className="w-[15%]">
                <span className="mr-1 text-[11px] font-bold text-stone-400">작성 월</span>
                <Field
                  editable={editable}
                  value={content.month}
                  onChange={(v) => set("month", v)}
                  className="inline-block w-16 text-center"
                  placeholder="8월"
                />
              </td>
              <td className="w-[22%]">
                <span className="mr-1 text-[11px] font-bold text-stone-400">회원명</span>
                <span className="font-semibold text-stone-900">{memberName}</span>
              </td>
              <td className="w-[33%]">
                <span className="mr-1 text-[11px] font-bold text-stone-400">프로그램</span>
                <Field
                  editable={editable}
                  value={content.program}
                  onChange={(v) => set("program", v)}
                  className="inline-block w-[62%]"
                  placeholder="예: 1:1 리포머"
                />
              </td>
              <td>
                <span className="mr-1 text-[11px] font-bold text-stone-400">강사명</span>
                <span className="font-semibold text-stone-900">{instructorName} T</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── 횟수 / 체력상태 / 목표 / 달성도 ── */}
        <table>
          <tbody>
            <tr>
              <td className="p-label w-[19%]">전체 / 사용 / 리뉴 횟수</td>
              <td className="w-[31%]">
                <div className="flex items-center justify-center gap-1.5">
                  <Field
                    editable={editable}
                    value={content.totalCount}
                    onChange={(v) => set("totalCount", v)}
                    className="w-16 text-center"
                    placeholder="30"
                  />
                  <span className="text-stone-300">/</span>
                  <Field
                    editable={editable}
                    value={content.usedCount}
                    onChange={(v) => set("usedCount", v)}
                    className="w-16 text-center"
                    placeholder="10"
                  />
                  <span className="text-stone-300">/</span>
                  <Field
                    editable={editable}
                    value={content.renewCount}
                    onChange={(v) => set("renewCount", v)}
                    className="w-16 text-center"
                    placeholder="0"
                  />
                </div>
              </td>
              <td className="p-label w-[16%]">체력상태</td>
              <td>
                <div className="flex justify-center gap-1.5">
                  {FITNESS_LEVELS.map((lv) => {
                    const on = content.fitnessLevel === lv;
                    return editable ? (
                      <button
                        key={lv}
                        type="button"
                        onClick={() => set("fitnessLevel", on ? "" : lv)}
                        className={`h-7 w-10 rounded-md text-[13px] font-bold transition ${
                          on
                            ? "bg-brand-600 text-white shadow-sm"
                            : "bg-stone-100 text-stone-400 hover:bg-stone-200"
                        }`}
                      >
                        {lv}
                      </button>
                    ) : (
                      <span
                        key={lv}
                        className={`flex h-7 w-10 items-center justify-center rounded-md text-[13px] font-bold ${
                          on ? "bg-brand-600 text-white" : "bg-stone-50 text-stone-300"
                        }`}
                      >
                        {lv}
                      </span>
                    );
                  })}
                </div>
              </td>
            </tr>
            <tr>
              <td className="p-label">회원님 운동목표</td>
              <td>
                <Field
                  editable={editable}
                  value={content.goal}
                  onChange={(v) => set("goal", v)}
                  multiline
                  rows={2}
                  placeholder="예: 거북목 개선, 코어 강화"
                />
              </td>
              <td className="p-label">방문 목적도 달성</td>
              <td>
                <div className="flex items-center justify-center gap-1.5">
                  <Field
                    editable={editable}
                    value={content.achievement}
                    onChange={(v) => set("achievement", v)}
                    className="w-20 text-center"
                    placeholder="60"
                  />
                  <span className="font-semibold text-stone-500">%</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── 체형 그림 ── */}
        <div className="border-b border-stone-200">
          <div className="flex items-center justify-between border-b border-stone-200 bg-brand-50/70 px-3 py-1.5">
            <span className="text-[12px] font-bold uppercase tracking-wide text-brand-800">
              체형 관찰
            </span>
            {editable && (
              <div className="flex items-center gap-1.5">
                {BODY_MARK_TYPES_PUBLIC.map((t) => (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => setMarkType(t.type)}
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${
                      markType === t.type
                        ? "bg-white shadow-sm ring-1 ring-stone-300"
                        : "text-stone-400 hover:bg-white/60"
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    {t.label}
                  </button>
                ))}
                <span className="ml-1 text-[11px] text-stone-400">
                  그림을 눌러 표시 · 다시 누르면 삭제
                </span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 divide-x divide-stone-200">
            {BODY_VIEWS.map(({ view, label }) => (
              <div key={view} className="px-3 py-2 text-center">
                <div className="mx-auto [&>svg]:mx-auto [&>svg]:max-h-56 [&>svg]:w-auto">
                  <BodyFigure
                    view={view}
                    marks={content.bodyMarks}
                    {...(editable && onChange
                      ? {
                          onAdd: (x: number, y: number) =>
                            onChange({
                              ...content,
                              bodyMarks: [...content.bodyMarks, { view, x, y, type: markType }],
                            }),
                          onRemove: (i: number) =>
                            onChange({
                              ...content,
                              bodyMarks: content.bodyMarks.filter((_, k) => k !== i),
                            }),
                        }
                      : {})}
                  />
                </div>
                <div className="mt-1 text-[11px] font-bold text-stone-400">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 통증척도 / 움직임 평가 / 정적평가 ── */}
        <table>
          <thead>
            <tr>
              <th className="p-head w-[6%]">부위</th>
              <th className="p-head w-[12%]">통증양상</th>
              <th className="p-head w-[6%]">1회</th>
              <th className="p-head w-[8%]">현재</th>
              <th className="p-head w-[6%]">부위</th>
              <th className="p-head w-[15%]">움직임 평가</th>
              <th className="p-head w-[11%]">1회</th>
              <th className="p-head w-[15%]">현재</th>
              <th className="p-head w-[21%]">체형 평가 (정적)</th>
            </tr>
          </thead>
          <tbody>
            {MOVEMENT_ITEMS.map((mv, r) => {
              const painIdx = Math.floor(r / 2);
              const showPain = r % 2 === 0 && painIdx < PAIN_ROWS.length;
              const mRow = content.movement[r];
              const grp = MOVEMENT_GROUPS.find((g) => g.rows[0] === r);
              return (
                <tr key={r}>
                  {showPain && (
                    <>
                      <td className="p-label" rowSpan={2}>
                        {PAIN_ROWS[painIdx] || (
                          <Field
                            editable={editable}
                            value={content.pain[painIdx]?.area ?? ""}
                            onChange={(v) => setPain(painIdx, "area", v)}
                            className="text-center"
                            placeholder="기타"
                          />
                        )}
                      </td>
                      <td rowSpan={2}>
                        <Field
                          editable={editable}
                          value={content.pain[painIdx]?.pattern ?? ""}
                          onChange={(v) => setPain(painIdx, "pattern", v)}
                          placeholder="예: 뻐근함"
                        />
                      </td>
                      <td rowSpan={2}>
                        <Field
                          editable={editable}
                          locked={lockFirstVisit}
                          value={content.pain[painIdx]?.vasStart ?? ""}
                          onChange={(v) => setPain(painIdx, "vasStart", v)}
                          className="text-center"
                          placeholder="0~10"
                        />
                      </td>
                      <td rowSpan={2}>
                        {editable ? (
                          <Field
                            editable
                            value={content.pain[painIdx]?.vasNow ?? ""}
                            onChange={(v) => setPain(painIdx, "vasNow", v)}
                            className="text-center"
                            placeholder="0~10"
                          />
                        ) : (
                          <VasStages painIdx={painIdx} stages={stages} />
                        )}
                      </td>
                    </>
                  )}

                  {grp && (
                    <td className="p-label" rowSpan={grp.rows.length}>
                      {grp.group}
                    </td>
                  )}
                  <td>
                    <div className="text-[12px] font-semibold leading-tight text-stone-800">
                      {mv.name}
                      {mv.note && <span className="ml-1 text-brand-600">{mv.note}</span>}
                    </div>
                    <div className="mt-1">
                      <Field
                        editable={editable}
                        value={mRow?.equipment ?? ""}
                        onChange={(v) => setMovement(r, "equipment", v)}
                        placeholder="기구"
                        className="text-[11px]"
                      />
                    </div>
                  </td>
                  <td>
                    <Field
                      editable={editable}
                      locked={lockFirstVisit}
                      value={mRow?.start ?? ""}
                      onChange={(v) => setMovement(r, "start", v)}
                      className="text-center"
                    />
                    <MediaSlot
                      editable={editable && !lockFirstVisit}
                      media={mRow?.startMedia ?? []}
                      pending={pendingMedia[`${r}-start`] ?? []}
                      onAdd={(f) => onAddMedia?.(`${r}-start`, f)}
                      onRemoveExisting={(i) => removeMedia(r, "startMedia", i)}
                      onRemovePending={(i) => onRemovePendingMedia?.(`${r}-start`, i)}
                    />
                  </td>
                  <td>
                    {editable ? (
                      <>
                        <Field
                          editable
                          value={mRow?.now ?? ""}
                          onChange={(v) => setMovement(r, "now", v)}
                          className="text-center"
                        />
                        <MediaSlot
                          editable
                          media={mRow?.nowMedia ?? []}
                          pending={pendingMedia[`${r}-now`] ?? []}
                          onAdd={(f) => onAddMedia?.(`${r}-now`, f)}
                          onRemoveExisting={(i) => removeMedia(r, "nowMedia", i)}
                          onRemovePending={(i) => onRemovePendingMedia?.(`${r}-now`, i)}
                        />
                      </>
                    ) : (
                      <MovementStages rowIdx={r} stages={stages} />
                    )}
                  </td>

                  {r === 0 && (
                    <td className="align-top" rowSpan={MOVEMENT_ITEMS.length}>
                      {editable ? (
                        <Field
                          editable
                          value={content.posture}
                          onChange={(v) => set("posture", v)}
                          multiline
                          rows={13}
                          placeholder="예: 우측 어깨 거상, 골반 전방경사, 흉추 후만 증가"
                        />
                      ) : (
                        <div className="space-y-2">
                          {stages.map((s) =>
                            s.content.posture.trim() ? (
                              <div key={s.milestone}>
                                <div className="text-[11px] font-bold text-brand-600">
                                  {s.milestone}회차
                                </div>
                                <p className="whitespace-pre-wrap text-[12px] leading-5">
                                  {s.content.posture}
                                </p>
                              </div>
                            ) : null
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ── 운동 계획 ── */}
        <table>
          <thead>
            <tr>
              {PLAN_PHASES.map((p) => {
                const locked = editable && carriedOver && PHASE_MILESTONE[p.key] < milestone;
                const isNow = PHASE_MILESTONE[p.key] === milestone;
                return (
                  <th
                    key={p.key}
                    className={`p-head w-1/3 ${isNow ? "bg-brand-100 text-brand-900" : ""}`}
                  >
                    {p.label}
                    {locked && <span className="ml-1 font-normal">· 이전 회차</span>}
                    {isNow && editable && <span className="ml-1 font-normal">· 이번에 작성</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={3}>
                <div className="mb-1 text-[11px] font-bold text-brand-700">
                  개선된 점 · 앞으로 중점적으로 들어갈 운동
                </div>
                {editable ? (
                  <Field
                    editable
                    value={content.improvements}
                    onChange={(v) => set("improvements", v)}
                    multiline
                    rows={2}
                  />
                ) : (
                  <div className="space-y-1">
                    {stages.map((s) =>
                      s.content.improvements.trim() ? (
                        <p key={s.milestone} className="text-[12px] leading-5">
                          <span className="mr-1 font-bold text-brand-600">
                            {s.milestone}회차
                          </span>
                          {s.content.improvements}
                        </p>
                      ) : null
                    )}
                  </div>
                )}
              </td>
            </tr>
            <tr>
              {PLAN_PHASES.map((p) => (
                <td key={p.key} className="bg-stone-50/60 text-center text-[10px] text-stone-400">
                  {PLAN_GUIDE}
                </td>
              ))}
            </tr>
            {Array.from({ length: PLAN_LINE_COUNT }).map((_, i) => (
              <tr key={i}>
                {PLAN_PHASES.map((p) => {
                  const locked = editable && carriedOver && PHASE_MILESTONE[p.key] < milestone;
                  return (
                    <td key={p.key}>
                      <div className="flex items-start gap-1.5">
                        <span className="w-3 pt-1 text-right text-[11px] text-stone-300">
                          {i + 1}
                        </span>
                        <div className="flex-1">
                          <Field
                            editable={editable}
                            locked={locked}
                            value={content[p.key][i] ?? ""}
                            onChange={(v) => setPlanLine(p.key, i, v)}
                          />
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {footer}
      </div>
    </div>
  );
}

// ---------- 보조 ----------

function Field({
  editable,
  locked,
  value,
  onChange,
  className = "",
  placeholder,
  multiline,
  rows = 2,
}: {
  editable: boolean;
  locked?: boolean;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}) {
  if (!editable) {
    return <span className={`p-ro ${className}`}>{value || " "}</span>;
  }
  if (locked) {
    return (
      <span className={`p-lock ${className}`} title="이전 회차에서 이어받은 내용입니다">
        {value || " "}
      </span>
    );
  }
  if (multiline) {
    return (
      <textarea
        className={`p-ta ${className}`}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      className={`p-in ${className}`}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function VasStages({ painIdx, stages }: { painIdx: number; stages: Stage[] }) {
  const items = stages
    .map((s) => ({ m: s.milestone, v: s.content.pain[painIdx]?.vasNow ?? "", start: s.content.pain[painIdx]?.vasStart ?? "" }))
    .filter((x) => x.v);
  if (items.length === 0) return <span className="p-ro">&nbsp;</span>;
  return (
    <div className="flex flex-col items-center gap-0.5 py-1">
      {items.map(({ m, v, start }) => {
        const improved = Number(v) < Number(start);
        return (
          <span key={m} className="text-[12px]">
            <span className="mr-1 text-stone-400">{m}회</span>
            <span className={improved ? "font-bold text-emerald-600" : "text-stone-700"}>
              {v}
              {improved && " ↓"}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function MovementStages({ rowIdx, stages }: { rowIdx: number; stages: Stage[] }) {
  const items = stages
    .map((s) => ({ m: s.milestone, row: s.content.movement[rowIdx] }))
    .filter((x) => x.row && (x.row.now || x.row.nowMedia.length > 0));
  if (items.length === 0) return <span className="p-ro">&nbsp;</span>;
  return (
    <div className="space-y-1 py-1">
      {items.map(({ m, row }) => (
        <div key={m} className="text-[12px]">
          <span className="mr-1 text-stone-400">{m}회</span>
          <span className="text-stone-700">{row!.now}</span>
          <MediaSlot editable={false} media={row!.nowMedia} pending={[]} />
        </div>
      ))}
    </div>
  );
}

function MediaSlot({
  editable,
  media,
  pending,
  onAdd,
  onRemoveExisting,
  onRemovePending,
}: {
  editable: boolean;
  media: ChartMediaRef[];
  pending: File[];
  onAdd?: (files: File[]) => void;
  onRemoveExisting?: (idx: number) => void;
  onRemovePending?: (idx: number) => void;
}) {
  const full = media.length + pending.length >= 4;
  if (!editable && media.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
      {media.map((m, i) => (
        <span key={`e${i}`} className="relative inline-block">
          {m.kind === "VIDEO" ? (
            <video
              src={`/api/files/${m.path}`}
              controls
              playsInline
              preload="metadata"
              className="h-12 w-12 rounded-md bg-stone-900 object-cover"
            />
          ) : (
            <a href={`/api/files/${m.path}`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/files/${m.path}`}
                alt=""
                className="h-12 w-12 rounded-md object-cover ring-1 ring-stone-200"
              />
            </a>
          )}
          {editable && (
            <button
              type="button"
              onClick={() => onRemoveExisting?.(i)}
              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-stone-700 text-[9px] text-white"
            >
              ✕
            </button>
          )}
        </span>
      ))}
      {pending.map((f, i) => (
        <span
          key={`p${i}`}
          className="inline-flex items-center gap-0.5 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700"
        >
          {f.type.startsWith("video/") ? "🎬" : "🖼"}
          <button type="button" onClick={() => onRemovePending?.(i)}>
            ✕
          </button>
        </span>
      ))}
      {editable && !full && (
        <label className="cursor-pointer rounded-md border border-dashed border-stone-300 px-1.5 py-0.5 text-[10px] font-semibold text-stone-400 transition hover:border-brand-400 hover:text-brand-600">
          + 사진
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              onAdd?.(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}
