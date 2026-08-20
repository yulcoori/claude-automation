import { kindOf, saveUpload } from "@/lib/uploads";

// ============================================================
// 차트 '움직임 평가' 사진/영상 처리
// - content JSON 안의 기존 첨부 경로를 검증 (다른 회원 파일 참조 차단)
// - 폼으로 새로 올라온 mm-{행}-{start|now} 파일을 저장해 content에 반영
// ============================================================

const SAFE_PATH = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/;
const MAX_PER_CELL = 4;

interface MediaRef {
  path: string;
  kind: string;
}

function sanitizeRefs(refs: unknown, memberId: string): MediaRef[] {
  if (!Array.isArray(refs)) return [];
  return refs
    .filter(
      (m): m is MediaRef =>
        !!m &&
        typeof m.path === "string" &&
        SAFE_PATH.test(m.path) &&
        m.path.startsWith(`${memberId}/`) &&
        (m.kind === "IMAGE" || m.kind === "VIDEO")
    )
    .slice(0, MAX_PER_CELL);
}

// 반환: 반영된 content JSON 문자열 + content가 참조하는 모든 미디어 경로
export async function applyMovementMedia(
  fd: FormData,
  contentJson: string,
  memberId: string
): Promise<{ content: string; referenced: Set<string> }> {
  const parsed = JSON.parse(contentJson);
  const referenced = new Set<string>();

  if (Array.isArray(parsed.movement)) {
    // 기존 첨부 검증
    for (const row of parsed.movement) {
      row.startMedia = sanitizeRefs(row.startMedia, memberId);
      row.nowMedia = sanitizeRefs(row.nowMedia, memberId);
    }

    // 새 첨부 저장
    for (const [key, val] of Array.from(fd.entries())) {
      const m = key.match(/^mm-(\d+)-(start|now)$/);
      if (!m || !(val instanceof File) || val.size === 0) continue;
      const row = parsed.movement[Number(m[1])];
      if (!row) continue;
      const kind = kindOf(val.type);
      if (kind !== "IMAGE" && kind !== "VIDEO") {
        throw new Error("움직임 평가에는 사진 또는 영상만 첨부할 수 있습니다.");
      }
      const field = m[2] === "start" ? "startMedia" : "nowMedia";
      if (row[field].length >= MAX_PER_CELL) continue; // 칸당 최대 4개
      const path = await saveUpload(val, memberId);
      row[field].push({ path, kind });
    }

    for (const row of parsed.movement) {
      for (const ref of [...row.startMedia, ...row.nowMedia]) referenced.add(ref.path);
    }
  }

  return { content: JSON.stringify(parsed), referenced };
}

// 이전 content가 참조하던 미디어 경로 수집 (수정 시 삭제된 파일 정리용)
export function collectMovementMediaPaths(contentJson: string): Set<string> {
  const paths = new Set<string>();
  try {
    const parsed = JSON.parse(contentJson);
    if (Array.isArray(parsed.movement)) {
      for (const row of parsed.movement) {
        for (const ref of [...(row.startMedia ?? []), ...(row.nowMedia ?? [])]) {
          if (ref && typeof ref.path === "string") paths.add(ref.path);
        }
      }
    }
  } catch {
    // 무시
  }
  return paths;
}
