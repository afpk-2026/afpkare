"""Read-only public API verification; writes no browser/LLM/private state.

python3 scripts/check_public.py http://SERVER
"""

import json
import sys
import urllib.request
import urllib.error

base = sys.argv[1].rstrip("/")


def request(path, body=None, expected=200):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        base + path, data=data, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=35) as response:
            status = response.status
            payload = json.load(response)
    except urllib.error.HTTPError as exc:
        status = exc.code
        payload = json.load(exc)
    assert status == expected, (path, status, expected)
    return payload


health = request("/api/health")
assert health["calculation_status"] == "assumption_based"
ref = request("/api/reference-case")
case = {"case_id": ref["case_id"], "strategy": "B", "overrides": {}}
base_b = request("/api/simulations", case)
base_bp = request("/api/simulations", {**case, "strategy": "B_PRIME"})
changed = request(
    "/api/simulations", {**case, "overrides": {"monthly_child_cost": 1850000}}
)
assert (
    changed["summary"]["required_trust_at_56"]
    > base_b["summary"]["required_trust_at_56"]
)
assert (
    changed["summary"]["child_shortfall_total"]
    >= base_b["summary"]["child_shortfall_total"]
)
for response in [base_b, base_bp, changed]:
    assert response["child_timeline"] and response["parent_timeline"]
    transition = next(x for x in response["child_timeline"] if x["child_age"] == 65)
    assert transition["year"] == 2071 and transition["benefit_regime"] == "old_age"
    assert response["warnings"] and response["source_refs"]
invalid = request(
    "/api/simulations", {**case, "overrides": {"monthly_child_cost": -1}}, 422
)
assert invalid["status"] == "invalid_input"
request("/api/simulations", {**case, "strategy": "A"}, 422)
cap = request(
    "/api/simulations",
    {
        **case,
        "overrides": {"monthly_child_cost": 10000000, "monthly_survivor_pension": 0},
    },
)
assert cap["summary"]["required_trust_at_56"] is None
assert cap["summary"]["required_status"] == "unsupported_withdrawal_cap"
private = request(
    "/api/parse-change", {"text": "홍길동 010-1111-2222 생활비 월185만 원"}, 422
)
assert "홍길동" not in json.dumps(private, ensure_ascii=False)
proposal = request("/api/parse-change", {"text": "생활비가 월 185만 원이면?"})
assert proposal == {
    "status": "proposal",
    "changes": {"monthly_child_cost": 1850000},
    "requires_confirmation": True,
}
print(
    json.dumps(
        {
            "base_url": base,
            "health": health,
            "checks": "passed",
            "base_B": base_b["summary"],
            "base_B_PRIME": base_bp["summary"],
            "changed_cost185": changed["summary"],
            "f07": "real Upstage proposal validated",
        },
        ensure_ascii=False,
        indent=2,
    )
)
