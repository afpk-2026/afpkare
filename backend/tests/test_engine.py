from decimal import Decimal
import pytest
from app.contracts import DEFAULTS
from app.engine import simulate, post_parent_path, required, benefits, CONFIG, won


@pytest.mark.parametrize("strategy", ["B", "B_PRIME"])
def test_timeline_conservation_and_boundaries(strategy):
    result = simulate(DEFAULTS, strategy)
    child = result["child_timeline"]
    parent = result["parent_timeline"]
    assert len(child) == 76 and len(parent) == 37
    assert child[0]["year"] == 2026 and child[-1]["child_age"] == 95
    for row in child:
        assert (
            row["end_balance"]
            == row["start_balance"] + row["inflows"] - row["outflows"] + row["interest"]
        )
        assert row["end_balance"] >= 0
    for previous, current in zip(child, child[1:]):
        assert previous["end_balance"] == current["start_balance"]
    for row in parent:
        assert (
            row["end_balance"]
            == row["start_balance"] + row["interest"] + row["inflows"] - row["outflows"]
        )
    assert sum(x["components"]["trust_contribution"] for x in parent) == (
        130000000 if strategy == "B" else 135000000
    )
    assert (
        next(x for x in child if x["child_age"] == 64)["benefit_regime"] == "disability"
    )
    assert next(x for x in child if x["child_age"] == 65)["benefit_regime"] == "old_age"


@pytest.mark.parametrize("end_age", [56, 64, 65, 83, 95, 110])
@pytest.mark.parametrize("rate", [-0.1, 0, 0.01, 0.1])
def test_required_is_feasible_and_minimal(end_age, rate):
    inputs = {**DEFAULTS, "child_end_age": end_age, "net_real_return": rate}
    minimum = required(inputs, end_age)
    assert minimum is not None
    assert all(x["shortfall"] == 0 for x in post_parent_path(minimum, inputs))
    if minimum:
        assert any(x["shortfall"] > 0 for x in post_parent_path(minimum - 1, inputs))


def test_sensitivity_and_no_arbitrary_report_fit():
    base = simulate(DEFAULTS, "B")
    higher = simulate({**DEFAULTS, "monthly_child_cost": 2200000}, "B")
    assert (
        higher["summary"]["required_trust_at_56"]
        >= base["summary"]["required_trust_at_56"]
    )
    lower = simulate({**DEFAULTS, "monthly_parent_reemployment_income": 0}, "B")
    assert all(
        a["end_balance"] <= b["end_balance"]
        for a, b in zip(lower["parent_timeline"], base["parent_timeline"])
    )
    assert required(DEFAULTS, 95) >= required(DEFAULTS, 83)


def test_midyear_cashflow_independent_calculation():
    result = simulate(DEFAULTS, "B")
    first = result["child_timeline"][0]
    assert first["end_balance"] == 50500000
    second = result["child_timeline"][1]
    assert second["end_balance"] == 57065000
    p = result["parent_timeline"][0]
    assert (
        p["end_balance"]
        == 150000000
        + 1500000
        + 12 * 5200000
        - 12 * (3500000 + 285000 + 910000 + 400000)
        - 50000000
    )
    retirement = next(x for x in result["parent_timeline"] if x["year"] == 2031)
    assert retirement["components"]["wage"] == 0
    assert retirement["components"]["retirement_gross"] == 200000000
    assert retirement["components"]["retirement_tax"] == 3795000
    assert retirement["components"]["trust_contribution"] == 56000000
    assert (
        next(x for x in result["parent_timeline"] if x["year"] == 2036)["components"][
            "loan"
        ]
        == 0
    )
    assert (
        next(x for x in result["parent_timeline"] if x["year"] == 2039)["components"][
            "home_pension"
        ]
        == 13200000
    )


def test_known_benefits_and_deposit_inclusion():
    at64 = benefits(64, 10000000, 1070000)
    assert at64["disability"] == 330000
    at65 = benefits(65, 10000000, 1070000)
    assert (
        at65["disability"] == 0 and at65["old_age"] == 349700 and at65["addon"] == 50000
    )
    assert benefits(64, 119000000, 1070000)["disability"] == 0
    assert benefits(64, 109000000, 1070000)["disability"] > 0


def test_cap_impossible_is_not_a_fake_number():
    inputs = {**DEFAULTS, "monthly_child_cost": 10000000, "monthly_survivor_pension": 0}
    assert required(inputs, 95) is None
    result = simulate(inputs, "B")
    assert result["summary"]["required_status"] == "unsupported_withdrawal_cap"
    assert result["summary"]["child_shortfall_total"] > 0


def test_negative_and_zero_return_rounding():
    assert won(Decimal("1.5")) == 2
    assert won(Decimal("-1.5")) == -2
    for rate in [-0.1, 0]:
        result = simulate({**DEFAULTS, "net_real_return": rate}, "B")
        assert all(x["end_balance"] >= 0 for x in result["child_timeline"])


def test_changed_cases_full_paths_and_minimum():
    cases = [
        {"monthly_survivor_pension": 0},
        {"monthly_child_cost": 1500000},
        {"monthly_child_cost": 1850000, "child_end_age": 83},
        {"net_real_return": -0.005, "monthly_survivor_pension": 940000},
        {"monthly_parent_reemployment_income": 0},
    ]
    for changes in cases:
        inputs = {**DEFAULTS, **changes}
        minimum = required(inputs, inputs["child_end_age"])
        if minimum is not None:
            assert all(
                row["shortfall"] == 0 for row in post_parent_path(minimum, inputs)
            )
            if minimum:
                assert any(
                    row["shortfall"] > 0
                    for row in post_parent_path(minimum - 1, inputs)
                )
        for strategy in ["B", "B_PRIME"]:
            result = simulate(inputs, strategy)
            assert result["effective_inputs"] == inputs
            assert result["summary"]["child_shortfall_total"] == sum(
                row.get("shortfall", 0) for row in result["child_timeline"]
            )


def test_failure_job_reveals_parent_problem():
    result = simulate({**DEFAULTS, "monthly_parent_reemployment_income": 0}, "B")
    assert result["summary"]["parent_asset_min"] < 0
    assert result["summary"]["parent_first_negative_year"] is not None
    assert result["summary"]["parent_feasible"] is False
