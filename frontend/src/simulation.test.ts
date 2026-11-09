import { test } from "node:test";
import assert from "node:assert/strict";
import { reference, result } from "../tests/fixtures.ts";
import { requestSimulation } from "./simulation.ts";
test("request helper sends only supported applied overrides", async () => {
  const old = globalThis.fetch;
  try {
    let body: Record<string, unknown> = {};
    globalThis.fetch = async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify(result), { status: 200 });
    };
    await requestSimulation(reference, reference.defaults, "B");
    assert.deepEqual(body, {
      case_id: reference.case_id,
      strategy: "B",
      overrides: {},
    });
  } finally {
    globalThis.fetch = old;
  }
});
test("mismatched strategy, input or source version cannot become an exportable result", async () => {
  const old = globalThis.fetch;
  try {
    for (const response of [
      { ...result, strategy: "B_PRIME" },
      { ...result, source_version: "old" },
      { ...result, assumption_version: "old" },
      {
        ...result,
        effective_inputs: { ...result.effective_inputs, monthly_child_cost: 1 },
      },
    ]) {
      globalThis.fetch = async () =>
        new Response(JSON.stringify(response), { status: 200 });
      await assert.rejects(
        requestSimulation(reference, reference.defaults, "B"),
        /버전/,
      );
    }
  } finally {
    globalThis.fetch = old;
  }
});

test("transport and non-JSON errors provide retry guidance without replacing results", async () => {
  const old = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    await assert.rejects(
      requestSimulation(reference, reference.defaults, "B"),
      /다시 시도/,
    );
    globalThis.fetch = async () => new Response("Bad Gateway", { status: 502 });
    await assert.rejects(
      requestSimulation(reference, reference.defaults, "B"),
      /다시 시도/,
    );
  } finally {
    globalThis.fetch = old;
  }
});
