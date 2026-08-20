"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

const APP_NAME = "모모필라테스";

// 움직임 평가를 종이 차트처럼 부위별로 묶기
const MOVEMENT_GROUPS = MOVEMENT_ITEMS.reduce<{ group: string; rows: number[] }[]>(
  (acc, item, idx) => {
    const last = acc[acc.length - 1];
    if (last && last.group === item.group) last.rows.push(idx);
    else acc.push({ group: item.group, rows: [idx] });
    return acc;
  },
  []
);

// 통증척도는 종이 차트처럼 5행 (목/어깨/허리/골반/기타)
const PAIN_ROW_COUNT = 5;

interface Props {
  memberName: string;
  instructorName: string;
  milestone: number;
  content: ChartContent;
  // 편집 모드
  editable?: boolean;
  onChange?: (c: ChartContent) => void;
  pendingMedia?: Record<string, File[]>;
  onAddMedia?: (key: string, files: File[]) => void;
  onRemovePendingMedia?: (key: string, idx: number) => void;
  // 보기 모드에서 회차별 비교 열
  timeline?: { milestone: number; content: ChartContent }[];
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
}: Props) {
  function set<K extends keyof ChartContent>(key: K, value: ChartContent[K]) {
    onChange?.({ ...content, [key]: value });
  }

  function setPain(i: number, key: "area" | "pattern" | "vasStart" | "vasNow", value: string) {
    const pain = content.pain.map((row, idx) => (idx === i ? { ...row, [key]: value } : row));
    onChange?.({ ...content, pain });
  }

  function setMovement(i: number, key: "equipment" | "start" | "now", value: string) {
    const movement = content.movement.map((row, idx) =>
      idx === i ? { ...row, [key]: value } : row
    );
    onChange?.({ ...content, movement });
  }

  function removeExistingMedia(i: number, field: "startMedia" | "nowMedia", idx: number) {
    const movement = content.movement.map((r, j) =>
      j === i ? { ...r, [field]: r[field].filter((_, k) => k !== idx) } : r
    );
    onChange?.({ ...content, movement });
  }

  function setPlanLine(phase: "planShort" | "planMid" | "planLong", i: number, value: string) {
    const lines = [...content[phase]];
    lines[i] = value;
    onChange?.({ ...content, [phase]: lines });
  }

  // 보기 모드에서 회차별 열
  const stages = timeline ?? [{ milestone, content }];

  return (
    <div className="paper-scroll">
      <div className="paper mx-auto">
        {/* 제목 */}
        <div className="p-title">{APP_NAME} 체형 분석 차트</div>

        {/* 기본 정보 줄 */}
        <table>
          <tbody>
            <tr>
              <td className="w-[13%] text-center">
                (
                <Cell
                  editable={editable}
                  value={content.month}
                  onChange={(v) => set("month", v)}
                  className="inline-block w-14 text-center"
                  placeholder="8"
                />
                월)
              </td>
              <td className="w-[24%]">
                <span className="font-bold">회원명 : </span>
                {memberName}
              </td>
              <td className="w-[30%]">
                <span className="font-bold">프로그램 : </span>
                <Cell
                  editable={editable}
                  value={content.program}
                  onChange={(v) => set("program", v)}
                  className="inline-block w-[60%]"
                />
              </td>
              <td>
                <span className="font-bold">강사명 : </span>
                {instructorName} T
              </td>
            </tr>
          </tbody>
        </table>

        {/* 횟수 / 체력상태 / 목표 / 달성도 */}
        <table>
          <tbody>
            <tr>
              <td className="p-label w-[26%]">전체횟수 / 사용횟수 / 리뉴횟수</td>
              <td className="w-[32%] text-center">
                <Cell
                  editable={editable}
                  value={content.totalCount}
                  onChange={(v) => set("totalCount", v)}
                  className="inline-block w-16 text-center"
                />
                /
                <Cell
                  editable={editable}
                  value={content.usedCount}
                  onChange={(v) => set("usedCount", v)}
                  className="inline-block w-16 text-center"
                />
                /
                <Cell
                  editable={editable}
                  value={content.renewCount}
                  onChange={(v) => set("renewCount", v)}
                  className="inline-block w-16 text-center"
                />
              </td>
              <td className="p-label w-[16%]">체력상태</td>
              <td className="text-center">
                {editable ? (
                  <div className="flex justify-center gap-1">
                    {FITNESS_LEVELS.map((lv) => (
                      <button
                        key={lv}
                        type="button"
                        onClick={() => set("fitnessLevel", content.fitnessLevel === lv ? "" : lv)}
                        className={`h-7 w-9 rounded text-[13px] font-bold transition ${
                          content.fitnessLevel === lv
                            ? "bg-brand-600 text-white"
                            : "text-stone-400 hover:bg-stone-100"
                        }`}
                      >
                        {lv}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span>
                    {FITNESS_LEVELS.map((lv, i) => (
                      <span key={lv}>
                        {i > 0 && " / "}
                        <span
                          className={
                            content.fitnessLevel === lv
                              ? "rounded bg-brand-600 px-1.5 py-0.5 font-bold text-white"
                              : "text-stone-400"
                          }
                        >
                          {lv}
                        </span>
                      </span>
                    ))}
                  </span>
                )}
              </td>
            </tr>
            <tr>
              <td className="p-label">회원님 운동목표</td>
              <td>
                <Cell
                  editable={editable}
                  value={content.goal}
                  onChange={(v) => set("goal", v)}
                  multiline
                />
              </td>
              <td className="p-label">방문 목적도 달성(%)</td>
              <td className="text-center">
                <Cell
                  editable={editable}
                  value={content.achievement}
                  onChange={(v) => set("achievement", v)}
                  className="inline-block w-16 text-center"
                />
                %
              </td>
            </tr>
          </tbody>
        </table>

        {/* 체형 그림 3면 */}
        <table>
          <tbody>
            <tr>
              {BODY_VIEWS.map(({ view, label }) => (
                <td key={view} className="mx-auto p-2 text-center align-top [&>svg]:mx-auto [&>svg]:max-h-64 [&>svg]:w-auto">
                  <BodyFigure
                    view={view}
                    marks={content.bodyMarks}
                    {...(editable && onChange
                      ? {
                          onAdd: (x: number, y: number) =>
                            onChange({
                              ...content,
                              bodyMarks: [
                                ...content.bodyMarks,
                                { view, x, y, type: activeMarkType() },
                              ],
                            }),
                          onRemove: (i: number) =>
                            onChange({
                              ...content,
                              bodyMarks: content.bodyMarks.filter((_, k) => k !== i),
                            }),
                        }
                      : {})}
                  />
                  <div className="mt-1 text-xs font-bold text-stone-500">{label}</div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        {editable && <MarkTypePicker />}

        {/* 통증척도 / 움직임 평가 / 체형 평가 */}
        <table>
          <thead>
            <tr>
              <th className="p-head" colSpan={2}>
                통증척도
              </th>
              <th className="p-head w-[7%]">1회</th>
              <th className="p-head w-[7%]">현재</th>
              <th className="p-head" colSpan={2}>
                움직임 평가 <span className="font-normal">(*기구 체크)</span>
              </th>
              <th className="p-head w-[7%]">1회</th>
              <th className="p-head w-[7%]">현재</th>
              <th className="p-head w-[19%]">체형 평가 내용 (정적평가)</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.max(PAIN_ROW_COUNT, MOVEMENT_ITEMS.length) }).map((_, r) => {
              // 통증척도는 5행, 각 행이 움직임 2행씩 차지
              const painIdx = Math.floor(r / 2);
              const showPain = r % 2 === 0 && painIdx < PAIN_ROW_COUNT;
              const mv = MOVEMENT_ITEMS[r];
              const mRow = content.movement[r];
              // 부위 그룹 셀은 그룹 첫 행에서만
              const grp = MOVEMENT_GROUPS.find((g) => g.rows[0] === r);
              return (
                <tr key={r}>
                  {showPain && (
                    <>
                      <td className="p-label w-[6%]" rowSpan={2}>
                        {painIdx < 4 ? (
                          ["목", "어깨", "허리", "골반"][painIdx]
                        ) : (
                          <Cell
                            editable={editable}
                            value={content.pain[painIdx]?.area ?? ""}
                            onChange={(v) => setPain(painIdx, "area", v)}
                            className="text-center"
                            placeholder="기타"
                          />
                        )}
                      </td>
                      <td className="w-[13%]" rowSpan={2}>
                        <Cell
                          editable={editable}
                          value={content.pain[painIdx]?.pattern ?? ""}
                          onChange={(v) => setPain(painIdx, "pattern", v)}
                          placeholder="통증양상"
                        />
                      </td>
                      <td className="text-center" rowSpan={2}>
                        <Cell
                          editable={editable}
                          value={content.pain[painIdx]?.vasStart ?? ""}
                          onChange={(v) => setPain(painIdx, "vasStart", v)}
                          className="text-center"
                        />
                      </td>
                      <td className="text-center" rowSpan={2}>
                        {editable ? (
                          <Cell
                            editable
                            value={content.pain[painIdx]?.vasNow ?? ""}
                            onChange={(v) => setPain(painIdx, "vasNow", v)}
                            className="text-center"
                          />
                        ) : (
                          <VasStages painIdx={painIdx} stages={stages} />
                        )}
                      </td>
                    </>
                  )}

                  {grp && (
                    <td className="p-label w-[6%]" rowSpan={grp.rows.length}>
                      {grp.group}
                    </td>
                  )}
                  <td className="w-[14%] text-[12px] font-semibold">
                    {mv?.name}
                    {mv?.note && <span className="ml-1 text-brand-600">{mv.note}</span>}
                    <div className="mt-0.5">
                      <Cell
                        editable={editable}
                        value={mRow?.equipment ?? ""}
                        onChange={(v) => setMovement(r, "equipment", v)}
                        placeholder="기구"
                        className="text-[11px] text-stone-500"
                      />
                    </div>
                  </td>
                  <td className="text-center">
                    <Cell
                      editable={editable}
                      value={mRow?.start ?? ""}
                      onChange={(v) => setMovement(r, "start", v)}
                      className="text-center"
                    />
                    <MediaSlot
                      editable={editable}
                      media={mRow?.startMedia ?? []}
                      pending={pendingMedia[`${r}-start`] ?? []}
                      onAdd={(f) => onAddMedia?.(`${r}-start`, f)}
                      onRemoveExisting={(i) => removeExistingMedia(r, "startMedia", i)}
                      onRemovePending={(i) => onRemovePendingMedia?.(`${r}-start`, i)}
                    />
                  </td>
                  <td className="text-center">
                    {editable ? (
                      <>
                        <Cell
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
                          onRemoveExisting={(i) => removeExistingMedia(r, "nowMedia", i)}
                          onRemovePending={(i) => onRemovePendingMedia?.(`${r}-now`, i)}
                        />
                      </>
                    ) : (
                      <MovementStages rowIdx={r} stages={stages} />
                    )}
                  </td>

                  {r === 0 && (
                    <td className="align-top" rowSpan={MOVEMENT_ITEMS.length}>
                      <Cell
                        editable={editable}
                        value={content.posture}
                        onChange={(v) => set("posture", v)}
                        multiline
                        rows={14}
                        placeholder="예: 우측 어깨 거상, 골반 전방경사"
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 단기 / 중기 / 장기 */}
        <table>
          <thead>
            <tr>
              {PLAN_PHASES.map((p) => (
                <th key={p.key} className="p-head w-1/3">
                  {p.label}
                </th>
              ))}
            </tr>
            <tr>
              {PLAN_PHASES.map((p) => (
                <th key={p.key} className="bg-brand-50 text-center text-[11px] font-normal">
                  {PLAN_GUIDE}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={3} className="align-top">
                <div className="text-[11px] font-bold text-brand-700">
                  *개선된 점과 앞으로 중점적으로 들어갈 운동
                </div>
                <Cell
                  editable={editable}
                  value={content.improvements}
                  onChange={(v) => set("improvements", v)}
                  multiline
                  rows={2}
                />
              </td>
            </tr>
            {Array.from({ length: PLAN_LINE_COUNT }).map((_, i) => (
              <tr key={i}>
                {PLAN_PHASES.map((p) => (
                  <td key={p.key}>
                    <div className="flex items-start gap-1">
                      <span className="pt-0.5 text-[11px] text-stone-400">{i + 1}</span>
                      <Cell
                        editable={editable}
                        value={content[p.key][i] ?? ""}
                        onChange={(v) => setPlanLine(p.key, i, v)}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              {PLAN_PHASES.map((p) => (
                <td key={p.key} className="h-9 text-right text-[12px] text-stone-500">
                  (인)
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        <div className="px-2 py-1.5 text-right text-[11px] text-stone-500">
          *30회가 되면 카톡으로 전송해주세요^^
        </div>
      </div>
    </div>
  );
}

// ---------- 보조 컴포넌트 ----------

function Cell({
  editable,
  value,
  onChange,
  className = "",
  placeholder,
  multiline,
  rows = 2,
}: {
  editable: boolean;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}) {
  if (!editable) {
    return (
      <span className={`block whitespace-pre-wrap px-1 text-[13px] ${className}`}>
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

// 보기 모드: 통증 VAS를 회차별로
function VasStages({
  painIdx,
  stages,
}: {
  painIdx: number;
  stages: { milestone: number; content: ChartContent }[];
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-[12px]">
      {stages.map((s) => {
        const v = s.content.pain[painIdx]?.vasNow ?? "";
        if (!v) return null;
        const start = Number(s.content.pain[painIdx]?.vasStart);
        const now = Number(v);
        const improved = !Number.isNaN(start) && !Number.isNaN(now) && now < start;
        return (
          <span key={s.milestone} className={improved ? "font-bold text-emerald-600" : ""}>
            <span className="text-stone-400">{s.milestone}회</span> {v}
            {improved && " ↓"}
          </span>
        );
      })}
    </div>
  );
}

// 보기 모드: 움직임 평가를 회차별로 (사진/영상 포함)
function MovementStages({
  rowIdx,
  stages,
}: {
  rowIdx: number;
  stages: { milestone: number; content: ChartContent }[];
}) {
  return (
    <div className="space-y-1">
      {stages.map((s) => {
        const row = s.content.movement[rowIdx];
        if (!row || (!row.now && row.nowMedia.length === 0)) return null;
        return (
          <div key={s.milestone} className="text-[12px]">
            <span className="text-stone-400">{s.milestone}회</span> {row.now}
            <MediaSlot editable={false} media={row.nowMedia} pending={[]} />
          </div>
        );
      })}
    </div>
  );
}

// 사진/영상 첨부 칸
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
    <div className="mt-0.5 flex flex-wrap items-center justify-center gap-1">
      {media.map((m, i) =>
        m.kind === "VIDEO" ? (
          <span key={`e${i}`} className="relative inline-block">
            <video
              src={`/api/files/${m.path}`}
              controls
              playsInline
              preload="metadata"
              className="h-12 w-12 rounded bg-stone-900 object-cover"
            />
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
        ) : (
          <span key={`e${i}`} className="relative inline-block">
            <a href={`/api/files/${m.path}`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/files/${m.path}`} alt="" className="h-12 w-12 rounded object-cover" />
            </a>
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
        )
      )}
      {pending.map((f, i) => (
        <span
          key={`p${i}`}
          className="inline-flex items-center gap-0.5 rounded bg-brand-50 px-1 py-0.5 text-[10px] font-semibold text-brand-700"
        >
          {f.type.startsWith("video/") ? "🎬" : "🖼"}
          <button type="button" onClick={() => onRemovePending?.(i)}>
            ✕
          </button>
        </span>
      ))}
      {editable && !full && (
        <label className="cursor-pointer rounded border border-dashed border-stone-300 px-1 text-[10px] text-stone-400 hover:border-brand-400 hover:text-brand-600">
          +📷
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

// 체형 그림 마킹 색상 선택 (모듈 전역 상태로 단순 관리)
let currentMarkType: "pain" | "tight" | "improved" = "pain";
function activeMarkType() {
  return currentMarkType;
}

function MarkTypePicker() {
  const [, force] = useState(0);
  return (
    <div className="flex items-center justify-center gap-2 border-b border-stone-500 bg-stone-50 py-1.5">
      <span className="text-[11px] font-bold text-stone-500">그림 표시:</span>
      {BODY_MARK_TYPES_PUBLIC.map((t) => (
        <button
          key={t.type}
          type="button"
          onClick={() => {
            currentMarkType = t.type;
            force((n) => n + 1);
          }}
          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
            currentMarkType === t.type
              ? "border-stone-400 bg-white"
              : "border-transparent text-stone-400"
          }`}
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
          {t.label}
        </button>
      ))}
      <span className="text-[11px] text-stone-400">
        · 그림을 눌러 표시, 표시를 다시 누르면 삭제
      </span>
    </div>
  );
}

// 미사용 경고 방지
void useRouter;
