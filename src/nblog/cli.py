"""명령줄 인터페이스.

  python -m nblog build "제주도 렌트카" -i ./사진        ← 이거 하나면 됩니다
  python -m nblog keyword "제주도 렌트카"
  python -m nblog serp "제주도 렌트카"
  python -m nblog images ./사진 -k "제주도 렌트카"
  python -m nblog audit out/.../post.md --plan out/.../plan.json
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

from .audit import audit
from .config import MissingCredentials, Settings
from .draft import DraftResult, generate_draft
from .images import ImageReport, process_images
from .naver import OpenApiClient, SearchAdClient
from .render import write_package
from .research import PostPlan, SerpInsight, analyze_serp, build_plan


def _err(message: str) -> int:
    print(f"\n{message}\n", file=sys.stderr)
    return 1


# ---------------------------------------------------------------------------
# keyword
# ---------------------------------------------------------------------------


def cmd_keyword(args: argparse.Namespace) -> int:
    settings = Settings.load()
    client = SearchAdClient(settings)
    stats = client.related_keywords(args.keyword, limit=args.limit)
    if not stats:
        return _err(f"'{args.keyword}' 에 대한 연관 키워드가 없습니다.")

    openapi = OpenApiClient(settings) if settings.has_openapi else None
    if openapi:
        for stat in stats[: args.docs]:
            try:
                stat.blog_docs = openapi.total_docs(stat.keyword)
            except RuntimeError as exc:
                print(f"(문서수 조회 중단: {exc})", file=sys.stderr)
                break
    else:
        print("(오픈API 키가 없어 문서수/진입난이도는 비어 있습니다)\n", file=sys.stderr)

    print(f"\n'{args.keyword}' 연관 키워드 {len(stats)}개\n")
    print(f"{'키워드':<24} {'월검색량':>9} {'모바일':>6} {'문서수':>10} {'문서/검색':>9}  난이도")
    print("-" * 78)
    for stat in stats:
        docs = f"{stat.blog_docs:,}" if stat.blog_docs else "-"
        ratio = "-" if stat.doc_ratio is None else f"{stat.doc_ratio:.1f}"
        print(
            f"{stat.keyword[:23]:<24} {stat.total_searches:>9,} {stat.mobile_ratio:>5.0%} "
            f"{docs:>10} {ratio:>9}  {stat.grade}"
        )
    print("\n문서/검색 비율이 낮을수록 진입이 쉽습니다 (수요는 있고 글은 적음).\n")
    return 0


# ---------------------------------------------------------------------------
# serp
# ---------------------------------------------------------------------------


def cmd_serp(args: argparse.Namespace) -> int:
    settings = Settings.load()
    serp = OpenApiClient(settings).search_blog(args.keyword, display=args.display)
    insight = analyze_serp(serp, args.keyword)

    print(f"\n'{args.keyword}' 상위 노출 분석")
    print(f"  블로그 총 문서수  {insight.total_docs:,}건")
    print(f"  분석 표본        상위 {insight.sample_size}개")
    print(f"  제목 길이        평균 {insight.avg_title_len}자 / 중앙값 {insight.median_title_len}자")
    print(f"  제목에 숫자      {insight.pct_title_has_number:.0%}")
    print(f"  제목에 괄호      {insight.pct_title_has_bracket:.0%}")
    print(f"  후킹어(방법/후기) {insight.pct_title_has_hook:.0%}")
    print(f"  키워드 그대로    {insight.pct_keyword_in_title:.0%}")
    print(f"  평균 작성        {insight.avg_days_old:.0f}일 전 (3개월 내 {insight.pct_within_90days:.0%})")
    print(f"  → {insight.freshness_verdict}")

    print("\n  상위 글 제목")
    for i, post in enumerate(serp.posts[:15], 1):
        naver = "N" if post.is_naver_blog else " "
        print(f"   {i:>2}. [{naver}] {post.title[:60]}")

    if insight.common_words:
        print("\n  제목에 자주 쓰인 단어")
        print("   " + ", ".join(f"{w}({c})" for w, c in insight.common_words))
    print()
    return 0


# ---------------------------------------------------------------------------
# images
# ---------------------------------------------------------------------------


def cmd_images(args: argparse.Namespace) -> int:
    out_dir = Path(args.out)
    report = process_images(
        [Path(p) for p in args.paths],
        out_dir,
        keyword=args.keyword or "image",
        max_width=args.max_width,
    )
    if not report.images:
        return _err("처리할 이미지가 없습니다. 경로를 확인하세요.")

    print(f"\n{len(report.images)}장 처리 → {out_dir}\n")
    for img in report.images:
        dup = f"  ⚠️ #{img.duplicate_of} 와 중복" if img.duplicate_of else ""
        print(f"  {img.output.name}  {img.width}×{img.height}  {img.size_kb}KB{dup}")
    for warning in report.warnings:
        print(f"\n  ⚠️  {warning}")
    for path, reason in report.skipped:
        print(f"\n  건너뜀: {path} — {reason}")
    print()
    return 0


# ---------------------------------------------------------------------------
# plan
# ---------------------------------------------------------------------------


def _print_plan(plan: PostPlan) -> None:
    print(f"\n'{plan.main_keyword}' 설계안")
    print(f"  목표 분량   {plan.target_chars:,}자")
    print(f"  목표 사진   {plan.target_images}장")
    print(f"  키워드 횟수 {plan.target_keyword_count}회")
    print(f"  서브 키워드 {', '.join(plan.sub_keywords) or '-'}")
    print("\n  제목 후보")
    for i, title in enumerate(plan.recommended_titles, 1):
        print(f"   {i}. {title}")
    print("\n  구성")
    for i, section in enumerate(plan.outline, 1):
        print(f"   {i}. {section}")
    for note in plan.notes:
        print(f"\n  ℹ️  {note}")
    print()


def cmd_plan(args: argparse.Namespace) -> int:
    settings = Settings.load()
    if not (settings.has_openapi or settings.has_searchad):
        return _err(
            "네이버 API 키가 하나도 없습니다. .env.example 을 .env 로 복사해 채우세요.\n"
            "  검색광고 API: https://searchad.naver.com (도구 > API 사용 관리)\n"
            "  오픈API:      https://developers.naver.com/apps/#/register"
        )
    plan = build_plan(args.keyword, settings, serp_display=args.display)
    _print_plan(plan)
    if args.json:
        Path(args.json).write_text(
            json.dumps(plan.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"  → {args.json}\n")
    return 0


# ---------------------------------------------------------------------------
# build (원스톱)
# ---------------------------------------------------------------------------


def cmd_build(args: argparse.Namespace) -> int:
    settings = Settings.load()
    if not (settings.has_openapi or settings.has_searchad):
        return _err(
            "네이버 API 키가 하나도 없습니다. .env.example 을 .env 로 복사해 채우세요.\n"
            "  검색광고 API: https://searchad.naver.com (도구 > API 사용 관리)\n"
            "  오픈API:      https://developers.naver.com/apps/#/register"
        )

    print(f"\n[1/4] '{args.keyword}' 리서치 중...")
    plan = build_plan(args.keyword, settings, serp_display=args.display)
    if plan.insight.sample_size:
        print(f"      상위 {plan.insight.sample_size}개 분석 완료 "
              f"(총 문서 {plan.insight.total_docs:,}건)")
    for note in plan.notes:
        print(f"      ℹ️  {note}")

    images: ImageReport | None = None
    if args.images:
        print(f"\n[2/4] 사진 최적화 중...")
        staging = Path(args.out) / ".staging-images"
        images = process_images(
            [Path(p) for p in args.images], staging, keyword=args.keyword, max_width=args.max_width
        )
        print(f"      {len(images.images)}장 처리")
        for warning in images.warnings:
            print(f"      ⚠️  {warning}")
    else:
        print(f"\n[2/4] 사진 없음 — `-i ./사진폴더` 로 넘기면 함께 처리합니다.")

    print(f"\n[3/4] 초안 작성 중{' (Claude API)' if settings.has_anthropic else ''}...")
    draft: DraftResult = generate_draft(plan, settings, images)
    if draft.generated_by == "prompt-only":
        print("      ANTHROPIC_API_KEY 가 없어 프롬프트만 만들었습니다 (prompt.md)")

    report = audit(draft.markdown, plan, image_count=len(images.images) if images else None)

    print(f"\n[4/4] 산출물 정리 중...")
    package = write_package(Path(args.out), plan, draft, images, report)

    # 스테이징된 사진을 패키지 안으로 이동
    if images:
        final_dir = package.root / "images"
        final_dir.mkdir(exist_ok=True)
        for img in images.images:
            target = final_dir / img.output.name
            img.output.replace(target)
            img.output = target
        staging_dir = Path(args.out) / ".staging-images"
        if staging_dir.exists() and not any(staging_dir.iterdir()):
            staging_dir.rmdir()
        # 사진 경로가 바뀌었으니 guide/html 을 다시 쓴다
        package = write_package(Path(args.out), plan, draft, images, report)

    print(f"\n완료 → {package.root}\n")
    for path in sorted(package.files):
        print(f"  {path.relative_to(package.root)}")
    if images:
        print(f"  images/  ({len(images.images)}장)")

    print(f"\n{'─' * 60}")
    if draft.generated_by == "prompt-only":
        # 뼈대만 있는 상태라 품질 검사가 통과할 수 없다. 이걸 실패로 보이게 두면 오해를 준다.
        print("초안 없이 뼈대만 만들었으므로 품질 검사는 건너뜁니다.")
        print("prompt.md 를 Claude 에 붙여넣어 본문을 받은 뒤 post.md 에 저장하고,")
        print(f"  python -m nblog audit {package.root / 'post.md'} --write")
        print("로 검사하세요.")
    else:
        print(f"본문 {report.char_count:,}자 · 키워드 {report.keyword_count}회 "
              f"· 밀도 {report.keyword_density:.2f}%")
        if report.errors:
            print(f"\n❌ 발행 전 해결할 항목 {len(report.errors)}개")
            for check in report.errors:
                print(f"   - {check.label}: {check.detail}")
        if report.warnings:
            print(f"\n⚠️  확인할 항목 {len(report.warnings)}개")
            for check in report.warnings:
                print(f"   - {check.label}: {check.detail}")

    print(f"\n다음 순서")
    print(f"  1. {package.root / 'post.md'} 에서 {{{{직접 채우기}}}} 를 채우세요")
    print(f"  2. {package.root / 'post.html'} 을 브라우저로 열어 복사")
    print(f"  3. 스마트에디터에 붙여넣고 images/ 사진 업로드 → 발행")
    print(f"\n  ⚠️  자동 발행은 넣지 않았습니다. 이유: docs/naver-risk.md\n")
    return 0


# ---------------------------------------------------------------------------
# audit
# ---------------------------------------------------------------------------


def cmd_audit(args: argparse.Namespace) -> int:
    md_path = Path(args.markdown)
    if not md_path.exists():
        return _err(f"파일이 없습니다: {md_path}")
    markdown = md_path.read_text(encoding="utf-8")

    plan_path = Path(args.plan) if args.plan else md_path.parent / "plan.json"
    if not plan_path.exists():
        return _err(
            f"plan.json 을 찾을 수 없습니다: {plan_path}\n  --plan 으로 경로를 지정하세요."
        )

    raw = json.loads(plan_path.read_text(encoding="utf-8"))
    insight = SerpInsight(**raw.pop("insight"))
    plan = PostPlan(insight=insight, **raw)

    image_dir = md_path.parent / "images"
    image_count = len(list(image_dir.glob("*"))) if image_dir.is_dir() else None

    report = audit(markdown, plan, image_count=image_count)
    print()
    print(report.to_markdown())
    print()

    if args.write:
        target = md_path.parent / "checklist.md"
        target.write_text(report.to_markdown(), encoding="utf-8")
        print(f"→ {target}\n")
    return 0 if report.publishable else 2


# ---------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="nblog",
        description="네이버 블로그 포스팅 준비 도구 — 발행 직전까지 자동화합니다.",
        epilog="자동 발행 기능은 의도적으로 넣지 않았습니다. docs/naver-risk.md 를 읽어보세요.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("build", help="원스톱: 리서치 + 사진 + 초안 + 체크리스트")
    p.add_argument("keyword", help="메인 키워드")
    p.add_argument("-i", "--images", nargs="*", default=[], help="사진 파일 또는 폴더")
    p.add_argument("-o", "--out", default="out", help="출력 폴더 (기본 out)")
    p.add_argument("--display", type=int, default=30, help="분석할 상위 글 수 (기본 30)")
    p.add_argument("--max-width", type=int, default=1600, help="사진 최대 가로폭")
    p.set_defaults(func=cmd_build)

    p = sub.add_parser("keyword", help="연관 키워드 + 검색량 + 진입난이도")
    p.add_argument("keyword")
    p.add_argument("--limit", type=int, default=40)
    p.add_argument("--docs", type=int, default=15, help="문서수를 조회할 상위 N개 (기본 15)")
    p.set_defaults(func=cmd_keyword)

    p = sub.add_parser("serp", help="상위 노출 글 역분석")
    p.add_argument("keyword")
    p.add_argument("--display", type=int, default=30)
    p.set_defaults(func=cmd_serp)

    p = sub.add_parser("images", help="사진 최적화만")
    p.add_argument("paths", nargs="+", help="사진 파일 또는 폴더")
    p.add_argument("-o", "--out", default="out/images")
    p.add_argument("-k", "--keyword", default="", help="파일명에 쓸 키워드")
    p.add_argument("--max-width", type=int, default=1600)
    p.set_defaults(func=cmd_images)

    p = sub.add_parser("plan", help="설계안만 (초안 없이)")
    p.add_argument("keyword")
    p.add_argument("--display", type=int, default=30)
    p.add_argument("--json", help="설계안을 JSON 으로 저장할 경로")
    p.set_defaults(func=cmd_plan)

    p = sub.add_parser("audit", help="작성한 글을 발행 전 검사")
    p.add_argument("markdown", help="post.md 경로")
    p.add_argument("--plan", help="plan.json 경로 (기본: 같은 폴더)")
    p.add_argument("--write", action="store_true", help="checklist.md 를 갱신")
    p.set_defaults(func=cmd_audit)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except MissingCredentials as exc:
        return _err(str(exc))
    except RuntimeError as exc:
        return _err(f"오류: {exc}")
    except KeyboardInterrupt:
        return _err("중단됨")


if __name__ == "__main__":
    raise SystemExit(main())
