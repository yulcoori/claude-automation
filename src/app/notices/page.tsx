import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NavBar from "@/components/NavBar";
import NoticeCard from "@/components/NoticeCard";

export const dynamic = "force-dynamic";

export default async function NoticesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status === "PENDING") redirect("/pending");

  const notices = await prisma.notice.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    include: { author: true, images: true },
  });

  return (
    <>
      <NavBar user={user} />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">📢 센터 공지</h1>
            <p className="mt-1 text-sm text-stone-500">센터 소식과 안내사항을 확인하세요.</p>
          </div>
          {user.role === "ADMIN" && (
            <Link href="/admin/notices/new" className="btn-primary">
              + 공지 작성
            </Link>
          )}
        </div>
        {notices.length === 0 ? (
          <div className="card py-14 text-center text-sm text-stone-400">
            아직 등록된 공지가 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {notices.map((n) => (
              <NoticeCard
                key={n.id}
                notice={{
                  id: n.id,
                  title: n.title,
                  body: n.body,
                  pinned: n.pinned,
                  createdAt: n.createdAt.toISOString(),
                  authorName: n.author.name,
                  images: n.images.map((img) => ({ id: img.id, url: `/api/files/${img.filePath}` })),
                }}
                isAdmin={user.role === "ADMIN"}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
