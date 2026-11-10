"""Retrieve reviewed bank passages by ID and let the model select source points."""

import json
import os
from pathlib import Path

import httpx
from pydantic import BaseModel, ConfigDict, Field

SOURCES = json.loads(Path(__file__).with_name("trust_sources.json").read_text())
BY_ID = {source["id"]: source for source in SOURCES}


class TrustQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_ids: list[str] = Field(min_length=1, max_length=3)


async def choose_sources(sources):
    """The output is an ordering of approved source IDs, never freeform advice."""
    key = os.getenv("UPSTAGE_LLM_API_KEY")
    if not key:
        return None
    ids = [source["id"] for source in sources]
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                "https://api.upstage.ai/v1/responses",
                headers={"Authorization": f"Bearer {key}"},
                json={
                    "model": os.getenv("UPSTAGE_MODEL", "solar-mini4"),
                    "store": False,
                    "max_output_tokens": 200,
                    "reasoning": {"effort": "none"},
                    "instructions": "신탁 용어를 처음 읽는 독자를 위해 첫 자료를 우선 설명하고, 유사 자료가 도움이 되면 뒤에 배열하라. 자료 ID만 반환하라.",
                    "input": json.dumps(
                        [{k: source[k] for k in ("id", "title", "summary")} for source in sources],
                        ensure_ascii=False,
                    ),
                    "text": {"format": {
                        "type": "json_schema", "name": "trust_sources", "strict": True,
                        "schema": {
                            "type": "object",
                            "properties": {"ids": {"type": "array", "items": {"type": "string", "enum": ids}}},
                            "required": ["ids"], "additionalProperties": False,
                        },
                    }},
                },
            )
            response.raise_for_status()
            payload = response.json()
        if payload.get("status") != "completed":
            return None
        outputs = [
            part["text"] for item in payload.get("output", [])
            for part in item.get("content", []) if part.get("type") == "output_text"
        ]
        chosen = json.loads("".join(outputs))["ids"]
        if (
            isinstance(chosen, list) and chosen and chosen[0] == ids[0]
            and all(isinstance(value, str) and value in ids for value in chosen)
            and len(set(chosen)) == len(chosen)
        ):
            return [BY_ID[value] for value in chosen]
    except (httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError):
        pass
    return None
