"""글에 들어갈 실제 정보.

키워드만 받으면 초안이 `{{직접 채우기}}` 로 가득 찬다. 업체명·위치·가격처럼
사람만 아는 정보를 미리 받아두면 그만큼 초안이 완성된 상태로 나온다.

여기 담긴 값은 전부 선택 사항이다. 비워두면 그 항목만 `{{직접 채우기}}` 로 남는다.
모르는 걸 지어내는 것보다 비워두는 게 낫다 — 가격이나 영업시간을 잘못 쓰면
글을 보고 찾아간 사람에게 헛걸음을 시킨다.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field, fields


@dataclass
class PostContext:
    """포스팅에 넣을 실제 정보. 전부 선택 사항."""

    shop_name: str = ""       # 업체명
    location: str = ""        # 위치 / 주소
    service: str = ""         # 받은 시술 / 메뉴 / 이용한 것
    price: str = ""           # 가격
    duration: str = ""        # 걸린 시간
    hours: str = ""           # 영업시간 / 휴무
    parking: str = ""         # 주차
    visit_reason: str = ""    # 방문 계기
    liked: str = ""           # 좋았던 점
    disliked: str = ""        # 아쉬웠던 점
    extra: str = ""           # 그 외 메모 (자유 입력)
    stance: str = "customer"  # customer(손님) | owner(사장)

    # 화면·프롬프트에 쓰는 한글 이름. dataclass 필드 순서와 맞춰둔다.
    LABELS = {
        "shop_name": "업체명",
        "location": "위치",
        "service": "받은 시술 / 메뉴",
        "price": "가격",
        "duration": "걸린 시간",
        "hours": "영업시간",
        "parking": "주차",
        "visit_reason": "방문 계기",
        "liked": "좋았던 점",
        "disliked": "아쉬웠던 점",
        "extra": "그 외 메모",
    }

    @property
    def is_owner(self) -> bool:
        return self.stance == "owner"

    @property
    def stance_label(self) -> str:
        return "업체를 운영하는 사장" if self.is_owner else "직접 이용한 손님"

    def filled(self) -> dict[str, str]:
        """값이 채워진 항목만 {한글이름: 값} 으로."""
        return {
            self.LABELS[f.name]: getattr(self, f.name).strip()
            for f in fields(self)
            if f.name in self.LABELS and getattr(self, f.name).strip()
        }

    def missing_labels(self) -> list[str]:
        """비어 있는 항목의 한글 이름. 초안에서 채우기 자리로 남는다."""
        return [
            self.LABELS[f.name]
            for f in fields(self)
            if f.name in self.LABELS and not getattr(self, f.name).strip()
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
        return cls(**{k: v for k, v in data.items() if k in known})

    def as_prompt_block(self) -> str:
        """프롬프트에 붙일 형태. 채워진 것과 비어 있는 것을 구분해 알려준다."""
        lines = [f"## 글 쓰는 사람의 입장", self.stance_label, ""]

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

        return "\n".join(lines)
