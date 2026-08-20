// PWA 아이콘 생성 스크립트 (한 번만 실행: node scripts/gen-icons.mjs)
import sharp from "sharp";
import { mkdir } from "fs/promises";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <rect width="512" height="512" rx="112" fill="#dc6845"/>
  <text x="256" y="330" font-size="240" text-anchor="middle" font-family="sans-serif">🧘</text>
</svg>`;

await mkdir("public/icons", { recursive: true });
for (const size of [192, 512]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
  console.log(`icon-${size}.png 생성 완료`);
}
