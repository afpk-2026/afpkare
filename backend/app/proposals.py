"""Only fully validated fictional change sentences cross the external LLM boundary."""

import asyncio
import json
import logging
import os
import httpx
from .contracts import FIELDS, Overrides


class ProposalUnavailable(Exception):
    pass


class InvalidProposal(ValueError):
    pass


def read_proposal(payload, expected):
    if payload.get("status") != "completed":
        raise InvalidProposal("incomplete")
    outputs = [
        part["text"]
        for item in payload.get("output", [])
        for part in item.get("content", [])
        if part.get("type") == "output_text"
    ]
    raw = json.loads("".join(outputs))
    parsed = Overrides.model_validate(raw).changes()
    if parsed != expected:
        raise InvalidProposal("meaning_mismatch")
    return parsed


async def propose(sentence: str, expected: dict):
    key, model = (
        os.getenv("UPSTAGE_LLM_API_KEY"),
        os.getenv("UPSTAGE_MODEL", "solar-mini4"),
    )
    if not key or not model:
        raise ProposalUnavailable(
            "서버 LLM 키 또는 모델이 설정되지 않았습니다. 수동 입력을 이용해 주세요."
        )
    properties = {
        name: {
            "type": "number" if name == "net_real_return" else "integer",
            "description": (
                "연 비율. 퍼센트를 100으로 나눈 값. 예: -0.5%=-0.005."
                if name == "net_real_return"
                else f'{FIELDS[name]["label"]} · {FIELDS[name]["unit"]}'
            ),
            "minimum": FIELDS[name]["min"],
            "maximum": FIELDS[name]["max"],
        }
        for name in expected
    }
    schema = {
        "type": "object",
        "properties": properties,
        "required": list(properties),
        "additionalProperties": False,
    }
    request = {
        "model": model,
        "store": False,
        "max_output_tokens": 500,
        "reasoning": {"effort": "none"},
        "instructions": (
            "가상 재무 사례의 문장에서 스키마가 지정한 입력의 값을 추출하라. "
            "만 원은 10000을 곱해 월 원 정수로, 퍼센트는 100으로 나눠 연 비율로 변환한다. "
            "나이는 세 단위 정수다. 계산 결과, 설명, 법률 판단을 생성하지 마라."
        ),
        "input": sentence,
        "text": {
            "format": {
                "type": "json_schema",
                "name": "input_changes",
                "strict": True,
                "schema": schema,
            }
        },
    }
    logger = logging.getLogger(__name__)
    try:
        # Leave room for the API to answer before the browser's 25-second timeout.
        async with asyncio.timeout(20), httpx.AsyncClient(timeout=9.0) as client:
            for attempt in (1, 2):
                try:
                    response = await client.post(
                        "https://api.upstage.ai/v1/responses",
                        headers={"Authorization": f"Bearer {key}"},
                        json=request,
                    )
                    response.raise_for_status()
                    return read_proposal(response.json(), expected)
                except httpx.HTTPStatusError as exc:
                    status = exc.response.status_code
                    logger.warning(
                        "proposal_failed attempt=%s upstream_status=%s", attempt, status
                    )
                    if status not in (408, 500, 502, 503, 504):
                        break
                except httpx.TransportError as exc:
                    logger.warning(
                        "proposal_failed attempt=%s transport=%s", attempt, type(exc).__name__
                    )
                except InvalidProposal as exc:
                    logger.warning("proposal_failed attempt=%s reason=%s", attempt, exc)
                except (ValueError, KeyError, TypeError, AttributeError) as exc:
                    logger.warning(
                        "proposal_failed attempt=%s response=%s", attempt, type(exc).__name__
                    )
                if attempt == 1:
                    await asyncio.sleep(0.25)
    except TimeoutError:
        logger.warning("proposal_failed reason=deadline")
    raise ProposalUnavailable(
        "자연어 변경 제안을 검증하지 못했습니다. 잠시 후 다시 시도하거나 수동 입력을 이용해 주세요."
    )
