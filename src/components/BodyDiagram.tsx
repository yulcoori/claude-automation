"use client";

import { useState } from "react";
import {
  BODY_MARK_TYPES,
  BODY_VIEWS,
  type BodyMark,
  type BodyMarkType,
  type BodyView,
} from "@/lib/chartTemplate";

const MARK_COLOR: Record<BodyMarkType, string> = Object.fromEntries(
  BODY_MARK_TYPES.map((t) => [t.type, t.color])
) as Record<BodyMarkType, string>;

// 종이 차트에서 쓰는 색상 목록
export const BODY_MARK_TYPES_PUBLIC = BODY_MARK_TYPES;

const VIEW_W = 100;
const VIEW_H = 220;

// 신체 도식 (정면/후면은 동일 실루엣, 좌우 라벨만 반대)
function BodyShape({ view }: { view: BodyView }) {
  const s = {
    fill: "#f5f5f4",
    stroke: "#a8a29e",
    strokeWidth: 1.5,
  } as const;

  if (view === "side") {
    return (
      <g {...s}>
        <circle cx="52" cy="16" r="10" />
        <rect x="46" y="26" width="9" height="8" rx="3" />
        <path d="M43 33 Q60 30 61 42 L60 70 Q62 84 57 100 L44 100 Q40 82 42 64 Z" />
        <rect x="45" y="36" width="9" height="52" rx="4.5" />
        <path d="M44 100 L57 100 Q59 130 55 160 L54 196 L59 202 L47 202 L48 165 L50 130 L47 165 L46 202 L38 202 L42 196 L42 160 Q41 128 44 100 Z" />
      </g>
    );
  }

  const left = view === "front" ? "R" : "L";
  const right = view === "front" ? "L" : "R";
  return (
    <g {...s}>
      <circle cx="50" cy="16" r="10" />
      <rect x="46" y="26" width="8" height="8" rx="3" />
      {/* 몸통 */}
      <path d="M31 34 Q50 30 69 34 L67 62 Q64 74 66 84 L68 100 L32 100 L34 84 Q36 74 33 62 Z" />
      {/* 팔 */}
      <path d="M31 34 Q24 36 23 44 L20 86 Q20 92 25 91 L29 52 Z" />
      <path d="M69 34 Q76 36 77 44 L80 86 Q80 92 75 91 L71 52 Z" />
      {/* 다리 */}
      <path d="M32 100 L48 100 L47 140 L46 196 L50 202 L38 202 L39 160 L36 130 Z" />
      <path d="M68 100 L52 100 L53 140 L54 196 L50 202 L62 202 L61 160 L64 130 Z" />
      <text x="12" y="14" fontSize="9" fill="#78716c" stroke="none" fontWeight="bold">
        {left}
      </text>
      <text x="82" y="14" fontSize="9" fill="#78716c" stroke="none" fontWeight="bold">
        {right}
      </text>
    </g>
  );
}

export function BodyFigure({
  view,
  marks,
  onAdd,
  onRemove,
}: {
  view: BodyView;
  marks: BodyMark[];
  onAdd?: (x: number, y: number) => void;
  onRemove?: (index: number) => void; // marks 배열 기준 인덱스
}) {
  const editable = Boolean(onAdd);

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!onAdd) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const y = ((e.clientY - rect.top) / rect.height) * VIEW_H;

    // 기존 표시 근처를 누르면 삭제
    if (onRemove) {
      for (let i = 0; i < marks.length; i++) {
        const m = marks[i];
        if (m.view === view && Math.hypot(m.x - x, m.y - y) < 7) {
          onRemove(i);
          return;
        }
      }
    }
    onAdd(x, y);
  }

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className={`w-full rounded-xl border border-stone-200 bg-white ${
        editable ? "cursor-crosshair touch-manipulation" : ""
      }`}
      onClick={editable ? handleClick : undefined}
      role={editable ? "button" : "img"}
    >
      <BodyShape view={view} />
      {marks
        .filter((m) => m.view === view)
        .map((m, i) => (
          <g key={i}>
            <circle cx={m.x} cy={m.y} r="4.5" fill={MARK_COLOR[m.type]} opacity="0.85" />
            <circle cx={m.x} cy={m.y} r="4.5" fill="none" stroke="white" strokeWidth="1" />
          </g>
        ))}
    </svg>
  );
}

// 차트 작성용: 마킹 편집기
export function BodyMarkEditor({
  marks,
  onChange,
}: {
  marks: BodyMark[];
  onChange: (marks: BodyMark[]) => void;
}) {
  const [markType, setMarkType] = useState<BodyMarkType>("pain");

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {BODY_MARK_TYPES.map((t) => (
          <button
            key={t.type}
            type="button"
            onClick={() => setMarkType(t.type)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              markType === t.type
                ? "border-stone-400 bg-stone-100 text-stone-800"
                : "border-stone-200 text-stone-400"
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
            {t.label}
          </button>
        ))}
        {marks.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="ml-auto text-xs text-stone-400 hover:text-red-600"
          >
            전체 지우기
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-stone-400">
        그림을 눌러 표시를 추가하고, 이미 있는 표시를 다시 누르면 삭제됩니다.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {BODY_VIEWS.map(({ view, label }) => (
          <figure key={view}>
            <BodyFigure
              view={view}
              marks={marks}
              onAdd={(x, y) => onChange([...marks, { view, x, y, type: markType }])}
              onRemove={(i) => onChange(marks.filter((_, idx) => idx !== i))}
            />
            <figcaption className="mt-1 text-center text-xs font-semibold text-stone-500">
              {label}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

// 차트 보기용: 읽기 전용 + 범례
export function BodyMarkViewer({ marks }: { marks: BodyMark[] }) {
  const usedTypes = BODY_MARK_TYPES.filter((t) => marks.some((m) => m.type === t.type));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3">
        {usedTypes.map((t) => (
          <span key={t.type} className="flex items-center gap-1.5 text-xs font-semibold text-stone-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
            {t.label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {BODY_VIEWS.map(({ view, label }) => (
          <figure key={view}>
            <BodyFigure view={view} marks={marks} />
            <figcaption className="mt-1 text-center text-xs font-semibold text-stone-500">
              {label}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
