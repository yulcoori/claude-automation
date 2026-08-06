"""네이버 공식 API 클라이언트.

두 개만 씁니다.
  1. 검색광고 API (api.searchad.naver.com)  — 키워드 검색량/경쟁도
  2. 오픈API 검색   (openapi.naver.com)     — 블로그 검색 결과

둘 다 문서화된 공개 API이고, 읽기 전용입니다.
로그인 세션을 흉내내거나 에디터를 조작하는 코드는 이 프로젝트에 없습니다.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import html
import re
import time
from dataclasses import dataclass, field
from typing import Any

import requests

from .config import Settings

_SEARCHAD_BASE = "https://api.searchad.naver.com"
_OPENAPI_BASE = "https://openapi.naver.com/v1/search"
_TIMEOUT = 15
_RETRIES = 3


def _request_with_retry(method: str, url: str, **kwargs: Any) -> requests.Response:
    """네트워크 오류/5xx/429 에만 백오프 재시도. 4xx는 즉시 올린다."""
    last_exc: Exception | None = None
    for attempt in range(_RETRIES):
        try:
            resp = requests.request(method, url, timeout=_TIMEOUT, **kwargs)
        except requests.RequestException as exc:
            last_exc = exc
        else:
            if resp.status_code < 500 and resp.status_code != 429:
                return resp
            last_exc = requests.HTTPError(f"{resp.status_code} {resp.text[:200]}")
        if attempt < _RETRIES - 1:
            time.sleep(2**attempt)
    raise RuntimeError(f"네이버 API 요청 실패: {url}\n  {last_exc}")


def strip_tags(text: str) -> str:
    """오픈API 검색 결과의 <b> 하이라이트 태그와 HTML 엔티티를 제거."""
    return html.unescape(re.sub(r"<[^>]+>", "", text or "")).strip()


# ---------------------------------------------------------------------------
# 1. 검색광고 API — 키워드 검색량
# ---------------------------------------------------------------------------


def _parse_count(value: Any) -> int:
    """검색량 필드는 10 미만이면 '< 10' 문자열로 온다."""
    if isinstance(value, (int, float)):
        return int(value)
    digits = re.sub(r"[^0-9]", "", str(value or ""))
    return int(digits) if digits else 0


@dataclass
class KeywordStat:
    keyword: str
    pc_searches: int
    mobile_searches: int
    competition: str  # 낮음 / 중간 / 높음
    ad_depth: int  # 검색결과에 노출되는 광고 개수
    blog_docs: int = 0  # 블로그 총 문서수 (오픈API로 별도 조회)

    @property
    def total_searches(self) -> int:
        return self.pc_searches + self.mobile_searches

    @property
    def mobile_ratio(self) -> float:
        return self.mobile_searches / self.total_searches if self.total_searches else 0.0

    @property
    def doc_ratio(self) -> float:
        """문서수 / 월간 검색량. 낮을수록 '수요는 있는데 글은 적은' 좋은 키워드."""
        if not self.total_searches:
            return float("inf")
        return self.blog_docs / self.total_searches

    @property
    def grade(self) -> str:
        """진입 난이도 등급. doc_ratio 와 검색량을 함께 본다."""
        if not self.total_searches:
            return "데이터없음"
        if self.total_searches < 100:
            return "검색량부족"
        r = self.doc_ratio
        if r < 0.5:
            return "매우좋음"
        if r < 2:
            return "좋음"
        if r < 10:
            return "보통"
        if r < 40:
            return "어려움"
        return "매우어려움"


class SearchAdClient:
    """네이버 검색광고 API. HMAC-SHA256 서명 인증."""

    def __init__(self, settings: Settings):
        settings.require_searchad()
        self._settings = settings

    def _headers(self, method: str, uri: str) -> dict[str, str]:
        timestamp = str(int(time.time() * 1000))
        message = f"{timestamp}.{method}.{uri}"
        signature = base64.b64encode(
            hmac.new(
                self._settings.ad_secret_key.encode("utf-8"),
                message.encode("utf-8"),
                hashlib.sha256,
            ).digest()
        ).decode("utf-8")
        return {
            "X-Timestamp": timestamp,
            "X-API-KEY": self._settings.ad_api_key,
            "X-Customer": self._settings.ad_customer_id,
            "X-Signature": signature,
            "Content-Type": "application/json; charset=UTF-8",
        }

    def related_keywords(self, seed: str, limit: int = 40) -> list[KeywordStat]:
        """씨드 키워드로 연관 키워드 + 월간 검색량을 가져온다."""
        uri = "/keywordstool"
        # 힌트 키워드는 공백을 제거한 형태로 넣어야 매칭률이 높다.
        resp = _request_with_retry(
            "GET",
            _SEARCHAD_BASE + uri,
            headers=self._headers("GET", uri),
            params={"hintKeywords": seed.replace(" ", ""), "showDetail": "1"},
        )
        if resp.status_code == 401:
            raise RuntimeError(
                "검색광고 API 인증 실패(401). API_KEY / SECRET_KEY / CUSTOMER_ID 를 확인하세요."
            )
        resp.raise_for_status()

        stats: list[KeywordStat] = []
        for row in resp.json().get("keywordList", []):
            stats.append(
                KeywordStat(
                    keyword=row.get("relKeyword", ""),
                    pc_searches=_parse_count(row.get("monthlyPcQcCnt")),
                    mobile_searches=_parse_count(row.get("monthlyMobileQcCnt")),
                    competition=str(row.get("compIdx") or "-"),
                    ad_depth=_parse_count(row.get("plAvgDepth")),
                )
            )
        stats.sort(key=lambda s: s.total_searches, reverse=True)
        return stats[:limit]


# ---------------------------------------------------------------------------
# 2. 오픈API — 블로그 검색
# ---------------------------------------------------------------------------


@dataclass
class BlogPost:
    title: str
    link: str
    description: str
    blogger: str
    postdate: str  # YYYYMMDD

    @property
    def is_naver_blog(self) -> bool:
        return "blog.naver.com" in self.link


@dataclass
class SerpResult:
    query: str
    total: int
    posts: list[BlogPost] = field(default_factory=list)


class OpenApiClient:
    """네이버 오픈API 검색. 상위 노출 글의 '형태'를 읽는 데 씁니다."""

    def __init__(self, settings: Settings):
        settings.require_openapi()
        self._headers_ = {
            "X-Naver-Client-Id": settings.client_id,
            "X-Naver-Client-Secret": settings.client_secret,
        }

    def search_blog(self, query: str, display: int = 30, sort: str = "sim") -> SerpResult:
        """sort='sim' 은 정확도순 = 실제 상위 노출 순위에 가장 가깝다."""
        resp = _request_with_retry(
            "GET",
            f"{_OPENAPI_BASE}/blog.json",
            headers=self._headers_,
            params={"query": query, "display": min(display, 100), "sort": sort},
        )
        if resp.status_code == 401:
            raise RuntimeError("오픈API 인증 실패(401). CLIENT_ID / CLIENT_SECRET 를 확인하세요.")
        resp.raise_for_status()
        data = resp.json()
        posts = [
            BlogPost(
                title=strip_tags(item.get("title", "")),
                link=item.get("link", ""),
                description=strip_tags(item.get("description", "")),
                blogger=strip_tags(item.get("bloggername", "")),
                postdate=item.get("postdate", ""),
            )
            for item in data.get("items", [])
        ]
        return SerpResult(query=query, total=int(data.get("total", 0)), posts=posts)

    def total_docs(self, query: str) -> int:
        """해당 키워드의 블로그 총 문서수. 경쟁률 계산용."""
        return self.search_blog(query, display=1).total
