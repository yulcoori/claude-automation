"""환경변수 / 설정 로딩."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _load_dotenv() -> None:
    """.env 를 읽어 os.environ 에 채운다 (이미 설정된 값은 덮어쓰지 않음)."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    for candidate in (Path.cwd() / ".env", Path(__file__).resolve().parents[2] / ".env"):
        if candidate.exists():
            load_dotenv(candidate, override=False)
            return


class MissingCredentials(RuntimeError):
    """필요한 API 키가 없을 때. 어떤 키를 어디서 받는지 메시지에 담는다."""


@dataclass(frozen=True)
class Settings:
    ad_api_key: str = ""
    ad_secret_key: str = ""
    ad_customer_id: str = ""
    client_id: str = ""
    client_secret: str = ""
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5"

    @classmethod
    def load(cls) -> "Settings":
        _load_dotenv()
        return cls(
            ad_api_key=os.getenv("NAVER_AD_API_KEY", "").strip(),
            ad_secret_key=os.getenv("NAVER_AD_SECRET_KEY", "").strip(),
            ad_customer_id=os.getenv("NAVER_AD_CUSTOMER_ID", "").strip(),
            client_id=os.getenv("NAVER_CLIENT_ID", "").strip(),
            client_secret=os.getenv("NAVER_CLIENT_SECRET", "").strip(),
            anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", "").strip(),
            anthropic_model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5").strip(),
        )

    # -- 가용성 판단 -------------------------------------------------------
    @property
    def has_searchad(self) -> bool:
        return bool(self.ad_api_key and self.ad_secret_key and self.ad_customer_id)

    @property
    def has_openapi(self) -> bool:
        return bool(self.client_id and self.client_secret)

    @property
    def has_anthropic(self) -> bool:
        return bool(self.anthropic_api_key)

    def require_searchad(self) -> None:
        if not self.has_searchad:
            raise MissingCredentials(
                "네이버 검색광고 API 키가 없습니다.\n"
                "  발급: https://searchad.naver.com → 우측 상단 '도구' → 'API 사용 관리'\n"
                "  .env 에 NAVER_AD_API_KEY / NAVER_AD_SECRET_KEY / NAVER_AD_CUSTOMER_ID 를 채우세요."
            )

    def require_openapi(self) -> None:
        if not self.has_openapi:
            raise MissingCredentials(
                "네이버 오픈API 키가 없습니다.\n"
                "  발급: https://developers.naver.com/apps/#/register (사용 API = '검색')\n"
                "  .env 에 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 를 채우세요."
            )
