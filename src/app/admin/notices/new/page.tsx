import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import NavBar from "@/components/NavBar";
import NoticeForm from "@/components/NoticeForm";

export const dynamic = "force-dynamic";

export default async function NewNoticePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/notices");

  return (
    <>
      <NavBar user={user} />
      <main className="mx-auto w-full max-w-lg px-4 py-6">
        <h1 className="mb-5 text-xl font-bold text-stone-900">📢 공지 작성</h1>
        <NoticeForm />
      </main>
    </>
  );
}
