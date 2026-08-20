import { notFound, redirect } from "next/navigation";
import { canManageMember, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NavBar from "@/components/NavBar";
import ChartForm from "@/components/ChartForm";
import { parseChartContent } from "@/lib/chartTemplate";

export const dynamic = "force-dynamic";

export default async function EditChartPage({
  params,
}: {
  params: { id: string; chartId: string };
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status === "PENDING") redirect("/pending");

  const chart = await prisma.chart.findUnique({
    where: { id: params.chartId },
    include: { member: { include: { user: true } }, instructor: true },
  });
  if (!chart || chart.memberId !== params.id) notFound();
  if (!canManageMember(user, chart.member)) redirect(`/members/${params.id}`);

  return (
    <>
      <NavBar user={user} />
      <main className="mx-auto w-full max-w-[1040px] px-4 py-6">
        <h1 className="mb-5 text-xl font-bold text-stone-900">
          차트 수정 · <span className="text-brand-600">{chart.milestone}회차</span>{" "}
          <span className="text-base font-normal text-stone-500">
            ({chart.member.user.name} 회원님)
          </span>
        </h1>
        <ChartForm
          memberId={chart.memberId}
          chartId={chart.id}
          milestone={chart.milestone}
          memberName={chart.member.user.name}
          instructorName={chart.instructor.name}
          initial={parseChartContent(chart.content)}
          existingPdf={chart.pdfPath}
        />
      </main>
    </>
  );
}
