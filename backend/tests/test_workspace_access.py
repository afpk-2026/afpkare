import pytest
from fastapi.testclient import TestClient
from app import auth
from app.engine import benefits
from app.main import app


@pytest.fixture
def demo(monkeypatch):
    password = "test-demo-password-000"
    salt = bytes(16)
    monkeypatch.setenv(
        "CARE_DEMO_PASSWORD_HASH", f"{salt.hex()}:{auth.password_hash(password, salt).hex()}"
    )
    monkeypatch.delenv("CARE_DEMO_LOCAL_HTTP", raising=False)
    yield TestClient(app, base_url="https://testserver"), password
    auth.sessions.clear()


def test_guest_simulation_and_optional_session(demo):
    client, password = demo
    assert client.get("/api/health").json()["demo_login_ready"]
    assert client.get("/api/session").json() == {"authenticated": False}
    ref = client.get("/api/reference-case").json()
    calculated = client.post("/api/simulations", json={"case_id": ref["case_id"], "strategy": "B"})
    assert calculated.json()["status"] == "calculated"
    assert client.post("/api/trust-explain", json={"source_ids": ["kb-care"]}).status_code == 200
    assert client.post("/api/session/login", json={"password": "wrong"}).status_code == 401
    response = client.post("/api/session/login", json={"password": password})
    assert response.json() == {"authenticated": True}
    cookie = response.headers["set-cookie"].lower()
    assert all(flag in cookie for flag in ("httponly", "secure", "samesite=strict"))
    token = client.cookies[auth.COOKIE]
    assert client.get("/api/reference-case").status_code == 200
    assert client.post("/api/session/logout", json={}).status_code == 200
    client.cookies.set(auth.COOKIE, token)
    assert client.get("/api/session").json() == {"authenticated": False}
    assert client.get("/api/reference-case").status_code == 200


def test_login_requires_https_and_configured_secret(demo, monkeypatch):
    client, password = demo
    assert client.post("http://testserver/api/session/login", json={"password": password}).status_code == 403
    monkeypatch.delenv("CARE_DEMO_PASSWORD_HASH")
    assert client.post("/api/session/login", json={"password": password}).status_code == 503


def test_benefit_curves_use_selected_survivor_pension(demo):
    client, _ = demo
    url = "/api/benefit-curves"
    assert client.get(url, params={"survivor_monthly": -1}).status_code == 422
    zero = client.get(url, params={"survivor_monthly": 0}).json()
    pension = 800_000
    selected = client.get(url, params={"survivor_monthly": pension}).json()
    assert selected["survivor_monthly"] == pension
    assert selected["assumption_version"] == client.get("/api/health").json()["assumption_version"]
    assert [curve["age"] for curve in selected["curves"]] == [64, 65]
    for curve in selected["curves"]:
        balance, monthly = curve["points"][100]
        assert balance == 100_000_000
        assert monthly == sum(benefits(curve["age"], balance, pension).values())
    assert selected["curves"][0]["points"][0] != zero["curves"][0]["points"][0]


def test_sources_allowlist_keeps_unreviewed_text_out_of_provider(demo, monkeypatch):
    client, password = demo
    client.post("/api/session/login", json={"password": password})
    monkeypatch.delenv("UPSTAGE_LLM_API_KEY", raising=False)
    catalog = client.get("/api/trust-sources").json()["sources"]
    assert len([source for source in catalog if source["bank"]]) == 8
    assert client.post("/api/trust-explain", json={"source_ids": ["arbitrary user text"]}).status_code == 422
    assert client.post("/api/trust-explain", json={"source_ids": ["kb-care"], "query": "arbitrary user text"}).status_code == 422
    response = client.post("/api/trust-explain", json={"source_ids": ["kb-care"]}).json()
    assert response["mode"] == "official_sources"
    assert [source["id"] for source in response["sources"]] == ["kb-care"]
