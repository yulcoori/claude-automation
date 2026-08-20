"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function NoticeForm({
  noticeId,
  initial,
}: {
  noticeId?: string;
  initial?: {
    title: string;
    body: string;
    pinned: boolean;
    images: { id: string; url: string }[];
  };
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [removeIds, setRemoveIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const filesRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("body", body.trim());
    fd.set("pinned", String(pinned));
    if (noticeId) fd.set("removeImageIds", JSON.stringify(removeIds));
    const files = filesRef.current?.files;
    if (files) Array.from(files).forEach((f) => fd.append("images", f));

    const res = await fetch(noticeId ? `/api/notices/${noticeId}` : "/api/notices", {
      method: noticeId ? "PATCH" : "POST",
      body: fd,
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "저장에 실패했습니다.");
      return;
    }
    router.push("/notices");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <div>
        <label className="label">제목 *</label>
        <input
          className="input"
          placeholder="예: 추석 연휴 휴무 안내"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="label">내용</label>
        <textarea
          className="input"
          rows={6}
          placeholder="공지 내용을 입력하세요"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      {initial && initial.images.length > 0 && (
        <div>
          <label className="label">기존 사진 (누르면 삭제 표시)</label>
          <div className="grid grid-cols-3 gap-2">
            {initial.images.map((img) => {
              const marked = removeIds.includes(img.id);
              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() =>
                    setRemoveIds((ids) =>
                      marked ? ids.filter((i) => i !== img.id) : [...ids, img.id]
                    )
                  }
                  className={`relative overflow-hidden rounded-xl border-2 ${
                    marked ? "border-red-400 opacity-40" : "border-transparent"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="h-24 w-full object-cover" />
                  {marked && (
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-red-600">
                      삭제됨
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div>
        <label className="label">사진 첨부 (선택, 여러 장 가능)</label>
        <input ref={filesRef} type="file" accept="image/*" multiple className="input text-xs" />
      </div>
      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          checked={pinned}
          onChange={(e) => setPinned(e.target.checked)}
          className="h-4 w-4 accent-brand-600"
        />
        📌 상단에 고정
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full py-3">
        {loading ? "저장 중..." : noticeId ? "공지 수정" : "공지 등록"}
      </button>
    </form>
  );
}
