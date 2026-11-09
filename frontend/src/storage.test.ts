import { test } from "node:test";
import assert from "node:assert/strict";
import { restore, save, clear, STORAGE_KEY, validInputs } from "./storage.ts";
const fields = {
  child_end_age: {
    label: "나이",
    unit: "세",
    min: 56,
    max: 110,
    step: 1,
    default: 95,
    source: "가상",
  },
  net_real_return: {
    label: "수익률",
    unit: "비율",
    min: -0.1,
    max: 0.1,
    step: 0.0001,
    default: 0.01,
    source: "가상",
  },
};
const saved = {
  schema_version: 1 as const,
  case_id: "jihoon-2026",
  source_version: "v1.5-review",
  strategy: "B_PRIME" as const,
  overrides: { child_end_age: 83 },
};
function memory() {
  const values = new Map<string, string>();
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
  };
}
test("applied settings roundtrip without results or text", () => {
  const s = memory();
  assert.equal(save(s, saved), true);
  assert.deepEqual(
    restore(s, saved.case_id, saved.source_version, fields).saved,
    saved,
  );
  assert.equal(clear(s), true);
  assert.equal(s.getItem(STORAGE_KEY), null);
});
test("corruption, version mismatch, unknown and sensitive fields are discarded", () => {
  for (const value of [
    "bad",
    "null",
    JSON.stringify({ ...saved, schema_version: 2 }),
    JSON.stringify({ ...saved, source_version: "old" }),
    JSON.stringify({ ...saved, text: "private" }),
    JSON.stringify({ ...saved, overrides: { unknown: 1 } }),
  ]) {
    const s = memory();
    s.setItem(STORAGE_KEY, value);
    assert.equal(
      restore(s, saved.case_id, saved.source_version, fields).saved,
      null,
    );
    assert.equal(s.getItem(STORAGE_KEY), null);
  }
});
test("blocked storage does not throw", () => {
  const s = {
    getItem: () => {
      throw Error();
    },
    setItem: () => {
      throw Error();
    },
    removeItem: () => {
      throw Error();
    },
  };
  assert.equal(restore(s, "a", "b", fields).saved, null);
  assert.equal(save(s, saved), false);
  assert.equal(clear(s), false);
});
test("numeric precision and finite bounds", () => {
  assert.equal(validInputs({ net_real_return: -0.01 }, fields), true);
  for (const v of [NaN, Infinity, 0.1001, 0.00001])
    assert.equal(validInputs({ net_real_return: v }, fields), false);
});
