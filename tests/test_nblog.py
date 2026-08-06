"""네트워크를 타지 않는 부분에 대한 테스트."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pytest
from PIL import Image

from nblog.audit import audit
from nblog.draft import build_prompt
from nblog.images import process_images, slugify
from nblog.naver import BlogPost, KeywordStat, SerpResult, _parse_count, strip_tags
from nblog.render import _md_to_html, write_package
from nblog.draft import DraftResult
from nblog.research import analyze_serp, build_plan
from nblog.config import Settings


TODAY = date(2026, 8, 6)


def _serp(titles: list[str], dates: list[str] | None = None) -> SerpResult:
    dates = dates or ["20260701"] * len(titles)
    return SerpResult(
        query="제주도 렌트카",
        total=1_204_331,
        posts=[
            BlogPost(title=t, link="https://blog.naver.com/x/1", description="", blogger="b", postdate=d)
            for t, d in zip(titles, dates)
        ],
    )


# ---------------------------------------------------------------------------
# naver.py
# ---------------------------------------------------------------------------


def test_parse_count_handles_under_ten_string():
    # 검색광고 API 는 10 미만 검색량을 '< 10' 문자열로 준다
    assert _parse_count("< 10") == 10
    assert _parse_count(74200) == 74200
    assert _parse_count(None) == 0
    assert _parse_count("1,240") == 1240


def test_strip_tags_removes_highlight_and_entities():
    assert strip_tags("<b>제주도</b> 렌트카 &amp; 보험") == "제주도 렌트카 & 보험"


def test_keyword_grade_uses_doc_to_search_ratio():
    easy = KeywordStat("a", 300, 700, "낮음", 3, blog_docs=400)  # ratio 0.4
    hard = KeywordStat("b", 300, 700, "높음", 15, blog_docs=90_000)  # ratio 90
    thin = KeywordStat("c", 10, 20, "낮음", 0, blog_docs=5)
    assert easy.grade == "매우좋음"
    assert hard.grade == "매우어려움"
    assert thin.grade == "검색량부족"


# ---------------------------------------------------------------------------
# research.py
# ---------------------------------------------------------------------------


def test_analyze_serp_extracts_title_patterns():
    insight = analyze_serp(
        _serp(
            [
                "제주도 렌트카 5곳 비교 후기",
                "[2026] 제주도 렌트카 가격 총정리",
                "제주도 렌트카 예약 방법 정리",
                "여행 준비물 체크리스트",
            ],
            ["20260801", "20260715", "20250101", "20240101"],
        ),
        "제주도 렌트카",
        today=TODAY,
    )
    assert insight.sample_size == 4
    assert insight.pct_keyword_in_title == 0.75
    # 숫자가 있는 건 "5곳" 과 "[2026]" 두 개뿐
    assert insight.pct_title_has_number == 0.5
    assert insight.pct_title_has_bracket == 0.25
    assert insight.pct_title_has_hook == 0.75
    assert insight.pct_within_90days == 0.5
    assert insight.median_title_len > 0


def test_analyze_serp_survives_empty_results():
    insight = analyze_serp(SerpResult(query="x", total=0), "x")
    assert insight.sample_size == 0
    assert insight.avg_title_len == 0.0
    assert "누적" in insight.freshness_verdict


def test_analyze_serp_ignores_malformed_dates():
    insight = analyze_serp(_serp(["제주도 렌트카 후기"], ["not-a-date"]), "제주도 렌트카", today=TODAY)
    assert insight.avg_days_old == 0.0
    assert insight.pct_within_90days == 0.0


def test_build_plan_without_any_keys_still_produces_plan(monkeypatch):
    monkeypatch.setattr("nblog.research.Settings", Settings)
    plan = build_plan("제주도 렌트카", Settings())
    assert plan.main_keyword == "제주도 렌트카"
    assert plan.recommended_titles
    assert plan.outline
    assert plan.target_chars >= 1500
    # 키가 없으면 그 사실이 notes 에 남아야 한다
    assert len(plan.notes) == 2


def test_plan_keyword_count_stays_in_safe_range():
    plan = build_plan("제주도 렌트카", Settings())
    # 키워드 스터핑 방지: 밀도 2% 를 넘길 만큼 많이 권하지 않는다
    assert 4 <= plan.target_keyword_count <= 10


# ---------------------------------------------------------------------------
# images.py
# ---------------------------------------------------------------------------


def test_slugify_keeps_korean_drops_specials():
    assert slugify("제주도 렌트카 추천!") == "제주도-렌트카-추천"
    assert slugify("///") == "image"


def _make_image(path: Path, size=(3000, 2000), color=(120, 80, 40)) -> None:
    Image.new("RGB", size, color).save(path, "JPEG")


def test_process_images_resizes_renames_and_flags_duplicates(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    _make_image(src / "a.jpg")
    _make_image(src / "b.jpg", color=(10, 200, 90))
    # c 는 a 와 같은 사진 (크기만 다름) → 중복으로 잡혀야 한다
    Image.new("RGB", (1000, 667), (120, 80, 40)).save(src / "c.jpg", "JPEG")

    report = process_images([src], tmp_path / "out", keyword="제주도 렌트카", max_width=1600)

    assert len(report.images) == 3
    assert [i.output.name for i in report.images] == [
        "제주도-렌트카-01.jpg",
        "제주도-렌트카-02.jpg",
        "제주도-렌트카-03.jpg",
    ]
    assert all(i.width <= 1600 and i.height <= 1600 for i in report.images)
    assert report.images[2].duplicate_of == 1
    assert any("중복" in w for w in report.warnings)


def test_distinct_flat_images_are_not_duplicates(tmp_path):
    """단색 사진들은 밝기 변화가 없어 average hash 로는 전부 같게 나온다.
    색상까지 봐야 구분된다 — 이게 안 되면 정상 사진을 중복으로 오판한다."""
    src = tmp_path / "src"
    src.mkdir()
    for i, color in enumerate(
        [(200, 120, 60), (60, 140, 200), (90, 200, 120), (220, 200, 80)], 1
    ):
        Image.new("RGB", (1200, 900), color).save(src / f"IMG_{i}.jpg", "JPEG")

    report = process_images([src], tmp_path / "out", keyword="k")
    assert len(report.images) == 4
    assert report.duplicates == []
    assert not any("중복" in w for w in report.warnings)


def test_same_photo_recompressed_is_detected_as_duplicate(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    # 사진처럼 밝기 변화가 있는 이미지를 만든다
    base = Image.new("RGB", (900, 600))
    base.putdata([((x * 7) % 256, (y * 5) % 256, (x + y) % 256) for y in range(600) for x in range(900)])
    base.save(src / "a.jpg", "JPEG", quality=95)
    base.resize((450, 300)).save(src / "b.jpg", "JPEG", quality=70)

    report = process_images([src], tmp_path / "out", keyword="k")
    assert report.images[1].duplicate_of == 1


def test_process_images_strips_exif(tmp_path):
    src = tmp_path / "p.jpg"
    _make_image(src, size=(800, 600))
    report = process_images([src], tmp_path / "out", keyword="k")
    with Image.open(report.images[0].output) as out:
        assert not out.getexif()


def test_process_images_reports_unreadable_paths(tmp_path):
    report = process_images([tmp_path / "없는폴더"], tmp_path / "out")
    assert report.skipped
    assert not report.images


def test_process_images_preserves_alpha_as_png(tmp_path):
    src = tmp_path / "logo.png"
    Image.new("RGBA", (500, 500), (0, 0, 0, 0)).save(src)
    report = process_images([src], tmp_path / "out", keyword="k")
    assert report.images[0].output.suffix == ".png"


# ---------------------------------------------------------------------------
# audit.py
# ---------------------------------------------------------------------------


def _plan():
    return build_plan("제주도 렌트카", Settings())


def test_audit_blocks_on_unfilled_placeholders():
    plan = _plan()
    md = "# 제주도 렌트카 후기\n\n" + ("제주도 렌트카를 빌렸습니다. " * 60) + "\n\n{{직접 채우기: 가격}}"
    report = audit(md, plan)
    assert not report.publishable
    assert any(c.label == "미완성 자리 남음" for c in report.errors)


def test_audit_flags_keyword_stuffing():
    plan = _plan()
    md = "# 제주도 렌트카\n\n" + ("제주도 렌트카 " * 200)
    report = audit(md, plan)
    assert report.keyword_density > 2.5
    assert any("스터핑" in c.label for c in report.errors)


def test_audit_flags_short_post():
    report = audit("# 제주도 렌트카\n\n짧은 글입니다.\n\n[사진1]", _plan())
    assert any(c.label == "분량 부족" for c in report.errors)


def test_audit_passes_a_reasonable_post():
    """설계안이 권하는 그대로 쓴 글은 검사를 통과해야 한다.

    planner 가 권하는 키워드 횟수를 audit 이 스터핑으로 잡으면 도구가 자기모순이 된다."""
    plan = _plan()
    # 목표 분량을 넉넉히 넘기고, 키워드는 소제목(outline)에 이미 들어간 만큼만 둔다
    filler = "제주도 여행 준비를 하면서 실제로 확인한 내용을 순서대로 정리해봤습니다. "
    body = "\n\n".join(f"## {section}\n\n" + filler * 12 for section in plan.outline)
    md = (
        "# 제주도 렌트카 고를 때 확인한 5가지\n\n"
        + body
        + "\n\n"
        + "\n\n".join(f"[사진{i}]" for i in range(1, plan.target_images + 1))
    )
    # 설계안이 권한 횟수에 정확히 맞춘다 (소제목에 이미 들어간 만큼을 빼고 보충)
    shortfall = plan.target_keyword_count - md.replace(" ", "").count("제주도렌트카")
    md += "\n\n" + "제주도 렌트카 예약 이야기를 덧붙입니다.\n\n" * max(0, shortfall)

    report = audit(md, plan)
    assert report.publishable, [f"{c.label}: {c.detail}" for c in report.errors]
    assert report.char_count >= plan.target_chars
    # 설계안이 권한 횟수를 그대로 넣었을 때 밀도가 경고선 아래여야 한다
    assert report.keyword_count >= plan.target_keyword_count
    assert report.keyword_density <= 2.0


def test_audit_flags_risky_claims_and_missing_disclosure():
    plan = _plan()
    md = (
        "# 제주도 렌트카 후기\n\n"
        + "이 업체는 100% 보장 최저가 보장입니다. " * 5
        + "제주도 렌트카를 협찬받아 이용했습니다. " * 5
        + "제주도 렌트카 이야기입니다. " * 40
        + "\n\n[사진1]"
    )
    report = audit(md, plan)
    labels = [c.label for c in report.checks]
    assert "과장·단정 표현" in labels
    assert "협찬 표기 확인 필요" in labels


def test_audit_ignores_code_blocks_when_counting():
    plan = _plan()
    md = "# 제주도 렌트카\n\n```\n제주도 렌트카 제주도 렌트카 제주도 렌트카\n```\n\n짧은 본문."
    report = audit(md, plan)
    # 코드블록 안의 키워드는 세지 않는다
    assert report.keyword_count == 1


# ---------------------------------------------------------------------------
# draft.py / render.py
# ---------------------------------------------------------------------------


def test_build_prompt_includes_limits_and_outline():
    plan = _plan()
    prompt = build_prompt(plan)
    assert plan.main_keyword in prompt
    assert f"{plan.target_keyword_count}회" in prompt
    assert str(plan.target_chars) in prompt
    assert plan.outline[0] in prompt


def test_md_to_html_converts_photo_slots(tmp_path):
    src = tmp_path / "a.jpg"
    _make_image(src, size=(600, 400))
    images = process_images([src], tmp_path / "out", keyword="제주도")
    html_out = _md_to_html("# 제목\n\n## 소제목\n\n본문입니다.\n\n[사진1] 렌트카 외관", images)
    assert "<h2>제목</h2>" in html_out
    assert "<h3>소제목</h3>" in html_out
    assert "제주도-01.jpg" in html_out
    assert "렌트카 외관" in html_out


def test_md_to_html_escapes_html_in_body():
    out = _md_to_html("본문에 <script>alert(1)</script> 가 있습니다.", None)
    assert "<script>" not in out
    assert "&lt;script&gt;" in out


def test_write_package_creates_all_files(tmp_path):
    plan = _plan()
    md = "# 제주도 렌트카\n\n## 소제목\n\n본문입니다.\n\n[사진1]"
    draft = DraftResult(markdown=md, prompt="프롬프트", generated_by="prompt-only")
    report = audit(md, plan)
    package = write_package(tmp_path, plan, draft, None, report, today=TODAY)

    names = {p.name for p in package.files}
    assert {"post.md", "post.html", "checklist.md", "prompt.md", "plan.json", "guide.md"} <= names
    assert package.root.name == "제주도-렌트카-2026-08-06"
    assert "발행 전 체크리스트" in (package.root / "checklist.md").read_text(encoding="utf-8")


def test_plan_json_roundtrips(tmp_path):
    """audit 서브커맨드가 plan.json 을 다시 읽을 수 있어야 한다."""
    import json

    from nblog.research import PostPlan, SerpInsight

    plan = _plan()
    raw = json.loads(json.dumps(plan.to_dict(), ensure_ascii=False))
    insight = SerpInsight(**raw.pop("insight"))
    restored = PostPlan(insight=insight, **raw)
    assert restored.main_keyword == plan.main_keyword
    assert restored.target_keyword_count == plan.target_keyword_count


# ---------------------------------------------------------------------------
# cli.py — 발행 기능이 없다는 것 자체를 테스트로 고정
# ---------------------------------------------------------------------------


def test_cli_exposes_no_publish_command():
    from nblog.cli import build_parser

    parser = build_parser()
    actions = [a for a in parser._actions if hasattr(a, "choices") and a.choices]
    commands = set(actions[0].choices) if actions else set()
    assert commands == {"web", "build", "keyword", "serp", "images", "plan", "audit"}
    for banned in ("publish", "post", "upload", "login"):
        assert banned not in commands


def test_no_browser_automation_dependency():
    """selenium/playwright 계열이 들어오면 이 테스트가 깨지도록 둔다."""
    text = Path("requirements.txt").read_text(encoding="utf-8").lower()
    for banned in ("selenium", "playwright", "puppeteer", "undetected", "pyautogui"):
        assert banned not in text


def test_build_plan_survives_openapi_failure(monkeypatch):
    """오픈API 가 401 을 줘도 검색광고 데이터로 계속 진행해야 한다.

    네이버가 2026-07-31 부터 검색 API 신규 신청을 차단했으므로,
    막힌 키를 들고 있는 사용자가 흔하다. 이때 전체가 멈추면 도구를 못 쓴다."""
    from nblog import research

    class BoomOpenApi:
        def __init__(self, settings):
            raise RuntimeError("오픈API 인증 실패(401)")

    monkeypatch.setattr(research, "OpenApiClient", BoomOpenApi)
    settings = Settings(client_id="x", client_secret="y")

    plan = research.build_plan("광주샐러드", settings)

    assert plan.main_keyword == "광주샐러드"
    assert plan.recommended_titles
    assert plan.outline
    assert any("오픈API" in n for n in plan.notes)


def test_missing_doc_count_is_not_reported_as_easy():
    """문서수를 조회하지 못한 키워드를 '매우좋음'으로 표시하면
    사용자를 가장 경쟁이 치열한 키워드로 보내게 된다."""
    unmeasured = KeywordStat("광주미용실", 1_400, 10_160, "높음", 15)  # blog_docs 기본값 0
    assert unmeasured.blog_docs == 0
    assert unmeasured.doc_ratio is None
    assert unmeasured.grade == "측정불가"

    measured_zero_docs = KeywordStat("아무도안쓴키워드", 100, 200, "낮음", 0, blog_docs=1)
    assert measured_zero_docs.doc_ratio is not None
    assert measured_zero_docs.grade == "매우좋음"


def test_tags_have_no_duplicates():
    """서브 키워드와 롱테일이 겹쳐도 태그는 한 번만 나와야 한다."""
    from nblog.research import PostPlan, SerpInsight, build_plan

    plan = build_plan("풍암동미용실", Settings())
    assert len(plan.tags) == len(set(plan.tags))


def test_unmeasured_keywords_rank_by_specificity_not_volume(monkeypatch):
    """문서수를 모를 때 검색량 순으로 추천하면 가장 어려운 키워드를 권하게 된다."""
    from nblog import research

    stats = [
        KeywordStat("광주미용실", 1_400, 10_160, "높음", 15),      # 검색량 최대, 짧음
        KeywordStat("풍암동미용실근처추천", 100, 300, "낮음", 2),   # 검색량 최소, 구체적
    ]

    class FakeSearchAd:
        def __init__(self, settings):
            pass

        def related_keywords(self, seed, limit=40):
            return stats

    monkeypatch.setattr(research, "SearchAdClient", FakeSearchAd)
    settings = Settings(ad_api_key="a", ad_secret_key="b", ad_customer_id="c")

    plan = research.build_plan("풍암동미용실", settings)

    # 구체적인 쪽이 먼저 추천되어야 한다
    assert plan.sub_keywords[0] == "풍암동미용실근처추천"
    assert any("경쟁도 치열" in n for n in plan.notes)


# ---------------------------------------------------------------------------
# context.py — 매장 정보
# ---------------------------------------------------------------------------


def test_context_separates_filled_from_missing():
    from nblog.context import PostContext

    ctx = PostContext(shop_name="OO헤어", price="12만원")
    assert ctx.filled() == {"업체명": "OO헤어", "가격": "12만원"}
    assert "위치" in ctx.missing_labels()
    assert "업체명" not in ctx.missing_labels()
    assert not ctx.is_empty
    assert PostContext().is_empty


def test_context_prompt_tells_model_not_to_invent_missing_values():
    from nblog.context import PostContext

    block = PostContext(shop_name="OO헤어", price="12만원").as_prompt_block()
    assert "OO헤어" in block
    assert "12만원" in block
    # 없는 값을 지어내지 말라는 지시가 반드시 있어야 한다
    assert "지어내지" in block
    assert "직접 채우기" in block


def test_context_stance_changes_voice_label():
    from nblog.context import PostContext

    assert "손님" in PostContext().stance_label
    assert "사장" in PostContext(stance="owner").stance_label
    assert PostContext(stance="owner").is_owner


def test_context_roundtrips_and_ignores_unknown_keys():
    from nblog.context import PostContext

    ctx = PostContext(shop_name="OO헤어", extra="메모")
    restored = PostContext.from_dict({**ctx.to_dict(), "존재하지않는키": "x"})
    assert restored.shop_name == "OO헤어"
    assert restored.extra == "메모"


def test_shop_info_reaches_prompt_and_skeleton():
    """매장 정보를 넣었으면 초안 뼈대에도 그대로 실려야 한다.
    이게 안 되면 사용자가 정보를 두 번 입력하게 된다."""
    from nblog.context import PostContext
    from nblog.draft import _prompt_only_placeholder, build_prompt

    plan = _plan()
    ctx = PostContext(shop_name="OO헤어", price="12만원", location="풍암동")

    prompt = build_prompt(plan, None, ctx)
    assert "OO헤어" in prompt and "12만원" in prompt

    skeleton = _prompt_only_placeholder(plan, prompt, ctx)
    assert "OO헤어" in skeleton
    assert "12만원" in skeleton
    # 제목에 업체명이 반영된다
    assert skeleton.splitlines()[0].startswith("# ") and "OO헤어" in skeleton.splitlines()[0]


def test_build_prompt_without_context_still_works():
    """매장 정보가 없어도 기존 동작이 깨지지 않아야 한다."""
    from nblog.draft import build_prompt

    plan = _plan()
    prompt = build_prompt(plan)
    assert plan.main_keyword in prompt
    assert "글 쓰는 사람의 입장" not in prompt


# ---------------------------------------------------------------------------
# webapp.py — 브라우저 화면
# ---------------------------------------------------------------------------


@pytest.fixture
def web_client(tmp_path, monkeypatch):
    """네이버·Claude 호출만 대체하고 나머지는 실제 코드로 띄운다."""
    from fastapi.testclient import TestClient

    from nblog import webapp
    from nblog.naver import SerpResult
    from nblog.research import PostPlan, _build_outline, _build_titles, analyze_serp

    monkeypatch.chdir(tmp_path)

    def fake_plan(keyword, settings, **kw):
        insight = analyze_serp(SerpResult(query=keyword, total=0), keyword)
        subs = ["매직"]
        return PostPlan(
            main_keyword=keyword, sub_keywords=subs, long_tail=[],
            recommended_titles=_build_titles(keyword, insight, subs),
            outline=_build_outline(keyword, subs, insight),
            target_chars=1700, target_images=8, target_keyword_count=4,
            tags=[keyword] + subs, insight=insight, keyword_table=[], notes=[],
        )

    def fake_stream(plan, settings, images=None, context=None, **kw):
        yield f"# {plan.main_keyword} 후기\n\n"
        if context and context.shop_name:
            yield f"{context.shop_name} 에 갔습니다.\n\n"
        yield "[사진1]\n"

    monkeypatch.setattr(webapp, "build_plan", fake_plan)
    monkeypatch.setattr(webapp, "stream_draft", fake_stream)
    monkeypatch.setattr(
        webapp, "Settings",
        type("S", (), {"load": staticmethod(lambda: Settings(anthropic_api_key="k"))}),
    )
    return TestClient(webapp.create_app())


def _read_sse(response) -> list[tuple[str, dict]]:
    import re as _re

    events = []
    buffer = ""
    for chunk in response.iter_text():
        buffer += chunk
        while "\n\n" in buffer:
            part, buffer = buffer.split("\n\n", 1)
            ev = _re.search(r"^event:\s*(.+)$", part, _re.M)
            dt = _re.search(r"^data:\s*([\s\S]+)$", part, _re.M)
            if ev and dt:
                events.append((ev.group(1).strip(), json.loads(dt.group(1))))
    return events


def test_web_index_and_status(web_client):
    page = web_client.get("/")
    assert page.status_code == 200
    assert "글 만들기" in page.text
    # favicon 이 없으면 브라우저 콘솔에 404 가 남는다
    assert web_client.get("/favicon.ico").status_code == 200
    assert web_client.get("/api/status").json()["anthropic"] is True


def test_web_generate_streams_text_without_losing_characters(web_client):
    """SSE 로 쪼개 보낸 글자가 하나도 빠지지 않고 재조립되어야 한다."""
    with web_client.stream(
        "POST", "/api/generate",
        json={"keyword": "풍암동미용실", "context": {"shop_name": "OO헤어"}},
    ) as resp:
        assert resp.status_code == 200
        events = _read_sse(resp)

    body = "".join(d["chunk"] for e, d in events if e == "text")
    assert body == "# 풍암동미용실 후기\n\nOO헤어 에 갔습니다.\n\n[사진1]\n"
    assert [e for e, _ in events if e != "text"][-1] == "done"


def test_web_generate_requires_keyword(web_client):
    assert web_client.post("/api/generate", json={"keyword": "   "}).status_code == 400


def test_web_upload_and_serves_processed_images(web_client):
    import io as _io

    files = []
    for i in range(3):
        buf = _io.BytesIO()
        Image.new("RGB", (2400, 1800), (40 * i + 20, 90, 150)).save(buf, "JPEG")
        buf.seek(0)
        files.append(("files", (f"KakaoTalk_{i}.jpg", buf, "image/jpeg")))

    up = web_client.post("/api/upload", files=files)
    assert up.status_code == 200
    session = up.json()["session"]
    assert up.json()["count"] == 3

    with web_client.stream(
        "POST", "/api/generate",
        json={"keyword": "풍암동미용실", "session": session, "context": {}},
    ) as resp:
        events = _read_sse(resp)

    done = next(d for e, d in events if e == "done")
    assert len(done["images"]) == 3
    # 처리된 사진을 브라우저가 미리보기로 받아갈 수 있어야 한다
    served = web_client.get(f"/api/image/{done['run']}/{done['images'][0]}")
    assert served.status_code == 200
    assert len(served.content) > 0
    assert web_client.get(f"/api/download/{done['run']}").status_code == 200


def test_web_rejects_path_traversal(web_client):
    """run 이름으로 out/ 밖의 파일을 읽어낼 수 없어야 한다."""
    for bad in ["../../etc/passwd", "..", "../.env"]:
        assert web_client.get(f"/api/download/{bad}").status_code == 404
        assert web_client.get(f"/api/image/{bad}/x.jpg").status_code == 404


def test_web_upload_rejects_too_many_files(web_client):
    import io as _io

    from nblog import webapp

    files = []
    for i in range(webapp.MAX_UPLOAD_FILES + 1):
        buf = _io.BytesIO()
        Image.new("RGB", (10, 10), (0, 0, 0)).save(buf, "JPEG")
        buf.seek(0)
        files.append(("files", (f"{i}.jpg", buf, "image/jpeg")))
    assert web_client.post("/api/upload", files=files).status_code == 400
