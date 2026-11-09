"""공유 입력 계약. 상한은 계산 계약 승인 전 개발 데모의 자원 보호 범위다."""

from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

CASE_ID = "jihoon-2026"
SOURCE_VERSION = "v1.5-calculation-detail-2026-11-09"
DEFAULTS = dict(
    monthly_child_cost=1800000,
    monthly_survivor_pension=1070000,
    net_real_return=0.01,
    monthly_parent_reemployment_income=2000000,
    child_end_age=95,
)
FIELDS = {
    "monthly_child_cost": dict(
        label="부모 사후 월 생활비",
        unit="원/월",
        min=0,
        max=10000000,
        step=1,
        default=1800000,
        source="표 4 · 가상 가계부",
    ),
    "monthly_survivor_pension": dict(
        label="자녀 유족연금",
        unit="원/월",
        min=0,
        max=10000000,
        step=1,
        default=1070000,
        source="표 5 · 기관 해석 미확인",
    ),
    "net_real_return": dict(
        label="신탁 순실질수익률",
        unit="연 비율",
        min=-0.1,
        max=0.1,
        step=0.0001,
        default=0.01,
        source="표 5 · 보수 차감 후, 상품 서면 미확인",
    ),
    "monthly_parent_reemployment_income": dict(
        label="부모 재취업 월소득",
        unit="원/월",
        min=0,
        max=10000000,
        step=1,
        default=2000000,
        source="식 3 · 가상 세후 소득",
    ),
    "child_end_age": dict(
        label="자녀 설계 종료 나이",
        unit="세",
        min=56,
        max=110,
        step=1,
        default=95,
        source="표 5 · 가족 선택",
    ),
}


class Overrides(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)
    monthly_child_cost: Optional[int] = Field(default=None, ge=0, le=10000000)
    monthly_survivor_pension: Optional[int] = Field(default=None, ge=0, le=10000000)
    net_real_return: Optional[float] = Field(
        default=None, ge=-0.1, le=0.1, multiple_of=0.0001
    )
    monthly_parent_reemployment_income: Optional[int] = Field(
        default=None, ge=0, le=10000000
    )
    child_end_age: Optional[int] = Field(default=None, ge=56, le=110)

    def changes(self):
        # Explicit null is invalid: missing and deletion are different operations.
        if any(getattr(self, key) is None for key in self.model_fields_set):
            raise ValueError("변경값에 null을 사용할 수 없습니다.")
        return self.model_dump(exclude_unset=True)


class SimulationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    case_id: Literal["jihoon-2026"]
    strategy: Literal["B", "B_PRIME"]
    overrides: Overrides = Field(default_factory=Overrides)


class ParseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    sample_id: Optional[
        Literal["cost185", "nojob", "job100", "pension0", "age83", "age95", "return0"]
    ] = None
    text: Optional[str] = Field(default=None, min_length=1, max_length=120)


SAMPLES = {
    "cost185": ("생활비가 월 185만 원이면?", {"monthly_child_cost": 1850000}),
    "nojob": (
        "부모 재취업 월소득을 0원으로 바꿔 줘",
        {"monthly_parent_reemployment_income": 0},
    ),
    "job100": (
        "부모 재취업 월소득을 100만 원으로 바꿔 줘",
        {"monthly_parent_reemployment_income": 1000000},
    ),
    "pension0": ("자녀 유족연금을 월 0원으로 바꿔 줘", {"monthly_survivor_pension": 0}),
    "age83": ("자녀 설계 종료 나이를 83세로 바꿔 줘", {"child_end_age": 83}),
    "age95": ("자녀 설계 종료 나이를 95세로 바꿔 줘", {"child_end_age": 95}),
    "return0": ("신탁 순실질수익률을 연 0%로 바꿔 줘", {"net_real_return": 0.0}),
}


# Anchored grammar protects the external boundary: a name/contact/health clause cannot pass.
# The LLM still extracts the proposed value; the server checks semantic equivalence.
def supported_sentence(text):
    import re
    from decimal import Decimal

    amount = r"([0-9]+(?:\.[0-9]+)?)\s*(만\s*원|원)"
    patterns = [
        (
            r"(?:부모\s*사후\s*)?생활비(?:가|를)?\s*(?:월\s*)?" + amount,
            "monthly_child_cost",
        ),
        (
            r"(?:자녀\s*)?유족연금(?:을|이)?\s*(?:월\s*)?" + amount,
            "monthly_survivor_pension",
        ),
        (
            r"(?:부모\s*)?재취업\s*(?:월\s*)?소득(?:을|이)?\s*(?:월\s*)?" + amount,
            "monthly_parent_reemployment_income",
        ),
        (
            r"(?:신탁\s*)?(?:순실질)?수익률(?:을|이)?\s*(?:연\s*)?(-?[0-9]+(?:\.[0-9]+)?)\s*(%)",
            "net_real_return",
        ),
        (
            r"(?:자녀\s*)?(?:설계\s*)?종료\s*나이(?:를|가)?\s*([0-9]+)\s*(세)",
            "child_end_age",
        ),
    ]
    suffix = r"\s*(?:이면|라면|으로\s*바꿔\s*줘|로\s*바꿔\s*줘|으로|로)?\s*[?？.]?"
    for pattern, field in patterns:
        match = re.fullmatch(pattern + suffix, text.strip())
        if match:
            number = Decimal(match.group(1))
            unit = match.group(2).replace(" ", "")
            value = (
                number / 100
                if unit == "%"
                else number * 10000
                if unit == "만원"
                else number
            )
            if field != "net_real_return" and value != value.to_integral_value():
                raise ValueError("금액은 원 단위 정수여야 합니다.")
            change = {field: float(value) if field == "net_real_return" else int(value)}
            return Overrides.model_validate(change).changes()
    raise ValueError(
        "지원 문장 형식이 아닙니다. 예시처럼 입력 하나와 명확한 값·단위만 작성해 주세요."
    )
