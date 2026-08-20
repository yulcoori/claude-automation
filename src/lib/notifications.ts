import { prisma } from "@/lib/prisma";

async function notifyUsers(
  userIds: (string | null | undefined)[],
  exclude: string,
  type: string,
  message: string,
  link: string
) {
  const recipients = Array.from(
    new Set(userIds.filter((id): id is string => !!id && id !== exclude))
  );
  if (recipients.length === 0) return;
  await prisma.notification.createMany({
    data: recipients.map((userId) => ({ userId, type, message, link })),
  });
}

// 새 공지 → 작성자를 제외한 모든 활성 사용자
export async function notifyNewNotice(authorId: string, title: string) {
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  await notifyUsers(
    users.map((u) => u.id),
    authorId,
    "NOTICE",
    `📢 새 공지: ${title}`,
    "/notices"
  );
}

// 새 댓글 → 회원 본인 + 담당 강사 + 원글 작성자 (댓글 작성자 제외)
export async function notifyNewComment(params: {
  commentAuthorId: string;
  commentAuthorName: string;
  memberUserId: string;
  instructorId: string | null;
  contentAuthorId?: string;
  where: string; // 예: "10회차 차트" / "비포&애프터"
  link: string;
  preview: string;
}) {
  const preview = params.preview.length > 30 ? `${params.preview.slice(0, 30)}…` : params.preview;
  await notifyUsers(
    [params.memberUserId, params.instructorId, params.contentAuthorId],
    params.commentAuthorId,
    "COMMENT",
    `💬 ${params.commentAuthorName}님이 ${params.where}에 댓글을 남겼습니다: ${preview}`,
    params.link
  );
}

// 새 게시물(비포애프터/사진영상) → 회원 본인
export async function notifyNewPost(params: {
  authorId: string;
  authorName: string;
  memberUserId: string;
  type: string;
  link: string;
}) {
  const label = params.type === "BEFORE_AFTER" ? "비포&애프터" : "사진/영상";
  await notifyUsers(
    [params.memberUserId],
    params.authorId,
    "POST",
    `📸 ${params.authorName} 강사님이 새 ${label}을 올렸습니다.`,
    params.link
  );
}

// 새 차트 → 회원 본인
export async function notifyNewChart(params: {
  authorId: string;
  authorName: string;
  memberUserId: string;
  milestone: number;
  link: string;
}) {
  await notifyUsers(
    [params.memberUserId],
    params.authorId,
    "CHART",
    `📋 ${params.authorName} 강사님이 ${params.milestone}회차 체형 분석 차트를 작성했습니다.`,
    params.link
  );
}
