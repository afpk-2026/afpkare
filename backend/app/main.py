import asyncio
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

app = FastAPI(title="부모가 없는 날 · 가상 사례 API", version="0.2.0")
llm_gate = asyncio.Semaphore(2)
BLOCKERS = [
    "연간 처리 순서·기간 포함·반올림 규칙 미확정",
    "부모 연도별 현금흐름·수익률 입력표 없음",
    "65세 전후 급여 전체 산식·예금 처리 미확정",
    "B′ 납입·사후 보충 계약 미확정",
]


@app.middleware("http")
async def boundaries(request: Request, call_next):
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
                    "field": ".".join(str(x) for x in e["loc"][1:]),
                    "message": "지원 필드·형식·허용 범위를 확인해 주세요.",
                }
                for e in exc.errors()
            ],
        },
    )


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "version": "0.2.0",
        "release": os.getenv("APP_VERSION", "local"),
        "assumption_version": CONFIG["version"],
        "calculation_status": "assumption_based",
    }


@app.get("/api/reference-case")
def reference():
    return {
        "case_id": CASE_ID,
        "source_version": SOURCE_VERSION,
        "base_year": 2026,
        "defaults": DEFAULTS,
        "fields": FIELDS,
        "calculation_status": "assumption_based",
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
                "detail": "83세 1.30억·95세 1.75억은 대조값. 예금 1천만 원 처리 시 83세 1.35억이라는 검토 메모가 있어 확정 필요.",
            },
            {
                "ref": "식 3 / 그림 6",
                "status": "가정 기반 직접 계산",
                "detail": "부모 금융자산은 가상 연도별 입력표로 계산. 주택연금 월110만·소비·재취업 기간·부모 사망 연도는 팀 보강 필요.",
            },
            {
                "ref": "표 9-2·10",
                "status": "상품 서면 미확인",
                "detail": "B/B′는 자익형 기준. 첫 납입·추가 납입 단위와 보수 조건 확인 필요.",
            },
            {
                "ref": "그림 5",
                "status": "해석 미확인",
                "detail": "65세(2071년) 급여 모형을 자동 전환. 2026년 기준 연속 감액 단순모형이며 실제 수급 판정 아님. 예금1천만 원은 재산에 포함.",
            },
        ],
        "report_values": {
            "required_83": 130000000,
            "required_95": 175000000,
            "projected_b_56": 181000000,
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
                "label": "1.00억 + 사후 0.35억",
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
