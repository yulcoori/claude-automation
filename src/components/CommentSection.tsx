"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format";

export interface CommentItem {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  authorRole: string;
  mine: boolean;
}

export default function CommentSection({
  postId,
  chartId,
  comments,
}: {
  postId?: string;
  chartId?: string;
  comments: CommentItem[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);
    await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, chartId, body: body.trim() }),
    });
    setLoading(false);
    setBody("");
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("댓글을 삭제할까요?")) return;
    await fetch(`/api/comments/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="mt-4 border-t border-stone-100 pt-3">
      {comments.length > 0 && (
        <ul className="mb-3 space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="rounded-xl bg-stone-50 px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-600">
                  {c.authorName}
                  {c.authorRole === "INSTRUCTOR" && (
                    <span className="ml-1 text-brand-600">강사</span>
                  )}
                  {c.authorRole === "ADMIN" && <span className="ml-1 text-brand-600">센터</span>}
                  <span className="ml-2 font-normal text-stone-400">
                    {formatDateTime(c.createdAt)}
                  </span>
                </span>
                {c.mine && (
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    className="text-xs text-stone-300 hover:text-red-500"
                  >
                    삭제
                  </button>
                )}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap leading-5 text-stone-700">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="flex gap-2">
        <input
          className="input flex-1 py-2 text-sm"
          placeholder="댓글을 남겨보세요"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button type="submit" disabled={loading || !body.trim()} className="btn-primary px-4 py-2">
          등록
        </button>
      </form>
    </div>
  );
}
