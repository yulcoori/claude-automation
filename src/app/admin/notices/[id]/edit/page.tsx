import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NavBar from "@/components/NavBar";
import NoticeForm from "@/components/NoticeForm";

export const dynamic = "force-dynamic";

export default async function EditNoticePage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/notices");

  const notice = await prisma.notice.findUnique({
    where: { id: params.id },
    include: { images: true },
  });
  if (!notice) notFound();

  return (
    <>
      <NavBar user={user} />
      <main className="mx-auto w-full max-w-lg px-4 py-6">
        <h1 className="mb-5 text-xl font-bold text-stone-900">📢 공지 수정</h1>
        <NoticeForm
          noticeId={notice.id}
          initial={{
            title: notice.title,
            body: notice.body,
            pinned: notice.pinned,
            images: notice.images.map((img) => ({
              id: img.id,
              url: `/api/files/${img.filePath}`,
            })),
          }}
        />
      </main>
    </>
  );
}
