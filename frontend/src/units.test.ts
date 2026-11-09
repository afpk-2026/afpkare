import { test } from "node:test";
import assert from "node:assert/strict";
import { fromDisplay } from "./units.ts";
test("display amount converts to exact integer won", () => {
  assert.equal(fromDisplay("monthly_child_cost", "185.1234"), 1851234);
  assert.equal(fromDisplay("monthly_child_cost", "0.0001"), 1);
  assert.equal(fromDisplay("monthly_child_cost", "185.00000"), 1850000);
  assert.equal(fromDisplay("net_real_return", "-0.5"), -0.005);
  assert.equal(fromDisplay("child_end_age", "83"), 83);
});
test("fractional won, age precision and unknown numeric formats rejected", () => {
  for (const [key, text] of [
    ["monthly_child_cost", "0.00001"],
    ["child_end_age", "83.1"],
    ["net_real_return", "0.001"],
    ["monthly_child_cost", "1e2"],
    ["monthly_child_cost", ""],
  ])
    assert.equal(Number.isNaN(fromDisplay(key, text)), true);
});
