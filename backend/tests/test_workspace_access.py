import pytest
from fastapi.testclient import TestClient
from app import auth, trust
from app.engine import benefits
from app.main import app


@pytest.fixture
def demo(monkeypatch, tmp_path):
    password = "test-demo-password-000"
    monkeypatch.setenv("CARE_AUTH_DB", str(tmp_path / "accounts.sqlite3"))
    auth.create_account("tester", password)
    monkeypatch.delenv("CARE_DEMO_LOCAL_HTTP", raising=False)
    yield TestClient(app, base_url="https://testserver"), password


def test_guest_simulation_and_optional_session(demo):
    client, password = demo
    assert client.get("/api/health").json()["account_login_enabled"]
    assert client.get("/api/session").json() == {"authenticated": False}
    ref = client.get("/api/reference-case").json()
    calculated = client.post("/api/simulations", json={"case_id": ref["case_id"], "strategy": "B"})
    assert calculated.json()["status"] == "calculated"
    assert client.post("/api/trust-explain", json={"source_ids": ["kb-care"]}).status_code == 200
    assert client.post("/api/session/login", json={"username": "tester", "password": "wrong"}).status_code == 401
    response = client.post("/api/session/login", json={"username": "tester", "password": password})
    assert response.json() == {"authenticated": True}
    cookie = response.headers["set-cookie"].lower()
    assert all(flag in cookie for flag in ("httponly", "secure", "samesite=strict"))
    token = client.cookies[auth.COOKIE]
    assert client.get("/api/reference-case").status_code == 200
    assert client.post("/api/session/logout", json={}).status_code == 200
    client.cookies.set(auth.COOKIE, token)
    assert client.get("/api/session").json() == {"authenticated": False}
    assert client.get("/api/reference-case").status_code == 200


def test_login_requires_https_and_matching_account(demo, monkeypatch):
    client, password = demo
    assert client.post("http://testserver/api/session/login", json={"username": "tester", "password": password}).status_code == 403
    assert client.post("/api/session/login", json={"username": "unknown", "password": password}).status_code == 401
    assert client.post("/api/session/login", json={"password": password}).status_code == 422


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
    client.post("/api/session/login", json={"username": "tester", "password": password})
    monkeypatch.delenv("UPSTAGE_LLM_API_KEY", raising=False)
    catalog = client.get("/api/trust-sources").json()["sources"]
    assert len([source for source in catalog if source["bank"]]) == 8
    assert client.post("/api/trust-explain", json={"source_ids": ["arbitrary user text"]}).status_code == 422
    assert client.post("/api/trust-explain", json={"source_ids": ["kb-care"], "query": "arbitrary user text"}).status_code == 422
    response = client.post("/api/trust-explain", json={"source_ids": ["kb-care"]}).json()
    assert response["mode"] == "official_sources"
    assert [source["id"] for source in response["sources"]] == ["kb-care"]


def test_semantic_search_uses_retrieved_source_ids_and_degrades_to_keywords(demo, monkeypatch):
    client, _ = demo
    query = "부모가 떠난 뒤 보험금을 나눠 지급할 수 있나요?"
    monkeypatch.setenv("UPSTAGE_LLM_API_KEY", "test-key")
    monkeypatch.setattr(trust, "passage_vectors", None)
    index = next(i for i, source in enumerate(trust.SOURCES) if source["id"] == "shinhan-sol")
    calls = []

    async def embed(client, key, texts, role):
        calls.append((role, texts))
        if role == "passage":
            return [[int(i == j) for j in range(len(texts))] for i in range(len(texts))]
        return [[int(index == i) for i in range(len(trust.SOURCES))]]

    async def choose(sources, text):
        assert text == query
        assert sources[0]["id"] == "shinhan-sol"
        return sources[:1]

    monkeypatch.setattr(trust, "embed", embed)
    monkeypatch.setattr(trust, "choose_sources", choose)
    for _ in range(2):
        response = client.post("/api/trust-explain", json={"semantic_query": query})
        assert response.json() == {
            "mode": "semantic_llm_sources", "sources": [trust.BY_ID["shinhan-sol"]],
        }
    assert [role for role, _ in calls] == ["passage", "query", "query"]
    assert query not in calls[0][1]
    async def unavailable(*args):
        return None

    async def choose_from_catalog(sources, text):
        assert sources == trust.SOURCES
        assert text == query
        return [trust.BY_ID["shinhan-sol"]]

    monkeypatch.setattr(trust, "retrieve", unavailable)
    monkeypatch.setattr(trust, "choose_sources", choose_from_catalog)
    response = client.post("/api/trust-explain", json={"semantic_query": query})
    assert response.json() == {
        "mode": "llm_sources", "sources": [trust.BY_ID["shinhan-sol"]],
    }

    monkeypatch.setattr(trust, "choose_sources", unavailable)
    response = client.post(
        "/api/trust-explain", json={"semantic_query": query, "source_ids": ["kb-care"]}
    )
    assert response.json() == {"mode": "official_sources", "sources": [trust.BY_ID["kb-care"]]}


def test_operator_accounts_persistence_and_independent_sessions(demo, monkeypatch):
    client, _ = demo
    other = TestClient(app, base_url="https://testserver")
    password = "individual-password-123"
    body = {"username": "Second.User", "password": password}
    assert client.post("/api/session/register", json=body).status_code == 404
    auth.create_account(body["username"], password)
    with pytest.raises(ValueError, match="이미 사용"):
        auth.create_account("second.user", password)
    with pytest.raises(ValueError, match="비밀번호"):
        auth.create_account("another", "short")
    with pytest.raises(ValueError, match="아이디"):
        auth.create_account("bad name", password)

    assert client.post("/api/session/login", json=body).json() == {"authenticated": True}
    assert other.post("/api/session/login", json={"username": "tester", "password": "test-demo-password-000"}).json() == {"authenticated": True}
    token = client.cookies[auth.COOKIE]
    # A new client can read a persisted session, with no in-memory authentication state.
    restored = TestClient(app, base_url="https://testserver")
    restored.cookies.set(auth.COOKIE, token)
    assert restored.get("/api/session").json() == {"authenticated": True}
    client.post("/api/session/logout", json={})
    assert restored.get("/api/session").json() == {"authenticated": False}
    assert other.get("/api/session").json() == {"authenticated": True}
    with auth.database() as connection:
        row = connection.execute("SELECT password_hash FROM accounts WHERE username = 'second.user'").fetchone()
        assert row[0] != password.encode()
        connection.execute("UPDATE sessions SET expires = 0")
    assert other.get("/api/session").json() == {"authenticated": False}
