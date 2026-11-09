"""Build fixed reference charts from the existing engine, without new APIs.

The review PDF's illustrations are references, not calibration targets. Never
adjust points to match rounded report labels. Run --check to detect data drift.
"""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
from app.contracts import DEFAULTS, SOURCE_VERSION
from app.engine import CONFIG, benefits, simulate


def build():
    # Retain both sides of known transitions; a coarse grid alone hides cliffs.
    boundaries = {
        88_388_499, 88_388_500, 119_000_299, 119_000_300, 130_000_000,
        335_089_999, 335_090_000, 440_000_299, 440_000_300,
    }
    balances = sorted(set(range(0, 600_000_001, 1_000_000)) | boundaries)
    curves = [
        {
            "age": age,
            "survivor_monthly": pension,
            "points": [
                [balance, sum(benefits(age, balance, pension).values())]
                for balance in balances
            ],
        }
        for age in (64, 65)
        for pension in (0, 1_070_000)
    ]
    trust = []
    for strategy in ("B", "B_PRIME"):
        result = simulate(dict(DEFAULTS), strategy)
        summary = result["summary"]
        path = {
            phase: [
                [row["child_age"], row["end_balance"]]
                for row in result["child_timeline"] if row["phase"] == phase
            ]
            for phase in ("accumulation", "withdrawal")
        }
        trust.append({
            "strategy": strategy,
            "pre_supplement": summary["pre_supplement_trust_at_56"],
            "supplement": summary["supplement_at_56"],
            "projected": summary["projected_trust_at_56"],
            **path,
        })
    return {
        "source_version": SOURCE_VERSION,
        "assumption_version": CONFIG["version"],
        "engine_sha256": hashlib.sha256(
            (ROOT / "backend/app/engine.py").read_bytes()
        ).hexdigest(),
        "base_year": 2026,
        "inputs": DEFAULTS,
        "money_unit": "KRW_integer",
        "sampling": "1,000,000 KRW grid plus transition edges; annual trust end balances",
        "benefit_curves": curves,
        "trust": trust,
    }


if __name__ == "__main__":
    output = ROOT / "frontend/src/report-baseline.json"
    content = json.dumps(build(), ensure_ascii=False, separators=(",", ":")) + "\n"
    if "--check" in sys.argv:
        if not output.exists() or output.read_text() != content:
            raise SystemExit(
                "Report reference data is stale. Run python3 scripts/build_report_data.py."
            )
        print("Report reference data matches the engine and assumptions.")
    else:
        output.write_text(content)
        print("Generated report reference data.")
