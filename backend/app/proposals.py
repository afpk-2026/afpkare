"""Only fully validated fictional change sentences cross the external LLM boundary."""

import json
import logging
import os
import httpx
from .contracts import FIELDS, Overrides


class ProposalUnavailable(Exception):
    pass


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
        name: {"type": ["number" if name == "net_real_return" else "integer", "null"]}
        for name in FIELDS
    }
    for name, info in FIELDS.items():
        properties[name]["description"] = (
            "연 비율. 퍼센트 숫자를 100으로 나눈 값. 예: 1%=0.01, -0.5%=-0.005, 0%=0."
            if name == "net_real_return"
            else info["label"]
            + " · "
            + info["unit"]
            + ". 만 원은 10000을 곱해 원 정수로 변환."
        )
        properties[name]["minimum"] = info["min"]
        properties[name]["maximum"] = info["max"]
    schema = {
        "type": "object",
        "properties": properties,
        "required": list(properties),
        "additionalProperties": False,
    }
    stage = "transport"
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                "https://api.upstage.ai/v1/responses",
                headers={"Authorization": f"Bearer {key}"},
                json={
                    "model": model,
                    "store": False,
                    "max_output_tokens": 500,
                    "reasoning": {"effort": "none"},
                    "instructions": "가상 재무 사례의 문장에서 명시한 변경 입력만 추출하라. 금액은 월 원 정수, 수익률은 반드시 퍼센트를100으로 나눈 연 비율(-0.5%는-0.005, 1%는0.01), 나이는 세 정수. 명시하지 않은 필드는 null. 계산 결과, 설명, 법률 판단을 생성하지 마라.",
                    "input": sentence,
                    "text": {
                        "format": {
                            "type": "json_schema",
                            "name": "input_changes",
                            "strict": True,
                            "schema": schema,
                        }
                    },
                },
            )
            response.raise_for_status()
            payload = response.json()
        stage = "completion"
        if payload.get("status") != "completed":
            raise ValueError("Incomplete response")
        outputs = [
            part["text"]
            for item in payload.get("output", [])
            for part in item.get("content", [])
            if part.get("type") == "output_text"
        ]
        stage = "schema"
        raw = json.loads("".join(outputs))
        if not isinstance(raw, dict):
            raise ValueError("Output must be an object")
        parsed = Overrides.model_validate(
            {k: v for k, v in raw.items() if v is not None}
        ).changes()
        stage = "meaning"
        # Allowed sentences have a known meaning; reject omitted/invented fields and values.
        if parsed != expected or set(raw) != set(FIELDS):
            raise ValueError("Proposal does not match supported sample")
        return parsed
    except (httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError) as exc:
        logging.getLogger(__name__).warning(
            "proposal_failed stage=%s kind=%s", stage, type(exc).__name__
        )
        raise ProposalUnavailable(
            "자연어 변경 제안을 검증하지 못했습니다. 잠시 후 다시 시도하거나 수동 입력을 이용해 주세요."
        ) from None
