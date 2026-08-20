"use client";

import { useRouter } from "next/navigation";
import CommentSection, { type CommentItem } from "./CommentSection";
import { formatDateTime } from "@/lib/format";

interface MediaItem {
  id: string;
  kind: string;
  slot: string;
  url: string;
}

interface PostData {
  id: string;
  type: string;
  sessionNumber: number | null;
  caption: string | null;
  createdAt: string;
  authorName: string;
  canDelete: boolean;
  media: MediaItem[];
}

export default function PostCard({
  post,
  comments,
}: {
  post: PostData;
  comments: CommentItem[];
}) {
  const router = useRouter();

  async function remove() {
    if (!confirm("이 게시물을 삭제할까요? 첨부된 사진/영상도 함께 삭제됩니다.")) return;
    await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    router.refresh();
  }

  const before = post.media.find((m) => m.slot === "BEFORE");
  const after = post.media.find((m) => m.slot === "AFTER");
  const normals = post.media.filter((m) => m.slot === "NORMAL");

  return (
    <article className="card">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          {post.sessionNumber != null && (
            <span className="badge bg-brand-600 text-white">{post.sessionNumber}회차</span>
          )}
          <span className="font-semibold text-stone-700">{post.authorName}</span>
          <span className="text-xs text-stone-400">{formatDateTime(post.createdAt)}</span>
        </div>
        {post.canDelete && (
          <button type="button" onClick={remove} className="text-xs text-stone-400 hover:text-red-600">
            삭제
          </button>
        )}
      </div>

      {post.type === "BEFORE_AFTER" && before && after ? (
        <div className="grid grid-cols-2 gap-2">
          <figure>
            <MediaView media={before} />
            <figcaption className="mt-1 text-center text-xs font-bold text-stone-500">BEFORE</figcaption>
          </figure>
          <figure>
            <MediaView media={after} />
            <figcaption className="mt-1 text-center text-xs font-bold text-brand-600">AFTER</figcaption>
          </figure>
        </div>
      ) : (
        <div className={`grid gap-2 ${normals.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {normals.map((m) => (
            <MediaView key={m.id} media={m} />
          ))}
        </div>
      )}

      {post.caption && (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">{post.caption}</p>
      )}

      <CommentSection postId={post.id} comments={comments} />
    </article>
  );
}

function MediaView({ media }: { media: MediaItem }) {
  if (media.kind === "VIDEO") {
    return (
      <video
        src={media.url}
        controls
        playsInline
        preload="metadata"
        className="w-full rounded-xl bg-stone-900"
      />
    );
  }
  return (
    <a href={media.url} target="_blank" rel="noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={media.url} alt="" className="w-full rounded-xl object-cover" loading="lazy" />
    </a>
  );
}
