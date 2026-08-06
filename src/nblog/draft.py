"""본문 초안 생성.

ANTHROPIC_API_KEY 가 있으면 Claude API 로 초안을 만들고,
없으면 그대로 복사해 쓸 수 있는 프롬프트를 파일로 남깁니다.

초안은 초안입니다. 그대로 발행하지 마세요 — 이유는 두 가지입니다.
  1. AI가 쓴 티가 나는 글은 네이버가 걸러내는 대상이 되었습니다.
  2. 직접 겪은 내용(사진에 담긴 그 경험)이 들어가야 D.I.A. 평가에서 점수를 받습니다.
초안은 구조와 초벌 문장까지고, 경험·수치·사진 설명은 본인이 채우는 전제로 만들어졌습니다.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

import requests

from .config import Settings
from .images import ImageReport
from .research import PostPlan

_API_URL = "https://api.anthropic.com/v1/messages"
_API_VERSION = "2023-06-01"

_SYSTEM = """당신은 네이버 블로그 글을 쓰는 한국인 블로거입니다.

지켜야 할 것:
- 실제 사람이 쓴 것처럼 씁니다. 문장 길이를 섞고, 구어체를 자연스럽게 넣습니다.
- 메인 키워드는 지정된 횟수만큼만 자연스럽게 넣습니다. 억지로 반복하면 감점입니다.
- 각 소제목 아래 3~5문장. 문단마다 줄바꿈을 넣어 모바일에서 읽기 편하게 씁니다.
- 사진이 들어갈 자리에는 `[사진N]` 표시와, 그 사진에 무엇이 담겨야 하는지 한 줄 메모를 답니다.
- 직접 경험해야만 쓸 수 있는 부분(수치, 체감, 실패담)은 `{{직접 채우기: ...}}` 로 비워둡니다.
  이건 게으름이 아니라 의도입니다 — 그 자리를 사람이 채워야 글이 통과합니다.

하지 말 것:
- "안녕하세요 여러분", "오늘은 ~에 대해 알아보겠습니다" 같은 상투적 도입.
- 광고 문구, 과장된 표현, 근거 없는 단정.
- 확인되지 않은 가격·수치·효능을 사실처럼 쓰는 것. 모르면 `{{직접 채우기}}` 로 비웁니다.

출력은 마크다운. 제목은 `# `, 소제목은 `## ` 로."""


@dataclass
class DraftResult:
    markdown: str
    prompt: str
    generated_by: str  # "claude" | "prompt-only"


def build_prompt(plan: PostPlan, images: ImageReport | None = None) -> str:
    image_count = len(images.images) if images else plan.target_images
    outline = "\n".join(f"{i}. {s}" for i, s in enumerate(plan.outline, 1))
    insight = plan.insight

    lines = [
        f"아래 설계안대로 네이버 블로그 글 초안을 써주세요.",
        "",
        f"## 메인 키워드",
        f"{plan.main_keyword}  (본문에 정확히 {plan.target_keyword_count}회 등장. 그 이상은 금지)",
        "",
        f"## 함께 넣을 키워드 (각 1~2회, 자연스럽게)",
        ", ".join(plan.sub_keywords) or "(없음)",
        "",
        f"## 제목",
        f"아래 후보 중 하나를 고르거나 더 나은 걸 제안하세요. 길이는 {insight.median_title_len or 32}자 근처가 좋습니다.",
        *[f"- {t}" for t in plan.recommended_titles],
        "",
        f"## 구성",
        outline,
        "",
        f"## 분량 / 사진",
        f"- 본문 {plan.target_chars}자 이상 (공백 제외)",
        f"- 사진 {image_count}장. `[사진1]`~`[사진{image_count}]` 을 본문에 고르게 배치",
        "",
    ]

    if insight.sample_size:
        lines += [
            "## 현재 상위 노출된 글들의 특징 (참고 — 베끼지 말고 빈틈을 찾으세요)",
            f"- 제목 평균 {insight.avg_title_len}자",
            f"- 제목에 숫자 포함: {insight.pct_title_has_number:.0%}",
            f"- {insight.freshness_verdict}",
            f"- 자주 쓰인 단어: {', '.join(w for w, _ in insight.common_words[:10]) or '-'}",
            "",
            "실제 상위 글 제목:",
            *[f"- {t}" for t in insight.top_titles[:8]],
            "",
        ]

    lines += [
        "## 마지막으로",
        "상위 글들이 다루지 않은 각도가 보이면 그쪽으로 쓰세요. 같은 내용을 더 잘 쓰는 것보다,",
        "아직 아무도 안 쓴 걸 쓰는 게 신규 블로그가 상위로 가는 유일한 길입니다.",
    ]
    return "\n".join(lines)


def generate_draft(
    plan: PostPlan,
    settings: Settings,
    images: ImageReport | None = None,
    *,
    max_tokens: int = 4096,
) -> DraftResult:
    prompt = build_prompt(plan, images)

    if not settings.has_anthropic:
        return DraftResult(
            markdown=_prompt_only_placeholder(plan, prompt),
            prompt=prompt,
            generated_by="prompt-only",
        )

    resp = requests.post(
        _API_URL,
        headers={
            "x-api-key": settings.anthropic_api_key,
            "anthropic-version": _API_VERSION,
            "content-type": "application/json",
        },
        json={
            "model": settings.anthropic_model,
            "max_tokens": max_tokens,
            "system": _SYSTEM,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=180,
    )
    if resp.status_code != 200:
        detail = resp.text[:400]
        raise RuntimeError(
            f"Claude API 호출 실패 ({resp.status_code}): {detail}\n"
            "키를 확인하거나, 키 없이 프롬프트만 받으려면 .env 의 ANTHROPIC_API_KEY 를 비우세요."
        )

    payload = resp.json()
    text = "".join(
        block.get("text", "") for block in payload.get("content", []) if block.get("type") == "text"
    ).strip()
    if not text:
        raise RuntimeError(f"Claude 응답이 비어 있습니다: {json.dumps(payload)[:300]}")

    return DraftResult(markdown=text, prompt=prompt, generated_by="claude")


def _prompt_only_placeholder(plan: PostPlan, prompt: str) -> str:
    """API 키가 없을 때. 뼈대 + 프롬프트 안내를 마크다운으로."""
    body = [f"# {plan.recommended_titles[0] if plan.recommended_titles else plan.main_keyword}", ""]
    body += [
        "> ANTHROPIC_API_KEY 가 없어 자동 초안을 만들지 않았습니다.",
        "> `prompt.md` 의 내용을 Claude 나 다른 도구에 붙여넣으면 초안이 나옵니다.",
        "> 아래는 그때 쓰일 뼈대입니다.",
        "",
    ]
    for i, section in enumerate(plan.outline, 1):
        body += [f"## {section}", "", f"{{{{직접 채우기}}}}", "", f"[사진{i}]", ""]
    body += ["---", "", "<!-- 프롬프트 -->", "", "```", prompt, "```"]
    return "\n".join(body)
