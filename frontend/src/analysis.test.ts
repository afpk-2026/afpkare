import { test } from "node:test";
import assert from "node:assert/strict";
import { reference, result } from "../tests/fixtures.ts";
import {
  defaultRange,
  inputKey,
  resultKey,
  variantInputs,
} from "./analysis.ts";
test("sensitivity varies only one supported input and deduplicates boundaries", () => {
  const initial = { ...reference.defaults, monthly_survivor_pension: 0 };
  assert.deepEqual(
    defaultRange("net_real_return", -0.1, reference.fields),
    [-0.1, -0.095],
  );
  assert.deepEqual(
    defaultRange("child_end_age", 110, reference.fields),
    [105, 110],
  );
  assert.deepEqual(
    defaultRange("monthly_survivor_pension", 0, reference.fields),
    [0, 100000],
  );
  const variants = variantInputs(
    "monthly_survivor_pension",
    initial,
    0,
    100000,
    reference.fields,
  );
  assert.equal(variants.length, 2);
  for (const row of variants)
    for (const key of Object.keys(initial))
      if (key !== "monthly_survivor_pension")
        assert.equal(row[key], initial[key]);
  assert.equal(initial.monthly_survivor_pension, 0);
});
test("sensitivity rejects unsupported precision, invalid ordering and out-of-range inputs", () => {
  for (const [field, lo, hi] of [
    ["net_real_return", 0, 0.1001],
    ["net_real_return", 0.00001, 0.02],
    ["child_end_age", 55, 100],
    ["monthly_child_cost", 1900000, 2200000],
    ["unknown", 0, 1],
  ] as const)
    assert.throws(() =>
      variantInputs(field, reference.defaults, lo, hi, reference.fields),
    );
});
test("context identity changes with applied inputs, strategy or assumption version", () => {
  assert.equal(
    inputKey(reference.defaults),
    inputKey(Object.fromEntries(Object.entries(reference.defaults).reverse())),
  );
  assert.notEqual(
    resultKey(result),
    resultKey({ ...result, strategy: "B_PRIME" }),
  );
  assert.notEqual(
    resultKey(result),
    resultKey({ ...result, assumption_version: "other" }),
  );
  assert.notEqual(
    resultKey(result),
    resultKey({
      ...result,
      effective_inputs: {
        ...result.effective_inputs,
        monthly_child_cost: 1850000,
      },
    }),
  );
});
test("all five supported inputs produce valid ranges around the current value", () => {
  for (const field of Object.keys(reference.fields)) {
    const range = defaultRange(
      field,
      reference.defaults[field],
      reference.fields,
    );
    const variants = variantInputs(
      field,
      reference.defaults,
      ...range,
      reference.fields,
    );
    assert.ok(variants.length >= 2 && variants.length <= 3);
    assert.ok(variants.some((v) => v[field] === reference.defaults[field]));
  }
});
