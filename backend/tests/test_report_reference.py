"""Prevent bundled reference charts drifting away from the calculator."""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def test_reference_charts_match_current_engine_and_boundary_examples():
    subprocess.run([sys.executable, str(ROOT / 'scripts/build_report_data.py'), '--check'], check=True, capture_output=True)
    data = json.loads((ROOT / 'frontend/src/report-baseline.json').read_text())
    curves = {(c['age'], c['survivor_monthly']): dict(c['points']) for c in data['benefit_curves']}
    assert curves[64, 1070000][119000300] == 0
    assert curves[65, 1070000][130000000] == 349700
    assert curves[65, 1070000][440000300] == 0
    b, bp = data['trust']
    assert b['projected'] == 181269636
    assert bp['pre_supplement'] == 139604809
    assert bp['supplement'] == 35395191
    assert b['withdrawal'][-1] == [95,12398834]


def test_slot_costs_reproduce_table_9_and_follow_selected_horizon():
    from app.contracts import DEFAULTS
    from app.engine import simulate

    b = simulate(DEFAULTS, "B")["summary"]["comparison_costs"]
    bp = simulate(DEFAULTS, "B_PRIME")["summary"]["comparison_costs"]
    assert b["83"] == {"shortfall": 0, "lost_benefits": 45_360_000, "cost": 45_360_000}
    assert bp["83"] == {"shortfall": 0, "lost_benefits": 44_760_000, "cost": 44_760_000}
    inputs = {**DEFAULTS, "child_end_age": 90, "monthly_child_cost": 2_100_000}
    summary = simulate(inputs, "B")["summary"]
    costs = summary["comparison_costs"]
    assert set(costs) == {"83", "90", "95"}
    assert costs["90"]["shortfall"] == summary["child_shortfall_total"] > 0
    assert costs["90"]["cost"] == 3 * costs["90"]["shortfall"] + costs["90"]["lost_benefits"]
    assert costs["95"]["shortfall"] >= costs["90"]["shortfall"]
