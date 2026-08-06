"""키워드 리서치 + 상위 노출 글 역분석 → 포스팅 설계안(plan)."""

from __future__ import annotations

import re
import statistics
from dataclasses import asdict, dataclass, field
from datetime import date, datetime

from .config import Settings
from .naver import BlogPost, KeywordStat, OpenApiClient, SearchAdClient, SerpResult

# 상위 노출 글에서 뽑아낼 제목 패턴
_NUM_RE = re.compile(r"\d")
_BRACKET_RE = re.compile(r"[\[\](){}【】]")
_QUESTION_RE = re.compile(r"[?？]|어떻게|방법|추천|후기|비교|정리|총정리|가격|차이")

# 메인 키워드 목표 밀도. audit.py 의 경고선(2%)보다 낮게 잡아 여유를 둔다.
TARGET_DENSITY = 0.015


@dataclass
class SerpInsight:
    """상위 노출 글들이 공통적으로 갖고 있는 형태."""

    query: str
    total_docs: int
    sample_size: int
    avg_title_len: float
    median_title_len: int
    pct_title_has_number: float
    pct_title_has_bracket: float
    pct_title_has_hook: float  # 방법/추천/후기/비교 등
    pct_keyword_in_title: float
    avg_days_old: float
    pct_within_90days: float
    top_titles: list[str] = field(default_factory=list)
    common_words: list[tuple[str, int]] = field(default_factory=list)

    @property
    def freshness_verdict(self) -> str:
        if self.pct_within_90days >= 0.6:
            return "최신성이 중요한 키워드 (상위권 대부분이 최근 3개월 글)"
        if self.pct_within_90days >= 0.3:
            return "최신성이 어느 정도 작용하는 키워드"
        return "오래된 글이 버티는 키워드 (누적 지수가 강한 글과 경쟁해야 함)"


def _days_old(postdate: str, today: date | None = None) -> int | None:
    if not postdate or len(postdate) != 8:
        return None
    try:
        published = datetime.strptime(postdate, "%Y%m%d").date()
    except ValueError:
        return None
    return (( today or date.today()) - published).days


def _tokenize(text: str) -> list[str]:
    """한글/영문/숫자 토큰. 조사까지 정확히 떼려면 형태소 분석기가 필요하지만,
    제목 패턴 파악에는 2글자 이상 토큰 빈도만으로 충분하다."""
    return [t for t in re.findall(r"[가-힣]{2,}|[A-Za-z]{3,}|\d+", text)]


_STOPWORDS = {
    "그리고", "하는", "합니다", "있는", "위한", "대한", "에서", "으로", "하기", "해서",
    "이것", "저것", "그것", "정말", "너무", "진짜", "바로", "다시", "요즘", "오늘",
}


def analyze_serp(serp: SerpResult, keyword: str, today: date | None = None) -> SerpInsight:
    posts: list[BlogPost] = serp.posts
    if not posts:
        return SerpInsight(
            query=serp.query,
            total_docs=serp.total,
            sample_size=0,
            avg_title_len=0.0,
            median_title_len=0,
            pct_title_has_number=0.0,
            pct_title_has_bracket=0.0,
            pct_title_has_hook=0.0,
            pct_keyword_in_title=0.0,
            avg_days_old=0.0,
            pct_within_90days=0.0,
        )

    titles = [p.title for p in posts]
    lengths = [len(t) for t in titles]
    n = len(posts)
    compact_kw = keyword.replace(" ", "")

    ages = [d for d in (_days_old(p.postdate, today) for p in posts) if d is not None]

    word_counts: dict[str, int] = {}
    for title in titles:
        # 한 제목 안에서 같은 단어가 반복돼도 1회로 센다 (문서 빈도)
        for token in set(_tokenize(title)):
            if token in _STOPWORDS or token == compact_kw:
                continue
            word_counts[token] = word_counts.get(token, 0) + 1
    common = sorted(word_counts.items(), key=lambda kv: (-kv[1], kv[0]))
    common = [(w, c) for w, c in common if c >= 2][:15]

    return SerpInsight(
        query=serp.query,
        total_docs=serp.total,
        sample_size=n,
        avg_title_len=round(statistics.fmean(lengths), 1),
        median_title_len=int(statistics.median(lengths)),
        pct_title_has_number=sum(bool(_NUM_RE.search(t)) for t in titles) / n,
        pct_title_has_bracket=sum(bool(_BRACKET_RE.search(t)) for t in titles) / n,
        pct_title_has_hook=sum(bool(_QUESTION_RE.search(t)) for t in titles) / n,
        pct_keyword_in_title=sum(compact_kw in t.replace(" ", "") for t in titles) / n,
        avg_days_old=round(statistics.fmean(ages), 1) if ages else 0.0,
        pct_within_90days=(sum(a <= 90 for a in ages) / len(ages)) if ages else 0.0,
        top_titles=titles[:10],
        common_words=common,
    )


# ---------------------------------------------------------------------------
# 설계안
# ---------------------------------------------------------------------------


@dataclass
class PostPlan:
    """초안 생성기와 체크리스트가 공통으로 참조하는 설계안."""

    main_keyword: str
    sub_keywords: list[str]
    long_tail: list[str]
    recommended_titles: list[str]
    outline: list[str]
    target_chars: int
    target_images: int
    target_keyword_count: int  # 본문에 메인 키워드를 몇 번 넣을지
    tags: list[str]
    insight: SerpInsight
    keyword_table: list[dict] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        data = asdict(self)
        data["insight"] = asdict(self.insight)
        return data


def _build_titles(keyword: str, insight: SerpInsight, subs: list[str]) -> list[str]:
    """상위권 제목의 실제 형태를 따라간 후보들. 문구는 사람이 고쳐 쓸 전제."""
    target = insight.median_title_len or 32
    compact_kw = keyword.replace(" ", "")
    # 메인 키워드를 품고 있는 서브 키워드를 그대로 붙이면 제목에 같은 말이 두 번 나온다
    modifier = next(
        (s for s in subs if compact_kw not in s.replace(" ", "")),
        "가격과 조건",
    )
    year = date.today().year
    candidates = [
        f"{keyword} 총정리 — 처음이라면 이 순서대로",
        f"{keyword}, 직접 해보고 정리한 {year} 기준 정보",
        f"{keyword} 고를 때 꼭 확인할 5가지",
        f"{keyword} {modifier} 비교해봤습니다",
        f"{keyword} 후기 · 장단점 솔직하게",
    ]
    if insight.pct_title_has_number > 0.5:
        candidates.insert(0, f"{keyword} 핵심 7가지 한 번에 정리")
    if insight.pct_title_has_bracket > 0.4:
        candidates.insert(0, f"[{year}] {keyword} 완전 가이드")
    # 상위권 제목 길이대에 가까운 것을 앞으로
    candidates.sort(key=lambda t: abs(len(t) - target))
    return candidates[:5]


def _build_outline(keyword: str, subs: list[str], insight: SerpInsight) -> list[str]:
    sections = [f"{keyword}, 왜 찾아보게 되는지 (도입 — 검색 의도 확인)"]
    sections.append(f"{keyword} 기본 정리 (정의 · 종류 · 기준)")
    for sub in subs[:3]:
        sections.append(f"{sub} — 실제로 확인해야 하는 부분")
    if insight.pct_title_has_hook > 0.4:
        sections.append(f"{keyword} 비교 / 선택 기준 (표 또는 목록)")
    sections.append("직접 해보며 알게 된 점 (경험 — 사진 배치 구간)")
    sections.append("자주 묻는 질문 3개")
    sections.append("정리 및 요약")
    return sections


def build_plan(
    keyword: str,
    settings: Settings,
    *,
    serp_display: int = 30,
    max_related: int = 40,
) -> PostPlan:
    """공식 API 두 개를 조합해 설계안을 만든다.

    키가 일부만 있어도 가능한 범위까지 만들고, 빠진 부분은 notes 에 적는다.
    """
    notes: list[str] = []
    insight: SerpInsight
    serp: SerpResult | None = None
    openapi: OpenApiClient | None = None

    if settings.has_openapi:
        # 네이버가 2026-07-31 부터 검색 API 신규 신청을 차단했다. 기존 키가 없는 사용자는
        # 여기서 401 을 받는데, 이건 보조 기능이므로 전체를 중단시켜서는 안 된다.
        try:
            openapi = OpenApiClient(settings)
            serp = openapi.search_blog(keyword, display=serp_display)
            insight = analyze_serp(serp, keyword)
        except RuntimeError as exc:
            openapi = None
            serp = None
            insight = analyze_serp(SerpResult(query=keyword, total=0), keyword)
            notes.append(
                f"오픈API 호출이 실패해 상위 노출 글 역분석을 건너뜁니다 ({exc}). "
                "네이버가 2026년 7월 31일부터 검색 API 신규 신청을 차단했으므로, "
                "키가 없다면 .env 의 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 을 비워두세요."
            )
    else:
        notes.append(
            "오픈API 키가 없어 상위 노출 글 역분석을 건너뜀 — 제목 길이/최신성 기준은 일반값을 사용했습니다."
        )
        insight = analyze_serp(SerpResult(query=keyword, total=0), keyword)

    stats: list[KeywordStat] = []
    if settings.has_searchad:
        stats = SearchAdClient(settings).related_keywords(keyword, limit=max_related)
        # 상위 후보에만 문서수를 붙인다 (오픈API 호출 절약)
        if openapi:
            for stat in stats[:15]:
                try:
                    stat.blog_docs = openapi.total_docs(stat.keyword)
                except RuntimeError:
                    break
    else:
        notes.append(
            "검색광고 API 키가 없어 검색량·경쟁도를 채우지 못했습니다 — 연관 키워드는 상위 노출 글 제목에서 추출했습니다."
        )

    compact_kw = keyword.replace(" ", "")

    if stats:
        pool = [s for s in stats if s.keyword.replace(" ", "") != compact_kw]
        # 진입 가능성이 좋은 것 우선, 그다음 검색량
        ranked = sorted(
            pool,
            key=lambda s: (
                {"매우좋음": 0, "좋음": 1, "보통": 2, "어려움": 3}.get(s.grade, 4),
                -s.total_searches,
            ),
        )
        sub_keywords = [s.keyword for s in ranked[:6]]
        long_tail = [s.keyword for s in ranked if len(s.keyword) >= len(compact_kw) + 2][:8]
        keyword_table = [
            {
                "keyword": s.keyword,
                "searches": s.total_searches,
                "pc": s.pc_searches,
                "mobile": s.mobile_searches,
                "mobile_ratio": round(s.mobile_ratio, 2),
                "competition": s.competition,
                "blog_docs": s.blog_docs,
                "doc_ratio": None if s.doc_ratio == float("inf") else round(s.doc_ratio, 2),
                "grade": s.grade,
            }
            for s in stats
        ]
    else:
        sub_keywords = [w for w, _ in insight.common_words[:6]]
        long_tail = [f"{keyword} {w}" for w, _ in insight.common_words[:6]]
        keyword_table = []

    # 본문 분량: 상위권 제목 패턴만으로는 본문 길이를 알 수 없으므로
    # 네이버 블로그에서 일반적으로 통용되는 하한(1500자)을 기준으로 잡는다.
    target_chars = 1700 if insight.pct_title_has_hook > 0.4 else 1500
    target_images = 8 if insight.pct_within_90days >= 0.6 else 6

    if insight.total_docs and insight.total_docs > 500_000:
        notes.append(
            f"'{keyword}' 는 블로그 문서가 {insight.total_docs:,}건입니다. "
            "메인 키워드 단독보다 sub_keywords/long_tail 쪽을 제목에 얹는 편이 노출 확률이 높습니다."
        )
    if insight.sample_size and insight.pct_keyword_in_title < 0.5:
        notes.append(
            "상위권 제목에 키워드가 그대로 안 들어간 비율이 높습니다 — "
            "네이버가 이 키워드를 다른 의도로 해석하고 있을 수 있으니 상위 글 제목을 직접 확인하세요."
        )

    # 목표 밀도 1.5% 에서 역산한다. 글자수만으로 나누면 긴 키워드일 때
    # audit 의 밀도 상한(2%)을 저절로 넘겨버리므로, 키워드 길이를 반드시 넣어야 한다.
    target_keyword_count = max(3, min(12, round(TARGET_DENSITY * target_chars / len(compact_kw))))

    return PostPlan(
        main_keyword=keyword,
        sub_keywords=sub_keywords,
        long_tail=long_tail,
        recommended_titles=_build_titles(keyword, insight, sub_keywords),
        outline=_build_outline(keyword, sub_keywords, insight),
        target_chars=target_chars,
        target_images=target_images,
        target_keyword_count=target_keyword_count,
        tags=[keyword] + sub_keywords[:6] + long_tail[:3],
        insight=insight,
        keyword_table=keyword_table,
        notes=notes,
    )
