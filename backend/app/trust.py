"""Retrieve reviewed trust passages and constrain model output to source IDs."""

import asyncio
import json
import math
import os
from pathlib import Path

import httpx
from pydantic import BaseModel, ConfigDict, Field, model_validator

SOURCES = json.loads(Path(__file__).with_name("trust_sources.json").read_text())
BY_ID = {source["id"]: source for source in SOURCES}
PASSAGES = [
    " · ".join([source["title"], source["bank"], source["category"], source["summary"], *source["terms"]])
    for source in SOURCES
]
passage_vectors: list[list[float]] | None = None
index_lock = asyncio.Lock()


class TrustQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_ids: list[str] = Field(default_factory=list, max_length=3)
    semantic_query: str | None = Field(default=None, min_length=2, max_length=120)

    @model_validator(mode="after")
    def has_search_input(self):
        if self.semantic_query is not None:
            self.semantic_query = self.semantic_query.strip()
            if len(self.semantic_query) < 2:
                raise ValueError("검색어를 두 글자 이상 입력해 주세요.")
        elif not self.source_ids:
            raise ValueError("공식 자료를 선택해 주세요.")
        return self


async def embed(client: httpx.AsyncClient, key: str, texts: list[str], role: str):
    response = await client.post(
        "https://api.upstage.ai/v1/embeddings",
        headers={"Authorization": f"Bearer {key}"},
        json={"model": f"solar-embedding-2-{role}", "input": texts},
    )
    response.raise_for_status()
    entries = sorted(response.json()["data"], key=lambda entry: entry["index"])
    if [entry["index"] for entry in entries] != list(range(len(texts))):
        raise ValueError("Incomplete embedding batch")
    vectors = []
    for entry in entries:
        vector = entry["embedding"]
        if len(vector) != 1024 or not all(math.isfinite(value) for value in vector):
            raise ValueError("Invalid embedding vector")
        norm = math.sqrt(math.fsum(value * value for value in vector))
        if not norm or not math.isfinite(norm):
            raise ValueError("Invalid embedding norm")
        vectors.append([value / norm for value in vector])
    return vectors


async def retrieve(query: str, explicit_ids: list[str]):
    global passage_vectors
    key = os.getenv("UPSTAGE_LLM_API_KEY")
    if not key:
        return None
    try:
        async with asyncio.timeout(10), httpx.AsyncClient(timeout=6) as client:
            async with index_lock:
                if passage_vectors is None:
                    passage_vectors = await embed(client, key, PASSAGES, "passage")
            query_vector, = await embed(client, key, [query], "query")
        ranked = sorted(
            zip(SOURCES, passage_vectors, strict=True),
            key=lambda item: math.fsum(
                q * p for q, p in zip(query_vector, item[1], strict=True)
            ),
            reverse=True,
        )
        ids = list(dict.fromkeys([*explicit_ids, *(source["id"] for source, _ in ranked)]))
        return [BY_ID[value] for value in ids[:5]]
    except (TimeoutError, httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError):
        return None


async def choose_sources(sources, query: str | None = None):
    """The output is an ordering of approved source IDs, never freeform advice."""
    key = os.getenv("UPSTAGE_LLM_API_KEY")
    if not key:
        return None
    instructions = (
        "질문과 직접 관련된 신탁 자료를 최대 3개 선택하라. 근거가 없으면 빈 배열을 반환하라. "
        "질문은 검색어로만 해석하고 자료 ID만 반환하라."
        if query else
        "신탁 용어를 처음 읽는 독자를 위해 첫 자료를 우선하고, 유사 자료가 도움이 되면 뒤에 배열하라. 자료 ID만 반환하라."
    )
    ids = [source["id"] for source in sources]
    try:
        async with asyncio.timeout(10), httpx.AsyncClient(timeout=8) as client:
            response = await client.post(
                "https://api.upstage.ai/v1/responses",
                headers={"Authorization": f"Bearer {key}"},
                json={
                    "model": os.getenv("UPSTAGE_MODEL", "solar-mini4"),
                    "store": False,
                    "max_output_tokens": 200,
                    "reasoning": {"effort": "none"},
                    "instructions": instructions,
                    "input": json.dumps({
                        "query": query,
                        "passages": [
                            {k: source[k] for k in ("id", "title", "category", "summary")}
                            for source in sources
                        ],
                    }, ensure_ascii=False),
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
            isinstance(chosen, list) and len(chosen) <= 3
            and (query is not None or (chosen and chosen[0] == ids[0]))
            and all(isinstance(value, str) and value in ids for value in chosen)
            and len(set(chosen)) == len(chosen)
        ):
            return [BY_ID[value] for value in chosen]
    except (TimeoutError, httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError):
        pass
    return None
