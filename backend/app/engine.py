"""v1.5 상세 계산식 PDF의 가상 보고서 사례 재현.

기관 수급 판정이나 원본 persona_v3.py 실행 검증을 뜻하지 않는다.
"""

from __future__ import annotations

import json
from decimal import Decimal
from functools import lru_cache
from pathlib import Path

CONFIG = json.loads(Path(__file__).with_name("assumptions.json").read_text())
D = Decimal
SCALE = 1_000_000
TRUST_STEP = 5_000_000
TRUST_LIMIT = 1_500_000_000


def trunc_div(numerator: int, denominator: int) -> int:
    """정수 나눗셈을 0 방향으로 절사한다. 음수의 //와 다르다."""
    quotient = abs(numerator) // denominator
    return quotient if numerator >= 0 else -quotient


def rate_ppm(value) -> int:
    return int(D(str(value)) * SCALE)


def won(value) -> int:
    """정수 원으로 0 방향 절사. 보고서 엔진의 trunc에 대응한다."""
    return int(D(str(value)))


def _recognized(trust_balance: int, survivor_monthly: int) -> int:
    exposed = max(0, trust_balance - CONFIG["benefit_financial_deduction"])
    return survivor_monthly + exposed * 40_000 // (12 * SCALE)


def _basic_pension(recognized: int) -> int:
    ceiling = CONFIG["old_age_threshold_monthly"]
    maximum = CONFIG["old_age_max_monthly"]
    if recognized > ceiling:
        return 0
    if recognized + maximum < ceiling:
        return maximum
    return min(maximum, max(maximum // 10, ((ceiling - recognized) // 10) * 10))


def _disability_basic(recognized: int) -> int:
    ceiling = CONFIG["disability_threshold_monthly"]
    maximum = CONFIG["disability_max_monthly"]
    if recognized > ceiling:
        return 0
    if recognized + maximum < ceiling:
        return maximum
    gap = ceiling - recognized
    rounded_up = ((gap + 19_999) // 20_000) * 20_000
    return min(maximum, max(20_000, rounded_up))


def benefits(age: int, trust_balance: int, survivor_monthly: int) -> dict[str, int]:
    """PDF 4장: 해 초 신탁 F만 재산으로 보는 보고서 모형의 월 현금급여."""
    c = CONFIG
    recognized = _recognized(trust_balance, survivor_monthly)
    old_age = _basic_pension(recognized) if age >= 65 else 0
    livelihood_income = (
        survivor_monthly
        + old_age
        + max(0, trust_balance - c["livelihood_financial_deduction"])
        * 62_600
        // SCALE
    )
    livelihood = max(0, c["livelihood_threshold_monthly"] - livelihood_income)
    if livelihood_income <= c["medical_threshold_monthly"]:
        status = "medical"
    elif livelihood_income <= c["near_poor_threshold_monthly"]:
        status = "near_poor"
    else:
        status = "other"
    eligible = recognized <= c["disability_threshold_monthly"]
    disability = _disability_basic(recognized) if age < 65 else 0
    addon = 0
    if eligible:
        prefix = "disability_addon_over65_" if age >= 65 else "disability_addon_under65_"
        addon = c[prefix + status]
    return {
        "disability": disability,
        "old_age": old_age,
        "addon": addon,
        "livelihood": livelihood,
    }


def annual_need(balance: int, age: int, inputs: dict):
    monthly = benefits(age, balance, inputs["monthly_survivor_pension"])
    monthly_need = max(
        0,
        inputs["monthly_child_cost"]
        - inputs["monthly_survivor_pension"]
        - sum(monthly.values()),
    )
    return monthly_need * 12, sum(monthly.values()) * 12, monthly


def post_parent_path(start: int, inputs: dict, end_age: int | None = None):
    rows = []
    balance = start
    factor = SCALE + rate_ppm(inputs["net_real_return"])
    last_age = end_age if end_age is not None else inputs["child_end_age"]
    for age in range(CONFIG["child_post_parent_age"], last_age + 1):
        needed, annual_benefits, monthly = annual_need(balance, age, inputs)
        monthly_want = needed // 12
        monthly_draw = min(monthly_want, CONFIG["withdrawal_monthly_cap"], balance // 12)
        withdrawal = monthly_draw * 12
        after = balance - withdrawal
        end = trunc_div(after * factor, SCALE)
        monthly_short = monthly_want - monthly_draw
        rows.append(
            {
                "year": 2026 + age - 20,
                "child_age": age,
                "phase": "withdrawal",
                "start_balance": balance,
                "inflows": 0,
                "outflows": withdrawal,
                "benefits": annual_benefits,
                "benefit_monthly_components": monthly,
                "benefit_regime": "disability" if age < 65 else "old_age",
                "survivor_pension": inputs["monthly_survivor_pension"] * 12,
                "living_cost": inputs["monthly_child_cost"] * 12,
                "monthly_shortfall": monthly_short,
                "shortfall": monthly_short * 12,
                "interest": end - after,
                "end_balance": end,
            }
        )
        balance = end
    return rows


@lru_cache(maxsize=1024)
def _required(cost: int, pension: int, rate: str, end_age: int):
    """PDF 1.4/5장: 급여의 계단 때문에 500만 원 격자를 앞에서부터 검사."""
    inputs = {
        "monthly_child_cost": cost,
        "monthly_survivor_pension": pension,
        "net_real_return": float(rate),
        "child_end_age": end_age,
    }
    empty = post_parent_path(0, inputs, end_age)
    if any(row["monthly_shortfall"] > CONFIG["withdrawal_monthly_cap"] for row in empty):
        return None
    for candidate in range(0, TRUST_LIMIT + 1, TRUST_STEP):
        if all(row["shortfall"] == 0 for row in post_parent_path(candidate, inputs, end_age)):
            return candidate
    return None


def required(inputs: dict, end_age: int):
    return _required(
        inputs["monthly_child_cost"],
        inputs["monthly_survivor_pension"],
        str(inputs["net_real_return"]),
        end_age,
    )


def contribution(year: int, strategy: str) -> int:
    """두 부모 생전 신탁 납입만 반환한다. 사후 상속 보충은 별도 계산."""
    if year == 2026:
        return 50_000_000
    if year == 2031:
        return 50_000_000 + (6_000_000 if strategy == "B" else 0)
    if 2027 <= year <= 2030 and strategy == "B":
        return 6_000_000
    return 0


def accumulated_at(year: int, strategy: str, rate) -> int:
    factor = D(1) + D(str(rate))
    total = sum(
        D(contribution(prior, strategy)) * factor ** (year - prior)
        for prior in range(2026, year)
    )
    return int(total)


def housing_loan_at_death() -> int:
    c = CONFIG
    annual = D(c["home_pension_monthly"] * 12)
    factor = D(1) + D(c["home_pension_loan_real_return"])
    return int(sum(annual * factor ** (c["parent_death_year"] - y)
                   for y in range(c["home_pension_year"], c["parent_death_year"])))


def parent_path(inputs: dict, strategy: str):
    c = CONFIG
    balance = c["parent_initial_assets"]
    rows = []
    # persona_v3 uses the same edited real return for trust and parent assets.
    factor = SCALE + rate_ppm(inputs["net_real_return"])
    for year in range(2026, c["parent_death_year"] + 1):
        father_age = 55 + year - 2026
        father_alive = year < c["father_death_year"]
        wage = 12 * c["wage_monthly"] if year <= c["retirement_year"] else 0
        reemployment = (
            12 * inputs["monthly_parent_reemployment_income"]
            if c["reemployment_start"] <= year <= c["reemployment_end"]
            else 0
        )
        retirement = c["retirement_gross"] if year == c["retirement_year"] else 0
        pension = (
            12 * c["father_pension_monthly"] if father_age >= 65 else 0
        ) if father_alive else 12 * inputs["monthly_survivor_pension"]
        home = 12 * c["home_pension_monthly"] if year >= c["home_pension_year"] else 0
        if not father_alive:
            consumption_monthly = c["consumption_widowed_monthly"]
        elif father_age <= 60:
            consumption_monthly = c["consumption_working_monthly"]
        elif father_age <= 64:
            consumption_monthly = c["consumption_age_61_64_monthly"]
        elif father_age <= 69:
            consumption_monthly = c["consumption_age_65_69_monthly"]
        else:
            consumption_monthly = c["consumption_age_70_plus_monthly"]
        consumption = 12 * consumption_monthly
        extra = 12 * c["disability_extra_monthly"]
        loan = 12 * c["loan_monthly"] if year <= c["loan_last_year"] else 0
        insurance = 12 * c["insurance_monthly"] if year <= c["insurance_last_year"] else 0
        trust = contribution(year, strategy)
        inflows = wage + reemployment + retirement + pension + home
        outflows = consumption + extra + loan + insurance + trust
        end = trunc_div(balance * factor + (inflows - outflows) * SCALE, SCALE)
        rows.append(
            {
                "year": year,
                "parent_age": father_age,
                "mother_age": 52 + year - 2026,
                "start_balance": balance,
                "inflows": inflows,
                "outflows": outflows,
                "benefits": pension + home,
                "interest": end - balance - inflows + outflows,
                "end_balance": end,
                "components": {
                    "wage": wage,
                    "reemployment": reemployment,
                    "retirement_gross": retirement,
                    "retirement_tax": 0,
                    "pension": pension,
                    "home_pension": home,
                    "consumption": consumption,
                    "disability_extra": extra,
                    "loan": loan,
                    "insurance": insurance,
                    "trust_contribution": trust,
                },
            }
        )
        balance = end
    return rows


def simulate(inputs: dict, strategy: str):
    c = CONFIG
    accumulation = []
    for year in range(2026, c["parent_death_year"]):
        start = accumulated_at(year, strategy, inputs["net_real_return"])
        inflow = contribution(year, strategy)
        end = accumulated_at(year + 1, strategy, inputs["net_real_return"])
        accumulation.append(
            {
                "year": year,
                "child_age": 20 + year - 2026,
                "phase": "accumulation",
                "start_balance": start,
                "inflows": inflow,
                "outflows": 0,
                "benefits": None,
                "shortfall": 0,
                "interest": end - start - inflow,
                "end_balance": end,
            }
        )
    pre_supplement = accumulated_at(c["parent_death_year"], strategy, inputs["net_real_return"])
    parents = parent_path(inputs, strategy)
    home_equity = max(0, c["house_value"] - housing_loan_at_death())
    estate = max(0, parents[-1]["end_balance"] + home_equity)
    estate_half = estate // 2
    supplement_target_age = 83 if strategy == "B" else 95
    target = required(inputs, supplement_target_age)
    supplement = min(estate_half, max(0, target - pre_supplement)) if target is not None else 0
    projected = pre_supplement + supplement
    withdrawals = post_parent_path(projected, inputs)
    withdrawals[0]["evaluation_balance"] = projected
    withdrawals[0]["start_balance"] = pre_supplement
    withdrawals[0]["inflows"] = supplement
    withdrawals[0]["opening_transfer"] = supplement
    needed = required(inputs, inputs["child_end_age"])
    summary = {
        "required_trust_at_56": needed,
        "required_trust_83": required(inputs, 83),
        "required_trust_95": required(inputs, 95),
        "projected_trust_at_56": projected,
        "pre_supplement_trust_at_56": pre_supplement,
        "supplement_at_56": supplement,
        "parent_estate_at_56": estate,
        "parent_eligible_half_estate": estate_half,
        "child_shortfall_total": sum(row["shortfall"] for row in withdrawals),
        "child_shortfall_years": [row["year"] for row in withdrawals if row["shortfall"] > 0],
        "parent_asset_min": min(c["parent_initial_assets"], *(row["end_balance"] for row in parents)),
        "parent_first_negative_year": next((row["year"] for row in parents if row["end_balance"] < 0), None),
        "parent_feasible": all(row["end_balance"] >= 0 for row in parents),
        "required_status": "calculated" if needed is not None else "unsupported_withdrawal_cap",
    }
    return {
        "status": "calculated",
        "calculation_status": "report_detail_based_unverified_policy",
        "assumption_version": c["version"],
        "effective_inputs": inputs,
        "strategy": strategy,
        "child_timeline": accumulation + withdrawals,
        "parent_timeline": parents,
        "summary": summary,
        "warnings": c["notes"],
        "source_refs": ["v1.5 계산식 세부 과정 1·4·5·7·9장", "v1.5 식 1·2·3", "보고서 재현 계약 " + c["version"]],
    }
