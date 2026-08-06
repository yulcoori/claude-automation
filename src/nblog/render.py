"""산출물 생성.

out/<키워드>-<날짜>/ 안에 발행에 필요한 것을 전부 모아둡니다.

  post.html      브라우저에서 열어 전체 선택 → 복사 → 스마트에디터에 붙여넣기
  post.md        마크다운 원본 (수정은 여기서)
  checklist.md   발행 전 셀프 체크 결과
  plan.json      설계안 원본 데이터
  keywords.csv   키워드 검색량 / 경쟁도 표
  prompt.md      초안 생성에 쓴 프롬프트 (다시 돌릴 때)
  images/        최적화된 사진 (업로드용)
"""

from __future__ import annotations

import csv
import html
import json
import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from .audit import AuditReport
from .draft import DraftResult
from .images import ImageReport
from .images import slugify
from .research import PostPlan


_BULLET = r"^\s*[-*]\s+"


@dataclass
class Package:
    root: Path
    files: list[Path]


def _md_to_html(markdown: str, images: ImageReport | None) -> str:
    """붙여넣기용 최소 HTML. 스마트에디터가 안전하게 받는 태그만 씁니다."""
    by_index = {i.index: i for i in images.images} if images else {}
    out: list[str] = []

    for block in re.split(r"\n\s*\n", markdown.strip()):
        block = block.strip()
        if not block:
            continue

        if block.startswith("# "):
            out.append(f"<h2>{html.escape(block[2:].strip())}</h2>")
            continue
        if block.startswith("## "):
            out.append(f"<h3>{html.escape(block[3:].strip())}</h3>")
            continue
        if block.startswith("### "):
            out.append(f"<h4>{html.escape(block[4:].strip())}</h4>")
            continue

        if re.match(_BULLET, block):
            items = []
            for line in block.splitlines():
                if not line.strip():
                    continue
                text = html.escape(re.sub(_BULLET, "", line))
                items.append(f"<li>{text}</li>")
            out.append("<ul>" + "".join(items) + "</ul>")
            continue

        photo = re.fullmatch(r"\[사진\s*(\d+)\](.*)", block, flags=re.DOTALL)
        if photo:
            idx = int(photo.group(1))
            note = photo.group(2).strip()
            img = by_index.get(idx)
            name = img.output.name if img else f"(사진 {idx})"
            label = f"📷 여기에 <b>{html.escape(name)}</b> 업로드"
            if note:
                label += f" — {html.escape(note)}"
            out.append(
                '<p style="background:#fff6d6;border:1px dashed #d8b400;padding:10px 12px;'
                f'border-radius:6px;color:#7a5c00">{label}</p>'
            )
            continue

        text = html.escape(block).replace("\n", "<br>")
        text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
        out.append(f"<p>{text}</p>")

    return "\n".join(out)


_HTML_SHELL = """<!doctype html>
<meta charset="utf-8">
<title>{title}</title>
<style>
  body {{ font: 16px/1.85 -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
         max-width: 720px; margin: 40px auto; padding: 0 20px; color: #222; }}
  h2 {{ font-size: 1.6em; line-height: 1.4; margin: 0 0 24px; }}
  h3 {{ font-size: 1.2em; margin: 36px 0 12px; }}
  p {{ margin: 0 0 18px; }}
  .howto {{ background:#eef4ff; border-left:4px solid #2b6cb0; padding:14px 16px;
            border-radius:6px; font-size:.9em; margin-bottom:32px; }}
  .howto ol {{ margin: 8px 0 0 18px; padding: 0; }}
</style>
<div class="howto">
  <b>붙여넣는 방법</b>
  <ol>
    <li>이 페이지에서 아래 본문을 드래그해 복사 (Ctrl/Cmd + A → C 도 됩니다)</li>
    <li>네이버 블로그 글쓰기 → 스마트에디터 본문에 붙여넣기 (Ctrl/Cmd + V)</li>
    <li>노란 박스가 있는 자리에 <code>images/</code> 폴더의 해당 사진을 업로드하고 박스는 삭제</li>
    <li><code>checklist.md</code> 를 보고 남은 항목 정리 → 발행</li>
  </ol>
  이 박스는 복사해도 무해하지만, 붙여넣은 뒤 지우세요.
</div>
<article>
{body}
</article>
"""


def write_package(
    out_root: Path,
    plan: PostPlan,
    draft: DraftResult,
    images: ImageReport | None,
    report: AuditReport,
    *,
    today: date | None = None,
) -> Package:
    stamp = (today or date.today()).isoformat()
    root = out_root / f"{slugify(plan.main_keyword)}-{stamp}"
    root.mkdir(parents=True, exist_ok=True)
    files: list[Path] = []

    def write(name: str, content: str) -> None:
        path = root / name
        path.write_text(content, encoding="utf-8")
        files.append(path)

    write("post.md", draft.markdown)
    write(
        "post.html",
        _HTML_SHELL.format(
            title=html.escape(plan.main_keyword),
            body=_md_to_html(draft.markdown, images),
        ),
    )
    write("checklist.md", report.to_markdown())
    write("prompt.md", draft.prompt)
    write("plan.json", json.dumps(plan.to_dict(), ensure_ascii=False, indent=2))
    write("guide.md", _guide(plan, images, draft))

    if plan.keyword_table:
        path = root / "keywords.csv"
        with path.open("w", encoding="utf-8-sig", newline="") as fh:
            writer = csv.DictWriter(fh, fieldnames=list(plan.keyword_table[0].keys()))
            writer.writeheader()
            writer.writerows(plan.keyword_table)
        files.append(path)

    return Package(root=root, files=files)


def _guide(plan: PostPlan, images: ImageReport | None, draft: DraftResult) -> str:
    insight = plan.insight
    lines = [
        f"# {plan.main_keyword} — 포스팅 설계 요약",
        "",
        f"초안 생성: {'Claude API' if draft.generated_by == 'claude' else '프롬프트만 (API 키 없음)'}",
        "",
        "## 제목 후보",
        *[f"{i}. {t}" for i, t in enumerate(plan.recommended_titles, 1)],
        "",
        "## 태그 (복사해서 붙여넣기)",
        "```",
        " ".join(f"#{t.replace(' ', '')}" for t in plan.tags),
        "```",
        "",
        "## 키워드",
        f"- 메인: **{plan.main_keyword}** (본문 {plan.target_keyword_count}회)",
        f"- 서브: {', '.join(plan.sub_keywords) or '-'}",
        f"- 롱테일: {', '.join(plan.long_tail) or '-'}",
        "",
    ]

    if insight.sample_size:
        lines += [
            "## 상위 노출 글 분석",
            f"- 블로그 총 문서수: {insight.total_docs:,}건",
            f"- 분석 표본: 상위 {insight.sample_size}개",
            f"- 제목 평균 {insight.avg_title_len}자 (중앙값 {insight.median_title_len}자)",
            f"- 제목에 숫자 포함 {insight.pct_title_has_number:.0%} · 괄호 {insight.pct_title_has_bracket:.0%} "
            f"· 후킹어 {insight.pct_title_has_hook:.0%}",
            f"- 평균 {insight.avg_days_old:.0f}일 전 글 · 3개월 내 {insight.pct_within_90days:.0%}",
            f"- {insight.freshness_verdict}",
            "",
            "### 상위 글 제목",
            *[f"- {t}" for t in insight.top_titles],
            "",
        ]

    if plan.keyword_table:
        lines += [
            "## 키워드 표 (상위 15개)",
            "",
            "| 키워드 | 월 검색량 | 모바일 비중 | 문서수 | 문서/검색 | 진입난이도 |",
            "|---|---:|---:|---:|---:|---|",
        ]
        for row in plan.keyword_table[:15]:
            ratio = "-" if row["doc_ratio"] is None else f"{row['doc_ratio']:.1f}"
            docs = f"{row['blog_docs']:,}" if row["blog_docs"] else "-"
            lines.append(
                f"| {row['keyword']} | {row['searches']:,} | {row['mobile_ratio']:.0%} "
                f"| {docs} | {ratio} | {row['grade']} |"
            )
        lines += ["", "> 문서/검색 비율이 낮을수록 '수요는 있는데 쓴 사람은 적은' 키워드입니다.", ""]

    if images:
        lines += ["## 사진", f"- {len(images.images)}장 최적화 완료 (`images/`)"]
        for img in images.images:
            dup = f" ⚠️ #{img.duplicate_of} 와 중복" if img.duplicate_of else ""
            lines.append(
                f"  - `{img.output.name}` {img.width}×{img.height}, {img.size_kb}KB "
                f"← {img.source.name}{dup}"
            )
        for warning in images.warnings:
            lines.append(f"- ⚠️ {warning}")
        for path, reason in images.skipped:
            lines.append(f"- 건너뜀: `{path}` — {reason}")
        lines.append("")

    if plan.notes:
        lines += ["## 참고", *[f"- {n}" for n in plan.notes], ""]

    lines += [
        "## 발행 순서",
        "1. `post.md` 를 열어 `{{직접 채우기}}` 를 실제 경험으로 채웁니다.",
        "2. `python -m nblog audit post.md --plan plan.json` 으로 다시 검사합니다.",
        "3. `post.html` 을 브라우저로 열어 복사 → 스마트에디터에 붙여넣습니다.",
        "4. 노란 박스 자리에 `images/` 사진을 올리고 박스를 지웁니다.",
        "5. 태그를 붙이고, 발행 전 모바일 미리보기로 한 번 읽습니다.",
        "",
        "> 하루에 여러 개를 몰아서 올리지 마세요. 발행 간격이 짧으면 그 자체가 어뷰징 신호입니다.",
        "> 자세한 이유는 `docs/naver-risk.md` 에 정리해뒀습니다.",
    ]
    return "\n".join(lines)
