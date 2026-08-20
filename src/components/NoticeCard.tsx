"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";

export interface NoticeData {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  authorName: string;
  images: { id: string; url: string }[];
}

export default function NoticeCard({
  notice,
  isAdmin,
}: {
  notice: NoticeData;
  isAdmin: boolean;
}) {
  const router = useRouter();

  async function remove() {
    if (!confirm("이 공지를 삭제할까요?")) return;
    await fetch(`/api/notices/${notice.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <article className={`card ${notice.pinned ? "border-brand-300 bg-brand-50/40" : ""}`}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-stone-900">
            {notice.pinned && <span className="mr-1.5 badge bg-brand-600 text-white">📌 고정</span>}
            {notice.title}
          </h2>
          <p className="mt-1 text-xs text-stone-400">
            {notice.authorName} · {formatDate(notice.createdAt)}
          </p>
        </div>
        {isAdmin && (
          <div className="flex shrink-0 gap-2 text-xs">
            <Link
              href={`/admin/notices/${notice.id}/edit`}
              className="text-stone-400 hover:text-brand-600"
            >
              수정
            </Link>
            <button type="button" onClick={remove} className="text-stone-400 hover:text-red-600">
              삭제
            </button>
          </div>
        )}
      </div>
      {notice.body && (
        <p className="whitespace-pre-wrap text-sm leading-6 text-stone-700">{notice.body}</p>
      )}
      {notice.images.length > 0 && (
        <div className={`mt-3 grid gap-2 ${notice.images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {notice.images.map((img) => (
            <a key={img.id} href={img.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="w-full rounded-xl object-cover" loading="lazy" />
            </a>
          ))}
        </div>
      )}
    </article>
  );
}
