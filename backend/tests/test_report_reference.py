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
