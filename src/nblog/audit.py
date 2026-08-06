"""발행 전 셀프 체크.

상위 노출을 위한 항목과, 저품질 판정을 피하기 위한 항목을 함께 봅니다.
후자가 더 중요합니다 — 한 번 누락되면 되돌리는 데 몇 달이 걸립니다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .research import PostPlan

# 과장·단정 표현. 의료/금융/효능 관련 문구는 네이버 제재와 별개로 법적 문제가 됩니다.
_RISKY_PHRASES = [
    "100% 보장", "완치", "부작용 없", "무조건 수익", "원금 보장", "확실히 낫",
    "최고의", "최저가 보장", "국내 유일", "즉시 효과", "누구나 월",
]
_AD_DISCLOSURE_HINTS = ["협찬", "제공받", "무료로 받", "지원받", "체험단", "원고료"]
_DISCLOSURE_MARKERS = ["대가를 받", "협찬을 받", "유료 광고", "소정의", "제공받아 작성"]


@dataclass
class Check:
    level: str  # "ok" | "warn" | "error"
    label: str
    detail: str

    @property
    def icon(self) -> str:
        return {"ok": "✅", "warn": "⚠️ ", "error": "❌"}[self.level]


@dataclass
class AuditReport:
    checks: list[Check] = field(default_factory=list)
    char_count: int = 0
    keyword_count: int = 0
    keyword_density: float = 0.0

    @property
    def errors(self) -> list[Check]:
        return [c for c in self.checks if c.level == "error"]

    @property
    def warnings(self) -> list[Check]:
        return [c for c in self.checks if c.level == "warn"]

    @property
    def publishable(self) -> bool:
        return not self.errors

    def to_markdown(self) -> str:
        lines = ["# 발행 전 체크리스트", ""]
        lines.append(
            f"본문 {self.char_count:,}자 · 메인 키워드 {self.keyword_count}회 "
            f"· 밀도 {self.keyword_density:.2f}%"
        )
        lines.append("")
        verdict = (
            "**발행 가능** — 아래 경고만 확인하세요."
            if self.publishable
            else "**아직 발행하지 마세요** — ❌ 항목을 먼저 해결해야 합니다."
        )
        lines += [verdict, ""]
        for check in self.checks:
            lines.append(f"- {check.icon} **{check.label}** — {check.detail}")
        lines += [
            "",
            "---",
            "",
            "## 손으로 확인할 것 (자동 검사로는 알 수 없는 부분)",
            "- [ ] 사진이 전부 **직접 찍은 것**인가? (다운로드 이미지는 중복 판정 대상)",
            "- [ ] 내가 직접 겪은 내용이 최소 한 단락 있는가?",
            "- [ ] `{{직접 채우기}}` 를 전부 실제 내용으로 바꿨는가?",
            "- [ ] 가격·수치·날짜를 실제로 확인했는가?",
            "- [ ] 협찬/제공을 받았다면 본문 안에 명시했는가? (표시광고법 의무)",
            "- [ ] 스마트에디터에 붙인 뒤 모바일 미리보기로 한 번 읽었는가?",
        ]
        return "\n".join(lines)


def _strip_markdown(text: str) -> str:
    text = re.sub(r"```.*?```", "", text, flags=re.DOTALL)
    text = re.sub(r"!?\[[^\]]*\]\([^)]*\)", "", text)
    text = re.sub(r"^\s{0,3}#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"[*_>`~]", "", text)
    return text


def audit(markdown: str, plan: PostPlan, *, image_count: int | None = None) -> AuditReport:
    report = AuditReport()
    add = report.checks.append

    body = _strip_markdown(markdown)
    compact = re.sub(r"\s+", "", body)
    report.char_count = len(compact)

    keyword = plan.main_keyword
    compact_kw = keyword.replace(" ", "")
    report.keyword_count = compact.count(compact_kw)
    report.keyword_density = (
        report.keyword_count * len(compact_kw) / report.char_count * 100 if report.char_count else 0.0
    )

    # ---- 미완성 표시 -------------------------------------------------------
    placeholders = re.findall(r"\{\{[^}]*\}\}", markdown)
    if placeholders:
        add(Check("error", "미완성 자리 남음", f"{len(placeholders)}곳이 비어 있습니다: {placeholders[0]} …"))
    else:
        add(Check("ok", "미완성 자리 없음", "`{{직접 채우기}}` 가 모두 채워졌습니다."))

    # ---- 분량 -------------------------------------------------------------
    if report.char_count < 1000:
        add(Check("error", "분량 부족", f"{report.char_count:,}자. 1,000자 미만은 상위 노출이 거의 안 됩니다."))
    elif report.char_count < plan.target_chars:
        add(Check("warn", "분량 미달", f"{report.char_count:,}자 / 목표 {plan.target_chars:,}자."))
    else:
        add(Check("ok", "분량 충족", f"{report.char_count:,}자 (목표 {plan.target_chars:,}자)."))

    # ---- 키워드 밀도 -------------------------------------------------------
    if report.keyword_count == 0:
        add(Check("error", "메인 키워드 없음", f"본문에 '{keyword}' 가 한 번도 없습니다."))
    elif report.keyword_density > 3.0:
        add(
            Check(
                "error",
                "키워드 과다 (스터핑)",
                f"밀도 {report.keyword_density:.2f}%. 2% 넘으면 감점 대상입니다. "
                f"{report.keyword_count}회 → {plan.target_keyword_count}회 수준으로 줄이거나 본문을 늘리세요.",
            )
        )
    elif report.keyword_density > 2.2:
        add(Check("warn", "키워드 다소 많음", f"밀도 {report.keyword_density:.2f}%. 2% 근처까지 줄이는 편이 안전합니다."))
    elif report.keyword_count < 3:
        add(Check("warn", "키워드 부족", f"{report.keyword_count}회. 제목·첫 문단·소제목·마무리에 넣으세요."))
    else:
        add(Check("ok", "키워드 밀도 적정", f"{report.keyword_count}회 / {report.keyword_density:.2f}%"))

    # ---- 제목 -------------------------------------------------------------
    title_match = re.search(r"^\s{0,3}#\s+(.+)$", markdown, flags=re.MULTILINE)
    if not title_match:
        add(Check("error", "제목 없음", "마크다운 첫 줄에 `# 제목` 이 필요합니다."))
    else:
        title = title_match.group(1).strip()
        if compact_kw not in title.replace(" ", ""):
            add(Check("warn", "제목에 키워드 없음", f"'{keyword}' 가 제목에 없습니다: {title}"))
        elif len(title) > 45:
            add(Check("warn", "제목이 김", f"{len(title)}자. 검색결과에서 뒤가 잘립니다 (40자 내 권장)."))
        else:
            add(Check("ok", "제목 적정", f"{len(title)}자, 키워드 포함."))

    # ---- 소제목 -----------------------------------------------------------
    subheads = re.findall(r"^\s{0,3}##\s+(.+)$", markdown, flags=re.MULTILINE)
    if len(subheads) < 3:
        add(Check("warn", "소제목 부족", f"{len(subheads)}개. 4개 이상이면 체류시간이 올라갑니다."))
    else:
        add(Check("ok", "소제목 충분", f"{len(subheads)}개."))

    # ---- 이미지 -----------------------------------------------------------
    slots = len(re.findall(r"\[사진\s*\d+\]", markdown)) + len(re.findall(r"!\[[^\]]*\]\(", markdown))
    expected = image_count if image_count is not None else plan.target_images
    if slots == 0:
        add(Check("error", "이미지 없음", "사진 없는 글은 상위 노출이 사실상 불가능합니다."))
    elif slots < expected:
        add(Check("warn", "이미지 자리 부족", f"본문에 {slots}자리 / 준비된 사진 {expected}장."))
    else:
        add(Check("ok", "이미지 배치", f"{slots}자리."))

    # ---- 문단 길이 (모바일 가독성) ------------------------------------------
    paragraphs = [p for p in re.split(r"\n\s*\n", body) if p.strip()]
    long_paras = [p for p in paragraphs if len(re.sub(r"\s+", "", p)) > 400]
    if long_paras:
        add(
            Check(
                "warn",
                "문단이 긴 곳 있음",
                f"{len(long_paras)}개 문단이 400자를 넘습니다. 모바일에서 이탈이 늘어납니다.",
            )
        )
    else:
        add(Check("ok", "문단 길이 적정", f"문단 {len(paragraphs)}개."))

    # ---- 과장 표현 ---------------------------------------------------------
    found_risky = [p for p in _RISKY_PHRASES if p in body]
    if found_risky:
        add(
            Check(
                "warn",
                "과장·단정 표현",
                f"{', '.join(found_risky)} — 광고성으로 분류되기 쉽고, 분야에 따라 법적 문제가 됩니다.",
            )
        )
    else:
        add(Check("ok", "과장 표현 없음", "단정적 광고 문구가 발견되지 않았습니다."))

    # ---- 협찬 표기 ---------------------------------------------------------
    if any(h in body for h in _AD_DISCLOSURE_HINTS) and not any(m in body for m in _DISCLOSURE_MARKERS):
        add(
            Check(
                "warn",
                "협찬 표기 확인 필요",
                "협찬/제공 관련 표현이 있는데 대가성 표시 문구가 없습니다. 표시광고법상 본문 내 명시가 의무입니다.",
            )
        )

    # ---- 태그 -------------------------------------------------------------
    if len(plan.tags) > 15:
        add(Check("warn", "태그 과다", f"{len(plan.tags)}개. 10개 내외가 안전합니다 (최대 30개)."))
    else:
        add(Check("ok", "태그 개수 적정", f"{len(plan.tags)}개."))

    order = {"error": 0, "warn": 1, "ok": 2}
    report.checks.sort(key=lambda c: order[c.level])
    return report
