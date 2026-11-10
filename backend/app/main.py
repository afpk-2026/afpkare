import asyncio
import hmac
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, Field
from . import auth, trust
import os
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from .contracts import (
    CASE_ID,
    SOURCE_VERSION,
    DEFAULTS,
    FIELDS,
    SAMPLES,
    SimulationRequest,
    ParseRequest,
    supported_sentence,
)
from .proposals import propose, ProposalUnavailable
from .engine import simulate as run_simulation, CONFIG

app = FastAPI(title="부모가 없는 날 · 가상 사례 API", version="0.3.0")
llm_gate = asyncio.Semaphore(2)
login_gate = asyncio.Semaphore(2)
BLOCKERS = [
    "제공된 persona_v3.txt의 핵심 경로·입력 변경은 대조했으나 전체 기능 동등성 미검증",
    "급여·예금의 실제 자산조사 반영은 기관 확인 전 가상 사례 규칙",
    "신탁 첫 납입·추가 납입·사후 보충의 상품 실행 조건 서면 미확인",
    "복잡한 사망 사건·최소최대후회 동적 계산은 현재 P0 범위 밖",
]


@app.middleware("http")
async def boundaries(request: Request, call_next):
    public = {"/api/health", "/api/session", "/api/session/login", "/api/session/logout"}
    if request.url.path.startswith("/api/") and request.url.path not in public and not auth.authenticated(request):
        return api_status(401, "로그인이 필요합니다.")
    if request.url.path in {"/api/session/login", "/api/session/logout"} and request.method == "POST":
        if request.headers.get("content-type", "").split(";")[0] != "application/json":
            return api_status(415, "요청 형식을 확인해 주세요.")
    if request.method == "POST":
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 4096:
                return JSONResponse(
                    status_code=413,
                    content={
                        "status": "invalid_input",
                        "message": "요청은 4KB 이하여야 합니다.",
                    },
                )
        request._body = bytes(body)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.exception_handler(RequestValidationError)
async def invalid(request, exc):
    # Never echo the submitted body (may contain disallowed personal information).
    return JSONResponse(
        status_code=422,
        content={
            "status": "invalid_input",
            "field_errors": [
                {
                    "field": "request" if e["type"] == "extra_forbidden" else ".".join(str(x) for x in e["loc"][1:]),
                    "message": "지원 필드·형식·허용 범위를 확인해 주세요.",
                }
                for e in exc.errors()
            ],
        },
    )


def api_status(code, message):
    return JSONResponse(
        status_code=code, content={"message": message},
        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )


class DemoLogin(BaseModel):
    model_config = ConfigDict(extra="forbid")
    password: str = Field(min_length=1, max_length=128)


@app.get("/api/session")
def session_status(request: Request):
    return {"authenticated": auth.authenticated(request)}


@app.post("/api/session/login")
async def login(data: DemoLogin, request: Request):
    secure = auth.secure_transport(request)
    if not (secure or auth.local_http()):
        return api_status(403, "HTTPS에서 로그인해 주세요.")
    credentials = auth.credentials()
    if credentials is None:
        return api_status(503, "운영자가 데모 로그인을 준비 중입니다.")
    salt, expected = credentials
    if login_gate.locked():
        return api_status(429, "로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.")
    async with login_gate:
        actual = await run_in_threadpool(auth.password_hash, data.password, salt)
    if not hmac.compare_digest(actual, expected):
        return api_status(401, "데모 비밀번호를 확인해 주세요.")
    auth.revoke(request)
    token = auth.issue_session()
    if token is None:
        return api_status(503, "접속이 많습니다. 잠시 후 다시 시도해 주세요.")
    response = JSONResponse({"authenticated": True})
    response.set_cookie(auth.COOKIE, token, max_age=auth.LIFETIME, httponly=True,
                        secure=secure, samesite="strict")
    return response


@app.post("/api/session/logout")
async def logout(request: Request):
    auth.revoke(request)
    response = JSONResponse({"authenticated": False})
    response.delete_cookie(auth.COOKIE, httponly=True, secure=auth.secure_transport(request),
                           samesite="strict")
    return response


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "demo_login_ready": auth.credentials() is not None,
        "version": "0.3.0",
        "release": os.getenv("APP_VERSION", "local"),
        "assumption_version": CONFIG["version"],
        "calculation_status": "report_detail_based_unverified_policy",
    }


@app.get("/api/reference-case")
def reference():
    return {
        "case_id": CASE_ID,
        "source_version": SOURCE_VERSION,
        "base_year": 2026,
        "defaults": DEFAULTS,
        "fields": FIELDS,
        "calculation_status": "report_detail_based_unverified_policy",
        "blockers": BLOCKERS,
        "assumptions": CONFIG,
        "evidence": [
            {
                "ref": "표 4·5",
                "status": "가상 설정",
                "detail": "사후 생활비 180만 원, 유족연금 107만 원. 유족연금 생계유지 인정은 기관 해석 미확인.",
            },
            {
                "ref": "식 1·2 / 표 8",
                "status": "보고서 고정값",
                "detail": "세부 PDF의 500만 원 격자·해 초 급여 판정·연말 수익 규칙으로 83세 1.30억·95세 1.75억을 재현. 실제 자산조사에서 예금 1천만 원 반영은 기관 확인 필요.",
            },
            {
                "ref": "식 3 / 그림 6",
                "status": "보고서 세부식 기반 직접 계산",
                "detail": "2031년 근로·세전 퇴직급여, 2032~2035년 재취업, 주택연금 월126.4만, 연령별 소비를 반영한 그림 6 기본 경로. 기관·상품 조건은 별도 확인.",
            },
            {
                "ref": "표 9-2·10",
                "status": "상품 서면 미확인",
                "detail": "B/B′는 자익형 기준. B′ 사후 보충액은 95세 필요액과 상속 가능액에 따라 계산. 실제 첫 납입·추가 납입·보수 조건은 확인 필요.",
            },
            {
                "ref": "그림 5",
                "status": "해석 미확인",
                "detail": "65세(2071년) 급여 모형을 자동 전환. PDF의 감액 구간·절사 규칙을 재현하며 신탁 잔액만 급여 재산에 넣는 보고서 가정. 실제 수급 판정 아님.",
            },
        ],
        "report_values": {
            "required_83": 130000000,
            "required_95": 175000000,
            "projected_b_56": 181269636,
        },
        "report_comparison": [
            {
                "strategy": "A",
                "label": "최대 이전",
                "costs": [0.65, 1.05, 2.83, 0.72],
                "max_regret": 0.96,
            },
            {
                "strategy": "B",
                "label": "단계 적립 1.30억",
                "costs": [0.45, 0.70, 1.87, 0.45],
                "max_regret": 0.03,
            },
            {
                "strategy": "B_PRIME",
                "label": "1.00억 + 사후 필요액 보충",
                "costs": [0.45, 0.85, 2.01, 0.45],
                "max_regret": 0.15,
            },
            {
                "strategy": "D",
                "label": "법정상속",
                "costs": [0.42, 0.86, 2.12, 1.01],
                "max_regret": 0.56,
            },
        ],
        "samples": [{"id": key, "text": v[0]} for key, v in SAMPLES.items()],
    }


@app.post("/api/simulations")
def simulate(body: SimulationRequest):
    try:
        changes = body.overrides.changes()
    except ValueError:
        return JSONResponse(
            status_code=422,
            content={
                "status": "invalid_input",
                "field_errors": [
                    {
                        "field": "overrides",
                        "message": "null 변경값은 허용하지 않습니다.",
                    }
                ],
            },
        )
    return {
        **run_simulation({**DEFAULTS, **changes}, body.strategy),
        "case_id": CASE_ID,
        "source_version": SOURCE_VERSION,
    }


@app.post("/api/parse-change")
async def parse_change(body: ParseRequest):
    # Validate the whole sentence before sending it to Upstage; never log request text.
    try:
        if (body.sample_id is None) == (body.text is None):
            raise ValueError("문장 또는 예시 중 하나만 지정해 주세요.")
        if body.sample_id:
            sentence, expected = SAMPLES[body.sample_id]
        else:
            sentence = body.text
            expected = supported_sentence(sentence)
    except ValueError as exc:
        return JSONResponse(
            status_code=422,
            content={
                "status": "invalid_input",
                "message": "지원 문장 형식을 확인해 주세요. 예시처럼 입력 하나와 명확한 값·단위만 작성할 수 있습니다.",
            },
        )
    if llm_gate.locked():
        return JSONResponse(
            status_code=429,
            content={
                "status": "unavailable",
                "message": "제안 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
            },
        )
    async with llm_gate:
        try:
            changes = await propose(sentence, expected)
        except ProposalUnavailable as exc:
            return JSONResponse(
                status_code=503, content={"status": "unavailable", "message": str(exc)}
            )
    return {"status": "proposal", "changes": changes, "requires_confirmation": True}


@app.get("/api/trust-sources")
def trust_sources():
    return {"sources": trust.SOURCES}


@app.post("/api/trust-explain")
async def trust_explain(question: trust.TrustQuestion):
    ids = list(dict.fromkeys(question.source_ids))
    if any(value not in trust.BY_ID for value in ids):
        return api_status(422, "등록된 신탁 자료를 선택해 주세요.")
    sources = [trust.BY_ID[value] for value in ids]
    chosen = None
    if not llm_gate.locked():
        async with llm_gate:
            chosen = await trust.choose_sources(sources)
    return {
        "mode": "llm_sources" if chosen else "official_sources",
        "sources": chosen or sources,
    }
