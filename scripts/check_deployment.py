"""Check guest calculations and optionally verify demo login."""

import http.cookiejar
import json
import os
import sys
import urllib.request

base = sys.argv[1].rstrip("/")
release = sys.argv[2]
client = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())
)


def request(path, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        base + path, data=data, headers={"Content-Type": "application/json"}
    )
    with client.open(req, timeout=30) as response:
        return json.load(response)


health = request("/api/health")
assert health["status"] == "ok" and health["release"] == release
assert health["assumption_version"] == "report-reproduction-2026-11-09-v1"
assert request("/api/session") == {"authenticated": False}
strategies = []
def verify_calculations():
    ref = request("/api/reference-case")
    assert health["assumption_version"] == ref["assumptions"]["version"]
    assert ref["source_version"] == "v1.5-calculation-detail-2026-11-09"
    for strategy in ("B", "B_PRIME"):
        result = request("/api/simulations", {
            "case_id": ref["case_id"], "strategy": strategy, "overrides": {}
        })
        assert result["status"] == "calculated"
        assert result["assumption_version"] == ref["assumptions"]["version"]
        assert result["summary"]["required_trust_83"] == 130000000
        assert result["summary"]["required_trust_95"] == 175000000
        assert result["parent_timeline"] and result["child_timeline"]
        assert next(row for row in result["child_timeline"] if row["child_age"] == 65)["benefit_regime"] == "old_age"
        strategies.append(strategy)

verify_calculations()
password = os.getenv("CARE_SMOKE_PASSWORD")
if password:
    assert request("/api/session/login", {"username": os.environ["CARE_SMOKE_USERNAME"], "password": password})["authenticated"]
    assert request("/api/session") == {"authenticated": True}
    assert request("/api/session/logout", {}) == {"authenticated": False}
    assert request("/api/session") == {"authenticated": False}

print(json.dumps({"health": health, "guest_strategies": strategies, "checks": "passed"}, ensure_ascii=False))
