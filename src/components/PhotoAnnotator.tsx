"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================
// 사진 표시(마킹) 편집기
// 체형 비교 사진 위에 기준선·박스·화살표·회전·문구를 그립니다.
// (기존 PPT 스티커 작업을 대체)
// ============================================================

type Tool = "line" | "rect" | "arrow" | "curve" | "text";

interface Shape {
  tool: Tool;
  color: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  text?: string;
}

const TOOLS: { key: Tool; label: string; hint: string }[] = [
  { key: "line", label: "┃ 기준선", hint: "사진을 누르면 세로 기준선이 생깁니다" },
  { key: "rect", label: "▭ 박스", hint: "누른 채로 끌어서 박스를 그립니다" },
  { key: "arrow", label: "→ 화살표", hint: "누른 채로 끌어서 화살표를 그립니다" },
  { key: "curve", label: "↻ 회전", hint: "누른 채로 끌어서 회전 화살표를 그립니다" },
  { key: "text", label: "T 문구", hint: "사진을 누르면 문구를 입력할 수 있습니다" },
];

const COLORS = ["#e11d48", "#eab308", "#2563eb", "#16a34a", "#111827"];

export default function PhotoAnnotator({
  file,
  onDone,
  onCancel,
}: {
  file: File | Blob;
  onDone: (annotated: Blob) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const draftRef = useRef<Shape | null>(null);
  const [tool, setTool] = useState<Tool>("line");
  const [color, setColor] = useState(COLORS[0]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // 사진 불러오기
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (canvas) {
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
      }
      setReady(true);
    };
    img.onerror = () => setLoadError(true);
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const redraw = useCallback(
    (draft?: Shape | null) => {
      const canvas = canvasRef.current;
      const img = imgRef.current;
      if (!canvas || !img) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const s of shapes) drawShape(ctx, s, canvas.width, canvas.height);
      if (draft) drawShape(ctx, draft, canvas.width, canvas.height);
    },
    [shapes]
  );

  useEffect(() => {
    if (ready) redraw();
  }, [ready, shapes, redraw]);

  function toPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function handleDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!ready) return;
    const p = toPoint(e);
    if (tool === "line") {
      setShapes((s) => [...s, { tool, color, x1: p.x, y1: 0, x2: p.x, y2: 0 }]);
      return;
    }
    if (tool === "text") {
      const text = prompt("사진에 넣을 문구를 입력하세요:");
      if (text?.trim()) {
        setShapes((s) => [...s, { tool, color, x1: p.x, y1: p.y, x2: p.x, y2: p.y, text: text.trim() }]);
      }
      return;
    }
    draftRef.current = { tool, color, x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!draftRef.current) return;
    const p = toPoint(e);
    draftRef.current = { ...draftRef.current, x2: p.x, y2: p.y };
    redraw(draftRef.current);
  }

  function handleUp() {
    const d = draftRef.current;
    draftRef.current = null;
    if (!d) return;
    if (Math.hypot(d.x2 - d.x1, d.y2 - d.y1) > 8) {
      setShapes((s) => [...s, d]);
    } else {
      redraw();
    }
  }

  function finish() {
    canvasRef.current?.toBlob(
      (blob) => {
        if (blob) onDone(blob);
      },
      "image/jpeg",
      0.92
    );
  }

  const currentTool = TOOLS.find((t) => t.key === tool);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      {/* 도구 모음 */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 px-3 py-2">
        {TOOLS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTool(t.key)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
              tool === t.key ? "bg-white text-stone-900" : "bg-white/15 text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-white/30" />
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label="색상"
            className={`h-6 w-6 rounded-full border-2 ${
              color === c ? "border-white" : "border-transparent"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <p className="pb-1 text-center text-xs text-white/60">{currentTool?.hint}</p>

      {/* 사진 */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-2">
        {loadError ? (
          <p className="px-6 text-center text-sm text-white/80">
            이 사진 형식은 편집을 지원하지 않습니다.
            <br />
            표시 없이 그대로 업로드해 주세요.
          </p>
        ) : (
          <canvas
            ref={canvasRef}
            onPointerDown={handleDown}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            className="max-h-full max-w-full cursor-crosshair rounded-lg"
            style={{ touchAction: "none" }}
          />
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="flex items-center justify-center gap-2 px-3 py-3">
        <button type="button" onClick={onCancel} className="btn bg-white/15 text-white">
          취소
        </button>
        <button
          type="button"
          onClick={() => setShapes((s) => s.slice(0, -1))}
          disabled={shapes.length === 0}
          className="btn bg-white/15 text-white disabled:opacity-40"
        >
          ↩ 되돌리기
        </button>
        <button
          type="button"
          onClick={() => setShapes([])}
          disabled={shapes.length === 0}
          className="btn bg-white/15 text-white disabled:opacity-40"
        >
          전체 지우기
        </button>
        <button type="button" onClick={finish} disabled={!ready || loadError} className="btn-primary px-6">
          ✓ 완료
        </button>
      </div>
    </div>
  );
}

function drawShape(ctx: CanvasRenderingContext2D, s: Shape, w: number, h: number) {
  const lw = Math.max(3, w * 0.007);
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (s.tool === "line") {
    ctx.beginPath();
    ctx.moveTo(s.x1, 0);
    ctx.lineTo(s.x1, h);
    ctx.stroke();
    return;
  }

  if (s.tool === "rect") {
    ctx.strokeRect(
      Math.min(s.x1, s.x2),
      Math.min(s.y1, s.y2),
      Math.abs(s.x2 - s.x1),
      Math.abs(s.y2 - s.y1)
    );
    return;
  }

  if (s.tool === "arrow") {
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
    drawArrowHead(ctx, s.x2, s.y2, Math.atan2(s.y2 - s.y1, s.x2 - s.x1), lw);
    return;
  }

  if (s.tool === "curve") {
    // 시작-끝점을 잇는 곡선(회전 화살표)
    const mx = (s.x1 + s.x2) / 2;
    const my = (s.y1 + s.y2) / 2;
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const cx = mx - dy * 0.6;
    const cy = my + dx * 0.6;
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.quadraticCurveTo(cx, cy, s.x2, s.y2);
    ctx.stroke();
    drawArrowHead(ctx, s.x2, s.y2, Math.atan2(s.y2 - cy, s.x2 - cx), lw);
    return;
  }

  if (s.tool === "text" && s.text) {
    const fontSize = Math.max(18, w * 0.032);
    ctx.font = `bold ${fontSize}px sans-serif`;
    const lines = s.text.split("\n");
    const pad = fontSize * 0.35;
    const widths = lines.map((l) => ctx.measureText(l).width);
    const boxW = Math.max(...widths) + pad * 2;
    const boxH = lines.length * fontSize * 1.25 + pad * 2;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillRect(s.x1, s.y1, boxW, boxH);
    ctx.restore();
    ctx.fillStyle = s.color;
    ctx.textBaseline = "top";
    lines.forEach((l, i) => {
      ctx.fillText(l, s.x1 + pad, s.y1 + pad + i * fontSize * 1.25);
    });
  }
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  lw: number
) {
  const len = lw * 3.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - len * Math.cos(angle - 0.5), y - len * Math.sin(angle - 0.5));
  ctx.moveTo(x, y);
  ctx.lineTo(x - len * Math.cos(angle + 0.5), y - len * Math.sin(angle + 0.5));
  ctx.stroke();
}
