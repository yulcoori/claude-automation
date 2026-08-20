import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "application/pdf": ".pdf",
};

export const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

export function uploadRoot() {
  return UPLOAD_DIR;
}

export function kindOf(mimeType: string): "IMAGE" | "VIDEO" | "PDF" | null {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType === "application/pdf") return "PDF";
  return null;
}

export async function saveUpload(file: File, subdir: string): Promise<string> {
  const ext = ALLOWED[file.type];
  if (!ext) throw new Error(`허용되지 않는 파일 형식입니다: ${file.type}`);
  if (file.size > MAX_FILE_SIZE) throw new Error("파일 크기는 200MB 이하만 가능합니다.");

  const safeSubdir = subdir.replace(/[^a-zA-Z0-9_-]/g, "");
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  const dir = path.join(UPLOAD_DIR, safeSubdir);
  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, name), buffer);
  return `${safeSubdir}/${name}`;
}
