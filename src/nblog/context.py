"""글에 들어갈 실제 정보.

키워드만 받으면 초안이 `{{직접 채우기}}` 로 가득 찬다. 업체명·위치·가격처럼
사람만 아는 정보를 미리 받아두면 그만큼 초안이 완성된 상태로 나온다.

업종마다 물어볼 것이 다르다. 음식점에 "받은 시술"을 물으면 안 되고, 미용실에
"주문한 메뉴"를 물으면 안 된다. 그래서 항목의 이름과 예시를 업종에 따라 바꾼다.
저장되는 키(field name)는 업종과 무관하게 같으므로 뒤쪽 코드는 영향을 받지 않는다.

여기 담긴 값은 전부 선택 사항이다. 비워두면 그 항목만 `{{직접 채우기}}` 로 남는다.
모르는 걸 지어내는 것보다 비워두는 게 낫다 — 가격이나 영업시간을 잘못 쓰면
글을 보고 찾아간 사람에게 헛걸음을 시킨다.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, fields

# 업종과 무관한 기본 이름 / 예시
BASE_FIELDS: list[tuple[str, str, str]] = [
    ("shop_name", "업체명", "OO가게"),
    ("location", "위치", "풍암동 월드컵경기장 근처"),
    ("service", "이용한 것", "무엇을 이용했는지"),
    ("price", "가격", "얼마 냈는지"),
    ("duration", "걸린 시간", "얼마나 걸렸는지"),
    ("hours", "영업시간", "10~20시, 화요일 휴무"),
    ("parking", "주차", "지하 2시간 무료"),
    ("visit_reason", "방문 계기", "왜 찾게 됐는지"),
    ("liked", "좋았던 점", "만족한 부분"),
    ("disliked", "아쉬웠던 점", "솔직하게 적으면 신뢰도가 올라갑니다"),
]

# 업종별로 이름·예시를 덮어쓴다. {필드: (이름, 예시)}
CATEGORIES: dict[str, dict] = {
    "general": {
        "label": "기타 · 일반",
        "overrides": {},
    },
    "restaurant": {
        "label": "음식점 · 카페",
        "overrides": {
            "shop_name": ("가게 이름", "OO식당"),
            "service": ("주문한 메뉴", "김치찜 2인 + 계란말이"),
            "price": ("가격", "2인 32,000원"),
            "duration": ("웨이팅 · 식사 시간", "웨이팅 20분, 식사 1시간"),
            "visit_reason": ("방문 계기", "점심 회식 장소 찾다가"),
            "liked": ("좋았던 점", "밑반찬이 계속 리필됐다"),
            "disliked": ("아쉬웠던 점", "테이블 간격이 좁았다"),
        },
    },
    "salon": {
        "label": "미용실 · 네일 · 피부",
        "overrides": {
            "shop_name": ("샵 이름", "OO헤어"),
            "service": ("받은 시술", "뿌리매직 + 클리닉"),
            "price": ("시술 비용", "12만원 (클리닉 포함)"),
            "duration": ("걸린 시간", "3시간 30분"),
            "visit_reason": ("방문 계기", "아침마다 드라이가 힘들어서"),
            "liked": ("좋았던 점", "손상도를 먼저 봐주고 상담이 꼼꼼했다"),
            "disliked": ("아쉬웠던 점", "예약 없이 가서 40분 기다렸다"),
        },
    },
    "fitness": {
        "label": "필라테스 · 헬스 · 학원",
        "overrides": {
            "shop_name": ("센터 · 학원 이름", "OO필라테스"),
            "service": ("수강한 수업 · 프로그램", "1:2 소그룹 기구필라테스"),
            "price": ("수강료 · 회원권", "10회 35만원"),
            "duration": ("수업 시간", "회당 50분"),
            "visit_reason": ("등록 계기", "허리가 자주 아파서"),
            "liked": ("좋았던 점", "동작마다 자세를 잡아줬다"),
            "disliked": ("아쉬웠던 점", "인기 시간대 예약이 빨리 찬다"),
        },
    },
    "medical": {
        "label": "병원 · 의원 · 한의원",
        "overrides": {
            "shop_name": ("병원 이름", "OO의원"),
            "service": ("받은 진료 · 시술", "도수치료 + 물리치료"),
            "price": ("비용", "회당 3만원 (보험 적용)"),
            "duration": ("대기 · 진료 시간", "대기 15분, 진료 30분"),
            "visit_reason": ("방문 계기", "목 통증이 2주 넘게 이어져서"),
            "liked": ("좋았던 점", "증상을 자세히 물어봐줬다"),
            "disliked": ("아쉬웠던 점", "오후에는 대기가 길다"),
        },
    },
    "lodging": {
        "label": "숙박 · 펜션 · 캠핑",
        "overrides": {
            "shop_name": ("숙소 이름", "OO펜션"),
            "service": ("이용한 객실 · 패키지", "복층 스파룸, 바베큐 포함"),
            "price": ("숙박 요금", "1박 18만원 (주말)"),
            "duration": ("숙박 일정", "1박 2일"),
            "hours": ("입실 · 퇴실 시간", "입실 15시, 퇴실 11시"),
            "visit_reason": ("예약 계기", "아이랑 갈 조용한 곳 찾다가"),
            "liked": ("좋았던 점", "청소 상태가 아주 깔끔했다"),
            "disliked": ("아쉬웠던 점", "밤에 옆 동 소리가 들렸다"),
        },
    },
    "shop": {
        "label": "매장 · 쇼핑 · 판매",
        "overrides": {
            "shop_name": ("매장 이름", "OO스토어"),
            "service": ("구매한 것", "원목 식탁 1200 사이즈"),
            "price": ("가격", "39만원 (배송비 별도)"),
            "duration": ("배송 · 대기 기간", "주문 후 2주"),
            "visit_reason": ("구매 계기", "이사하면서 식탁을 바꾸려고"),
            "liked": ("좋았던 점", "실물 보고 고를 수 있었다"),
            "disliked": ("아쉬웠던 점", "배송이 예정보다 3일 늦었다"),
        },
    },
    "service": {
        "label": "수리 · 청소 · 이사 등 서비스",
        "overrides": {
            "shop_name": ("업체명", "OO청소"),
            "service": ("맡긴 작업", "입주청소 24평"),
            "price": ("비용", "28만원"),
            "duration": ("작업 시간", "4시간"),
            "visit_reason": ("의뢰 계기", "이사 전에 한 번 정리하려고"),
            "liked": ("좋았던 점", "작업 전후 사진을 보내줬다"),
            "disliked": ("아쉬웠던 점", "예약이 2주 뒤에나 잡혔다"),
        },
    },
}

DEFAULT_CATEGORY = "general"


def category_label(category: str) -> str:
    return CATEGORIES.get(category, CATEGORIES[DEFAULT_CATEGORY])["label"]


def field_specs(category: str) -> list[dict[str, str]]:
    """업종에 맞는 [{key, label, example}] 목록. 화면과 프롬프트가 같은 걸 쓴다."""
    overrides = CATEGORIES.get(category, CATEGORIES[DEFAULT_CATEGORY])["overrides"]
    specs = []
    for key, label, example in BASE_FIELDS:
        over_label, over_example = overrides.get(key, (label, example))
        specs.append({"key": key, "label": over_label, "example": over_example})
    return specs


def labels_for(category: str) -> dict[str, str]:
    return {spec["key"]: spec["label"] for spec in field_specs(category)}


@dataclass
class PostContext:
    """포스팅에 넣을 실제 정보. 전부 선택 사항."""

    shop_name: str = ""
    location: str = ""
    service: str = ""
    price: str = ""
    duration: str = ""
    hours: str = ""
    parking: str = ""
    visit_reason: str = ""
    liked: str = ""
    disliked: str = ""
    extra: str = ""           # 그 외 메모 (자유 입력)
    reference: str = ""       # 참고할 블로그 글 (붙여넣거나 파일로 첨부한 내용)
    category: str = DEFAULT_CATEGORY
    stance: str = "customer"  # customer(손님) | owner(사장)

    # 참고 글이 너무 길면 프롬프트를 잡아먹는다. 앞부분만 쓴다.
    REFERENCE_LIMIT = 6000

    # 업종에 따라 이름이 바뀌는 항목들
    FIELD_KEYS = [key for key, _, _ in BASE_FIELDS]

    @property
    def is_owner(self) -> bool:
        return self.stance == "owner"

    @property
    def stance_label(self) -> str:
        return "업체를 운영하는 사장" if self.is_owner else "직접 이용한 손님"

    @property
    def category_label(self) -> str:
        return category_label(self.category)

    def labels(self) -> dict[str, str]:
        labels = labels_for(self.category)
        labels["extra"] = "그 외 메모"
        return labels

    def filled(self) -> dict[str, str]:
        """값이 채워진 항목만 {이름: 값} 으로. 이름은 업종에 맞춰 나온다."""
        labels = self.labels()
        return {
            labels[f.name]: getattr(self, f.name).strip()
            for f in fields(self)
            if f.name in labels and getattr(self, f.name).strip()
        }

    def missing_labels(self) -> list[str]:
        """비어 있는 항목의 이름. 초안에서 채우기 자리로 남는다."""
        labels = self.labels()
        return [
            labels[f.name]
            for f in fields(self)
            if f.name in labels and not getattr(self, f.name).strip()
        ]

    @property
    def is_empty(self) -> bool:
        return not self.filled()

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict | None) -> "PostContext":
        if not data:
            return cls()
        known = {f.name for f in fields(cls)}
        cleaned = {k: v for k, v in data.items() if k in known}
        if cleaned.get("category") not in CATEGORIES:
            cleaned["category"] = DEFAULT_CATEGORY
        return cls(**cleaned)

    def as_prompt_block(self) -> str:
        """프롬프트에 붙일 형태. 채워진 것과 비어 있는 것을 구분해 알려준다."""
        lines = [
            "## 업종",
            self.category_label,
            "",
            "## 글 쓰는 사람의 입장",
            self.stance_label,
            "",
        ]

        filled = self.filled()
        if filled:
            lines.append("## 반드시 본문에 녹여 쓸 실제 정보")
            lines += [f"- {label}: {value}" for label, value in filled.items()]
            lines.append("")
            lines.append(
                "위 정보는 사실이므로 그대로 쓰세요. 여기 없는 수치·가격·효능은 "
                "절대 지어내지 말고 `{{직접 채우기: ...}}` 로 비워두세요."
            )
            lines.append("")

        missing = self.missing_labels()
        if missing:
            lines.append("## 정보가 없는 항목 (지어내지 말고 비워둘 것)")
            lines.append(
                "다음은 아직 모르는 내용입니다. 해당 대목에서는 "
                "`{{직접 채우기: 항목명}}` 형태로 자리만 만들어 두세요: "
                + ", ".join(missing)
            )
            lines.append("")

        reference = self.reference.strip()
        if reference:
            excerpt = reference[: self.REFERENCE_LIMIT]
            lines += [
                "## 참고할 글 (사용자가 첨부한 것)",
                "말투와 글의 구성을 참고하되, **문장을 그대로 가져오지 마세요.**",
                "네이버는 비슷한 문서를 걸러내므로 베끼면 오히려 노출에서 빠집니다.",
                "이 글에 있는 사실(가격·업체명 등)도 우리 것이 아니면 쓰지 마세요.",
                "",
                "```",
                excerpt,
                "```",
                "",
            ]
            if len(reference) > self.REFERENCE_LIMIT:
                lines.append(
                    f"(참고 글이 길어 앞 {self.REFERENCE_LIMIT:,}자만 전달했습니다.)"
                )
                lines.append("")

        return "\n".join(lines)
