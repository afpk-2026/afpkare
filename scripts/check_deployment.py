"""Deterministic public deployment smoke check. LLM availability is checked separately."""
import json
import sys
import urllib.request

base = sys.argv[1].rstrip("/")
release = sys.argv[2]

def request(path, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(base + path, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)

health = request("/api/health")
assert health["status"] == "ok" and health["release"] == release
ref = request("/api/reference-case")
assert health["assumption_version"] == ref["assumptions"]["version"] == "report-reproduction-2026-11-09-v1"
assert ref["source_version"] == "v1.5-calculation-detail-2026-11-09"
for strategy in ("B", "B_PRIME"):
    result = request("/api/simulations", {"case_id": ref["case_id"], "strategy": strategy, "overrides": {}})
    assert result["status"] == "calculated"
    assert result["assumption_version"] == ref["assumptions"]["version"]
    assert result["summary"]["required_trust_83"] == 130000000
    assert result["summary"]["required_trust_95"] == 175000000
    assert result["parent_timeline"] and result["child_timeline"]
    assert next(row for row in result["child_timeline"] if row["child_age"] == 65)["benefit_regime"] == "old_age"
print(json.dumps({"health": health, "strategies": ["B", "B_PRIME"], "checks": "passed"}, ensure_ascii=False))
