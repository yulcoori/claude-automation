"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PhotoAnnotator from "./PhotoAnnotator";

type Slot = "before" | "after";

interface SlotFile {
  file: File; // 업로드할 파일 (표시 완료 시 편집본)
  original: File; // 원본 (다시 편집할 때 사용)
  annotated: boolean;
}

export default function UploadPanel({
  memberId,
  currentSessions,
}: {
  memberId: string;
  currentSessions: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"BEFORE_AFTER" | "MEDIA">("BEFORE_AFTER");
  const [sessionNumber, setSessionNumber] = useState(String(currentSessions || ""));
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [slotFiles, setSlotFiles] = useState<Record<Slot, SlotFile | null>>({
    before: null,
    after: null,
  });
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  function pickSlotFile(slot: Slot, file: File | undefined) {
    setSlotFiles((s) => ({
      ...s,
      [slot]: file ? { file, original: file, annotated: false } : null,
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const fd = new FormData();
    fd.set("memberId", memberId);
    fd.set("type", tab);
    if (sessionNumber) fd.set("sessionNumber", sessionNumber);
    if (caption.trim()) fd.set("caption", caption.trim());

    if (tab === "BEFORE_AFTER") {
      if (!slotFiles.before || !slotFiles.after) {
        setError("비포 사진과 애프터 사진을 모두 선택해 주세요.");
        return;
      }
      fd.set("before", slotFiles.before.file);
      fd.set("after", slotFiles.after.file);
    } else {
      const files = filesRef.current?.files;
      if (!files || files.length === 0) {
        setError("업로드할 사진 또는 영상을 선택해 주세요.");
        return;
      }
      Array.from(files).forEach((f) => fd.append("files", f));
    }

    setLoading(true);
    const res = await fetch("/api/posts", { method: "POST", body: fd });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "업로드에 실패했습니다.");
      return;
    }
    setCaption("");
    setSlotFiles({ before: null, after: null });
    if (filesRef.current) filesRef.current.value = "";
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary w-full py-3">
        + 사진 · 영상 · 비포&애프터 업로드
      </button>
    );
  }

  return (
    <section className="card border-brand-200">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold text-stone-900">업로드</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-stone-400">
          닫기 ✕
        </button>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {(
          [
            ["BEFORE_AFTER", "📸 비포&애프터"],
            ["MEDIA", "🎬 사진/영상"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
              tab === key
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-stone-200 bg-white text-stone-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3">
        {tab === "BEFORE_AFTER" ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <SlotPicker
                label="비포 (Before)"
                slot="before"
                slotFile={slotFiles.before}
                onPick={(f) => pickSlotFile("before", f)}
                onEdit={() => setEditingSlot("before")}
              />
              <SlotPicker
                label="애프터 (After)"
                slot="after"
                slotFile={slotFiles.after}
                onPick={(f) => pickSlotFile("after", f)}
                onEdit={() => setEditingSlot("after")}
              />
            </div>
            <p className="text-xs text-stone-400">
              ✏️ 사진 선택 후 <b>표시하기</b>를 누르면 기준선·화살표·박스·문구를 사진 위에 바로
              그릴 수 있어요.
            </p>
          </>
        ) : (
          <div>
            <label className="label">사진/영상 (여러 개 선택 가능)</label>
            <input
              ref={filesRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="input text-xs"
            />
          </div>
        )}
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <div>
            <label className="label">회차</label>
            <input
              type="number"
              min={1}
              className="input"
              placeholder="예: 10"
              value={sessionNumber}
              onChange={(e) => setSessionNumber(e.target.value)}
            />
          </div>
          <div>
            <label className="label">설명</label>
            <input
              className="input"
              placeholder="예: 어깨 정렬이 많이 좋아지셨어요!"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading ? "업로드 중... (영상은 시간이 걸릴 수 있어요)" : "업로드"}
        </button>
      </form>

      {editingSlot && slotFiles[editingSlot] && (
        <PhotoAnnotator
          file={slotFiles[editingSlot]!.original}
          onCancel={() => setEditingSlot(null)}
          onDone={(blob) => {
            const slot = editingSlot;
            const annotatedFile = new File([blob], `${slot}-annotated.jpg`, {
              type: "image/jpeg",
            });
            setSlotFiles((s) => ({
              ...s,
              [slot]: s[slot] ? { ...s[slot]!, file: annotatedFile, annotated: true } : null,
            }));
            setEditingSlot(null);
          }}
        />
      )}
    </section>
  );
}

function SlotPicker({
  label,
  slot,
  slotFile,
  onPick,
  onEdit,
}: {
  label: string;
  slot: Slot;
  slotFile: SlotFile | null;
  onPick: (file: File | undefined) => void;
  onEdit: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!slotFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(slotFile.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [slotFile]);

  const isImage = slotFile?.file.type.startsWith("image/") ?? false;
  const isVideo = slotFile?.file.type.startsWith("video/") ?? false;

  return (
    <div>
      <label className="label">{label}</label>
      <input
        ref={inputRef}
        id={`slot-${slot}`}
        type="file"
        accept="image/*,video/*"
        className="input text-xs"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      {slotFile && previewUrl && (
        <div className="mt-2">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="max-h-40 w-full rounded-lg object-contain" />
          ) : isVideo ? (
            <video src={previewUrl} className="max-h-40 w-full rounded-lg" muted />
          ) : null}
          {isImage && (
            <button type="button" onClick={onEdit} className="btn-secondary mt-1.5 w-full py-1.5 text-xs">
              ✏️ {slotFile.annotated ? "표시 다시 하기" : "사진에 표시하기 (기준선·화살표)"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
