import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";

// 최신 공지 1건을 보여주는 배너 (고정 공지 우선)
export default async function NoticeBanner() {
  const notice = await prisma.notice.findFirst({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });
  if (!notice) return null;

  return (
    <Link
      href="/notices"
      className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm transition hover:bg-brand-100"
    >
      <span className="shrink-0">📢</span>
      <span className="min-w-0 flex-1 truncate font-semibold text-stone-800">{notice.title}</span>
      <span className="shrink-0 text-xs text-stone-400">{formatDate(notice.createdAt)}</span>
      <span className="shrink-0 text-xs font-semibold text-brand-600">전체보기 →</span>
    </Link>
  );
}
