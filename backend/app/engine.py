"""가상 계약에 의한 B/B′ 연간 계산. LLM이나 보고서 목표값을 사용하지 않는다."""

import json
from decimal import Decimal, ROUND_HALF_UP
from functools import lru_cache
from pathlib import Path

CONFIG = json.loads(Path(__file__).with_name("assumptions.json").read_text())
D = Decimal


def won(value):
    return int(D(value).quantize(D("1"), rounding=ROUND_HALF_UP))


def benefits(age, financial_assets, survivor_monthly):
    c = CONFIG
    income = (
        D(survivor_monthly)
        + max(D(0), D(financial_assets - c["benefit_financial_deduction"]))
        * D(c["benefit_annual_conversion"])
        / 12
    )
    disability = (
        max(
            D(0),
            min(
                D(c["disability_max_monthly"]),
                D(c["disability_threshold_monthly"]) - income,
            ),
        )
        if age < 65
        else D(0)
    )
    old_age = (
        max(
            D(0),
            min(
                D(c["old_age_max_monthly"]), D(c["old_age_threshold_monthly"]) - income
            ),
        )
        if age >= 65
        else D(0)
    )
    addon = (
        max(
            D(0),
            min(
                D(c["old_age_addon_monthly"]),
                D(c["disability_threshold_monthly"]) - income,
            ),
        )
        if age >= 65
        else D(0)
    )
    welfare_income = (
        D(survivor_monthly)
        + max(D(0), D(financial_assets - c["livelihood_financial_deduction"]))
        * D(c["livelihood_monthly_conversion"])
        + disability
        + old_age
        + addon
    )
    livelihood = max(D(0), D(c["livelihood_threshold_monthly"]) - welfare_income)
    return {
        "disability": disability,
        "old_age": old_age,
        "addon": addon,
        "livelihood": livelihood,
    }


def annual_need(balance, age, inputs):
    monthly = benefits(
        age, balance + CONFIG["child_deposit"], inputs["monthly_survivor_pension"]
    )
    annual_benefits = won(sum(monthly.values()) * 12)
    need = max(
        0,
        12 * (inputs["monthly_child_cost"] - inputs["monthly_survivor_pension"])
        - annual_benefits,
    )
    return need, annual_benefits, monthly


def post_parent_path(start, inputs, end_age=None):
    rows = []
    balance = start
    r = D(str(inputs["net_real_return"]))
    for age in range(
        56, (end_age if end_age is not None else inputs["child_end_age"]) + 1
    ):
        need, benefit, monthly = annual_need(balance, age, inputs)
        withdrawal = min(balance, need, CONFIG["withdrawal_monthly_cap"] * 12)
        interest = won(D(balance - withdrawal) * r)
        end = balance - withdrawal + interest
        rows.append(
            {
                "year": 2026 + age - 20,
                "child_age": age,
                "phase": "withdrawal",
                "start_balance": balance,
                "inflows": 0,
                "outflows": withdrawal,
                "benefits": benefit,
                "benefit_monthly_components": {k: won(v) for k, v in monthly.items()},
                "benefit_regime": "disability" if age < 65 else "old_age",
                "survivor_pension": inputs["monthly_survivor_pension"] * 12,
                "living_cost": inputs["monthly_child_cost"] * 12,
                "shortfall": need - withdrawal,
                "interest": interest,
                "end_balance": end,
            }
        )
        balance = end
    return rows


@lru_cache(maxsize=1024)
def _required(cost, pension, rate, end_age):
    """Backwards viability: smallest opening balance funding each year and the next opening balance.

    For this continuous benefit model, annual need grows by <= .7912 per won of
    capital. Thus balance-need and its rounded end balance are nondecreasing.
    A cap failure at the minimal candidate makes larger balances infeasible too.
    This avoids assuming full-horizon feasibility is globally monotone under caps.
    """
    inputs = {
        "monthly_child_cost": cost,
        "monthly_survivor_pension": pension,
        "net_real_return": rate,
        "child_end_age": end_age,
    }
    following = 0
    r = D(str(rate))
    cap = 12 * CONFIG["withdrawal_monthly_cap"]
    for age in range(end_age, 55, -1):

        def enough(balance):
            need, _, _ = annual_need(balance, age, inputs)
            if balance < need:
                return False
            return balance - need + won(D(balance - need) * r) >= following

        low, high = 0, max(1, following + cost * 12)
        while not enough(high):
            high *= 2
            if high > 10**15:
                return None
        while low < high:
            mid = (low + high) // 2
            if enough(mid):
                high = mid
            else:
                low = mid + 1
        need, _, _ = annual_need(low, age, inputs)
        if need > cap:
            return None
        following = low
    path = post_parent_path(following, inputs)
    if any(row["shortfall"] for row in path):
        raise ArithmeticError("Required balance failed forward validation")
    return following


def required(inputs, end_age):
    return _required(
        inputs["monthly_child_cost"],
        inputs["monthly_survivor_pension"],
        float(inputs["net_real_return"]),
        end_age,
    )


def contribution(year, strategy):
    if year == 2026:
        return 50000000
    if year == 2031:
        return 50000000 + (6000000 if strategy == "B" else 0)
    if 2027 <= year <= 2030 and strategy == "B":
        return 6000000
    if year == 2062 and strategy == "B_PRIME":
        return 35000000
    return 0


def parent_path(inputs, strategy):
    c = CONFIG
    balance = c["parent_initial_assets"]
    rows = []
    for year in range(2026, c["parent_death_year"] + 1):
        alive = year < c["parent_death_year"]
        father_alive = year < c["father_death_year"]
        wage = 12 * c["wage_monthly"] if year < c["retirement_year"] else 0
        reemployment = (
            12 * inputs["monthly_parent_reemployment_income"]
            if c["reemployment_start"] <= year <= c["reemployment_end"]
            else 0
        )
        retirement = c["retirement_gross"] if year == c["retirement_year"] else 0
        tax = c["retirement_tax"] if retirement else 0
        pension = (
            12
            * (
                c["father_pension_monthly"]
                if father_alive
                else c["mother_survivor_monthly"]
            )
            if c["father_pension_year"] <= year and alive
            else 0
        )
        home = (
            12 * c["home_pension_monthly"]
            if year >= c["home_pension_year"] and alive
            else 0
        )
        consumption = (
            12
            * (
                c["consumption_working_monthly"]
                if year < c["retirement_year"]
                else c["consumption_retired_monthly"]
                if father_alive
                else c["consumption_widowed_monthly"]
            )
            if alive
            else 0
        )
        extra = 12 * c["disability_extra_monthly"] if alive else 0
        loan = 12 * c["loan_monthly"] if year <= c["loan_last_year"] else 0
        insurance = (
            12 * c["insurance_monthly"] if year <= c["insurance_last_year"] else 0
        )
        trust = contribution(year, strategy)
        interest = won(D(max(0, balance)) * D(c["parent_real_return"]))
        inflows = wage + reemployment + retirement + pension + home
        outflows = tax + consumption + extra + loan + insurance + trust
        end = balance + interest + inflows - outflows
        rows.append(
            {
                "year": year,
                "parent_age": 55 + year - 2026,
                "mother_age": 52 + year - 2026,
                "start_balance": balance,
                "inflows": inflows,
                "outflows": outflows,
                "benefits": pension + home,
                "interest": interest,
                "end_balance": end,
                "components": {
                    "wage": wage,
                    "reemployment": reemployment,
                    "retirement_gross": retirement,
                    "retirement_tax": tax,
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


def simulate(inputs, strategy):
    c = CONFIG
    r = D(str(inputs["net_real_return"]))
    balance = 0
    accumulation = []
    for year in range(2026, 2062):
        inflow = contribution(year, strategy)
        interest = won(D(balance + inflow) * r)
        end = balance + inflow + interest
        accumulation.append(
            {
                "year": year,
                "child_age": 20 + year - 2026,
                "phase": "accumulation",
                "start_balance": balance,
                "inflows": inflow,
                "outflows": 0,
                "benefits": None,
                "shortfall": 0,
                "interest": interest,
                "end_balance": end,
            }
        )
        balance = end
    supplement = contribution(2062, strategy)
    projected = balance + supplement
    withdrawals = post_parent_path(projected, inputs)
    # Opening transfer is explicit and also charged to parent assets in the same year.
    withdrawals[0]["evaluation_balance"] = projected
    withdrawals[0]["start_balance"] = balance
    withdrawals[0]["inflows"] = supplement
    withdrawals[0]["opening_transfer"] = supplement
    parents = parent_path(inputs, strategy)
    end_age = inputs["child_end_age"]
    needed = required(inputs, end_age)
    summary = {
        "required_trust_at_56": needed,
        "required_trust_83": required(inputs, 83),
        "required_trust_95": required(inputs, 95),
        "projected_trust_at_56": projected,
        "pre_supplement_trust_at_56": balance,
        "supplement_at_56": supplement,
        "child_shortfall_total": sum(x["shortfall"] for x in withdrawals),
        "child_shortfall_years": [x["year"] for x in withdrawals if x["shortfall"] > 0],
        "parent_asset_min": min(
            c["parent_initial_assets"], *(x["end_balance"] for x in parents)
        ),
        "parent_first_negative_year": next(
            (x["year"] for x in parents if x["end_balance"] < 0), None
        ),
        "parent_feasible": all(x["end_balance"] >= 0 for x in parents),
        "required_status": "calculated"
        if needed is not None
        else "unsupported_withdrawal_cap",
    }
    return {
        "status": "calculated",
        "calculation_status": "assumption_based",
        "assumption_version": c["version"],
        "effective_inputs": inputs,
        "strategy": strategy,
        "child_timeline": accumulation + withdrawals,
        "parent_timeline": parents,
        "summary": summary,
        "warnings": c["notes"],
        "source_refs": [
            "v1.5 표 4/5/8",
            "식 1",
            "식 2",
            "식 3",
            "가상 계산 계약 " + c["version"],
        ],
    }
