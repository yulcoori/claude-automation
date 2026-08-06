"""이미지 전처리.

하는 일:
  - EXIF 회전 정보를 실제 픽셀에 적용 (세로 사진이 눕는 문제 해결)
  - GPS·기기 정보 등 EXIF 개인정보 제거
  - 네이버 블로그 본문 폭에 맞게 리사이즈 + 재인코딩 (업로드 속도 / 로딩 속도)
  - 순서대로 파일명 정리
  - 같은 사진이 중복으로 들어갔는지 검사해서 경고

하지 않는 일:
  픽셀을 변조해 '다른 이미지처럼' 보이게 만드는 처리는 넣지 않았습니다.
  네이버는 파일 메타데이터가 아니라 이미지 자체의 특징으로 중복을 판정하므로
  그런 처리는 효과가 없고, 시도 자체가 어뷰징으로 취급됩니다.
  중복이 잡히면 답은 하나입니다 — 직접 찍은 새 사진을 쓰는 것.
"""

from __future__ import annotations

import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image, ImageOps

# 네이버 블로그 본문 최대 폭은 966px. 고해상도 화면 대응으로 2배 조금 아래를 상한으로.
MAX_WIDTH = 1600
MAX_HEIGHT = 1600
JPEG_QUALITY = 85
SUPPORTED = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".bmp", ".gif"}


def slugify(text: str) -> str:
    """파일명용. 한글은 그대로 두고 공백/특수문자만 정리한다.

    네이버는 한글 파일명을 문제없이 받고, 파일명에 키워드가 들어가는 편이
    본인 정리에도 유리하다."""
    text = re.sub(r"\s+", "-", text.strip())
    text = re.sub(r"[^0-9A-Za-z가-힣._-]", "", text)
    return text.strip("-._") or "image"


@dataclass
class ProcessedImage:
    index: int
    source: Path
    output: Path
    width: int
    height: int
    size_kb: int
    digest: str
    duplicate_of: int | None = None


@dataclass
class ImageReport:
    images: list[ProcessedImage] = field(default_factory=list)
    skipped: list[tuple[Path, str]] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def duplicates(self) -> list[ProcessedImage]:
        return [i for i in self.images if i.duplicate_of is not None]


def collect_images(source: Path) -> list[Path]:
    """파일 하나, 폴더, 또는 여러 경로를 받아 이미지 목록으로."""
    if source.is_file():
        return [source] if source.suffix.lower() in SUPPORTED else []
    if source.is_dir():
        return sorted(
            (p for p in source.iterdir() if p.is_file() and p.suffix.lower() in SUPPORTED),
            key=lambda p: p.name.lower(),
        )
    return []


@dataclass(frozen=True)
class Signature:
    """리사이즈·재인코딩만 다른 같은 사진을 알아보기 위한 지문.

    difference hash 는 인접 픽셀의 밝기 '변화'를 보므로 화질 열화에 강하지만,
    단색에 가까운 이미지에서는 변화가 없어 전부 같은 값이 된다.
    그래서 평균 색상을 함께 들고 비교한다."""

    dhash: int
    color: tuple[int, int, int]

    @property
    def hex(self) -> str:
        return f"{self.dhash:016x}"

    def is_same_as(self, other: "Signature", *, bit_tol: int = 6, color_tol: int = 20) -> bool:
        if bin(self.dhash ^ other.dhash).count("1") > bit_tol:
            return False
        distance = sum((a - b) ** 2 for a, b in zip(self.color, other.color)) ** 0.5
        return distance <= color_tol


def _signature(img: Image.Image) -> Signature:
    # dHash: 9x8 그레이스케일에서 가로 방향 인접 픽셀 비교 → 64비트
    gray = img.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    pixels = list(gray.tobytes())
    bits = 0
    for row in range(8):
        for col in range(8):
            left = pixels[row * 9 + col]
            right = pixels[row * 9 + col + 1]
            bits = (bits << 1) | int(left > right)

    tiny = img.convert("RGB").resize((1, 1), Image.Resampling.LANCZOS)
    color = tiny.getpixel((0, 0))
    return Signature(dhash=bits, color=(color[0], color[1], color[2]))


def process_images(
    sources: list[Path],
    out_dir: Path,
    *,
    keyword: str = "image",
    max_width: int = MAX_WIDTH,
    max_height: int = MAX_HEIGHT,
    quality: int = JPEG_QUALITY,
) -> ImageReport:
    out_dir.mkdir(parents=True, exist_ok=True)
    report = ImageReport()
    base = slugify(keyword)
    seen: list[tuple[Signature, int]] = []

    paths: list[Path] = []
    for source in sources:
        found = collect_images(source)
        if not found:
            report.skipped.append((source, "이미지 파일이 없거나 지원하지 않는 형식"))
        paths.extend(found)

    for order, path in enumerate(paths, start=1):
        try:
            with Image.open(path) as raw:
                is_animated = getattr(raw, "is_animated", False)
                if is_animated:
                    # 움직이는 GIF 는 재인코딩하면 애니메이션이 깨진다. 이름만 정리해 복사.
                    target = out_dir / f"{base}-{order:02d}{path.suffix.lower()}"
                    shutil.copy2(path, target)
                    report.images.append(
                        ProcessedImage(
                            index=order,
                            source=path,
                            output=target,
                            width=raw.width,
                            height=raw.height,
                            size_kb=target.stat().st_size // 1024,
                            digest=f"anim:{order}",
                        )
                    )
                    report.warnings.append(f"{path.name}: 애니메이션 파일이라 원본 그대로 복사했습니다.")
                    continue

                # EXIF 회전 적용 후, EXIF 자체는 버린다 (GPS·기기정보 제거)
                img = ImageOps.exif_transpose(raw)
                has_alpha = img.mode in ("RGBA", "LA", "P")
                img = img.convert("RGBA" if has_alpha else "RGB")

                signature = _signature(img)
                img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)

                if has_alpha:
                    target = out_dir / f"{base}-{order:02d}.png"
                    img.save(target, "PNG", optimize=True)
                else:
                    target = out_dir / f"{base}-{order:02d}.jpg"
                    img.save(target, "JPEG", quality=quality, optimize=True, progressive=True)

                processed = ProcessedImage(
                    index=order,
                    source=path,
                    output=target,
                    width=img.width,
                    height=img.height,
                    size_kb=target.stat().st_size // 1024,
                    digest=signature.hex,
                )
                match = next((idx for sig, idx in seen if signature.is_same_as(sig)), None)
                if match is not None:
                    processed.duplicate_of = match
                else:
                    seen.append((signature, order))
                report.images.append(processed)
        except OSError as exc:
            report.skipped.append((path, f"읽기 실패: {exc}"))

    if report.duplicates:
        pairs = ", ".join(f"#{i.index}↔#{i.duplicate_of}" for i in report.duplicates)
        report.warnings.append(
            f"같은 사진이 중복으로 들어갔습니다 ({pairs}). "
            "중복 이미지는 문서 품질 평가에서 불리하니 하나만 남기세요."
        )
    if len(report.images) < 5:
        report.warnings.append(
            f"이미지가 {len(report.images)}장입니다. 상위 노출 글은 보통 6장 이상을 씁니다."
        )
    return report
