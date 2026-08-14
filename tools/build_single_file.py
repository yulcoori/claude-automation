#!/usr/bin/env python3
"""index.html을 파일 하나로 합칩니다.

CSS·JS·폰트를 모두 data URI로 심어 넣기 때문에, 결과물은 외부 요청 없이
그대로 열리거나 어디에나 붙여 넣을 수 있습니다.

    python3 tools/build_single_file.py              # dist/index.html
    python3 tools/build_single_file.py --body-only  # <body> 안쪽만 (임베드용)
"""

import argparse
import base64
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "index.html"
CSS = ROOT / "assets" / "css" / "styles.css"
JS = ROOT / "assets" / "js" / "main.js"
FONT_DIR = ROOT / "assets" / "fonts"


def font_data_uri(name: str) -> str:
    encoded = base64.b64encode((FONT_DIR / name).read_bytes()).decode("ascii")
    return "data:font/woff2;base64," + encoded


def inline_fonts(css: str) -> str:
    """@font-face의 ../fonts/*.woff2 경로를 data URI로 바꿉니다."""

    def swap(match: "re.Match[str]") -> str:
        filename = match.group(1)
        path = FONT_DIR / filename
        if not path.exists():
            sys.exit("폰트 파일을 찾을 수 없습니다: " + str(path))
        return 'url("' + font_data_uri(filename) + '")'

    return re.sub(r'url\("\.\./fonts/([^"]+)"\)', swap, css)


def build(body_only: bool) -> str:
    html = SOURCE.read_text(encoding="utf-8")
    css = inline_fonts(CSS.read_text(encoding="utf-8"))
    js = JS.read_text(encoding="utf-8")

    # 폰트를 심어 넣으면 preload와 외부 stylesheet 링크는 필요 없습니다.
    html = re.sub(r'\s*<link rel="preload"[^>]*>', "", html)
    html = html.replace(
        '<link rel="stylesheet" href="assets/css/styles.css">',
        "<style>\n" + css + "\n</style>",
    )
    html = html.replace(
        '<script src="assets/js/main.js"></script>',
        "<script>\n" + js + "\n</script>",
    )

    if not body_only:
        return html

    # <body> 안쪽 + <title>/<style>만 남깁니다. 감싸는 문서는 호스트가 붙입니다.
    title = re.search(r"<title>(.*?)</title>", html, re.S)
    style = re.search(r"<style>.*?</style>", html, re.S)
    body = re.search(r"<body>(.*)</body>", html, re.S)
    if not (title and style and body):
        sys.exit("문서 구조를 읽지 못했습니다.")

    return "<title>%s</title>\n%s\n%s\n" % (
        title.group(1),
        style.group(0),
        body.group(1).strip(),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--body-only",
        action="store_true",
        help="<body> 안쪽만 출력합니다 (다른 문서에 끼워 넣을 때).",
    )
    parser.add_argument(
        "-o",
        "--output",
        default=None,
        help="저장할 경로 (기본값: dist/index.html).",
    )
    args = parser.parse_args()

    output = pathlib.Path(args.output) if args.output else ROOT / "dist" / "index.html"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(build(args.body_only), encoding="utf-8")

    size = output.stat().st_size
    print("%s (%.0f KB)" % (output, size / 1024))


if __name__ == "__main__":
    main()
