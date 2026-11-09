import test from "node:test";
import assert from "node:assert/strict";
import { describeChanges, randomSamples, chatContext } from "./chat.ts";
import type { Reference } from "./simulation.ts";

test("chat describes only validated changes with before/after units", () => {
  assert.equal(
    describeChanges(
      { monthly_child_cost: { label: "월 생활비" } } as Reference["fields"],
      { monthly_child_cost: 1800000 },
      { monthly_child_cost: 1850000 },
    ),
    "월 생활비: 180만 원/월 → 185만 원/월",
  );
});
test("examples are a unique subset without mutating server samples", () => {
  const samples = ["a", "b", "c", "d", "e"];
  const result = randomSamples(samples, 4, () => 0);
  assert.equal(result.length, 4);
  assert.equal(new Set(result).size, 4);
  assert.deepEqual(samples, ["a", "b", "c", "d", "e"]);
  assert.ok(result.every((s) => samples.includes(s)));
});
test("pending chat context changes when applied values or calculation versions change", () => {
  const ref = {
    case_id: "case",
    source_version: "v1",
    assumptions: { version: "a1" },
  } as Reference;
  const values = { monthly_child_cost: 1800000 };
  assert.notEqual(
    chatContext(ref, values),
    chatContext(ref, { monthly_child_cost: 1850000 }),
  );
  assert.notEqual(
    chatContext(ref, values),
    chatContext({ ...ref, source_version: "v2" }, values),
  );
  assert.notEqual(
    chatContext(ref, values),
    chatContext({ ...ref, assumptions: { version: "a2", notes: [] } }, values),
  );
});
