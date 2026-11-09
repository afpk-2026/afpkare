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
        130000000 if strategy == "B" else 100000000
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
    if minimum is None:
        # A finite 15억 원 grid can have no feasible point under a long horizon
        # and negative return; never invent a required balance in that case.
        assert all(
            any(x["shortfall"] > 0 for x in post_parent_path(candidate, inputs))
            for candidate in range(0, 1500000001, 5000000)
        )
        return
    assert all(x["shortfall"] == 0 for x in post_parent_path(minimum, inputs))
    if minimum:
        assert all(
            any(x["shortfall"] > 0 for x in post_parent_path(candidate, inputs))
            for candidate in range(0, minimum, 5000000)
        )


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
    assert retirement["components"]["wage"] == 62400000
    assert retirement["components"]["retirement_gross"] == 200000000
    assert retirement["components"]["retirement_tax"] == 0
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
        == 15168000
    )


def test_known_benefits_and_report_asset_boundary():
    at64 = benefits(64, 0, 1070000)
    assert at64["disability"] == 340000 and at64["addon"] == 80000
    at65 = benefits(65, 0, 1070000)
    assert (
        at65["disability"] == 0 and at65["old_age"] == 349700 and at65["addon"] == 50000
    )
    assert benefits(64, 119000000, 1070000)["disability"] == 20000
    assert sum(benefits(64, 119000300, 1070000).values()) == 0


def test_cap_impossible_is_not_a_fake_number():
    inputs = {**DEFAULTS, "monthly_child_cost": 10000000, "monthly_survivor_pension": 0}
    assert required(inputs, 95) is None
    result = simulate(inputs, "B")
    assert result["summary"]["required_status"] == "unsupported_withdrawal_cap"
    assert result["summary"]["child_shortfall_total"] > 0


def test_negative_and_zero_return_rounding():
    assert won(Decimal("1.5")) == 1
    assert won(Decimal("-1.5")) == -1
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
                assert all(
                    any(row["shortfall"] > 0 for row in post_parent_path(candidate, inputs))
                    for candidate in range(0, minimum, 5000000)
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


def test_pdf_reference_values_and_annual_order():
    # v1.5 detailed-calculation PDF: the grid minima and intermediate values,
    # rather than just the two rounded headline numbers.
    assert required(DEFAULTS, 83) == 130000000
    assert required(DEFAULTS, 95) == 175000000
    rows = post_parent_path(130000000, DEFAULTS, 83)
    assert {age: next(row["start_balance"] for row in rows if row["child_age"] == age)
            for age in [57, 58, 65, 83]} == {
                57: 122452400,
                58: 114829324,
                65: 71667920,
                83: 7202928,
            }
    assert sum(row["shortfall"] for row in post_parent_path(125000000, DEFAULTS, 83)) == 1622100


def test_pdf_b_and_b_prime_estate_and_parent_path():
    b = simulate(DEFAULTS, "B")
    bp = simulate(DEFAULTS, "B_PRIME")
    assert b["summary"]["pre_supplement_trust_at_56"] == 181269636
    assert b["summary"]["parent_asset_min"] == 54993327
    assert b["summary"]["parent_estate_at_56"] == 131405335
    assert next(x for x in b["parent_timeline"] if x["year"] == 2062)["end_balance"] == 106907543
    assert bp["summary"]["pre_supplement_trust_at_56"] == 139604809
    assert bp["summary"]["supplement_at_56"] == 35395191
    assert bp["summary"]["projected_trust_at_56"] == 175000000
    assert bp["summary"]["parent_estate_at_56"] == 173070166


def test_pdf_benefit_cliffs_and_parent_return_tracks_case_rate():
    expected = [
        (0, 56, 420000), (100000000, 56, 110000),
        (119000000, 56, 50000), (119000300, 56, 0),
        (0, 65, 399700), (130000000, 65, 349700),
        (338000000, 65, 340000), (440000000, 65, 34970),
        (440000300, 65, 0),
    ]
    for trust, age, monthly in expected:
        assert sum(benefits(age, trust, 1070000).values()) == monthly
    changed = {**DEFAULTS, "net_real_return": 0}
    assert simulate(changed, "B")["parent_timeline"] != simulate(DEFAULTS, "B")["parent_timeline"]
    assert next(x for x in simulate(changed, "B")["parent_timeline"] if x["year"] == 2062)["end_balance"] == 72904000


def test_original_case_survivor_change_reaches_widowed_parent_path():
    baseline = simulate(DEFAULTS, "B")
    no_survivor = simulate({**DEFAULTS, "monthly_survivor_pension": 0}, "B")
    assert baseline["parent_timeline"][:28] == no_survivor["parent_timeline"][:28]
    assert no_survivor["parent_timeline"][-1]["end_balance"] == -13384346
