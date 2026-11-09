import { test } from "node:test";
import assert from "node:assert/strict";
import { reference, result } from "../tests/fixtures.ts";
import { addSnapshot, resultKey, type Sensitivity } from "./analysis.ts";
import {
  csvCell,
  evidenceBundle,
  evidenceHtml,
  timelineCsv,
} from "./evidence.ts";
test("evidence includes exact applied data, provenance and comparisons but no unrelated state", () => {
  const extra = {
    ...result,
    api_key: "private-key",
    text: "private natural input",
  };
  const cards = addSnapshot([], reference, result, "1", "date");
  const sensitivity: Sensitivity = {
    field: "monthly_child_cost",
    context_key: resultKey(result),
    computed_at: "date",
    variants: [
      { value: 1800000, inputs: result.effective_inputs, results: [result] },
    ],
  };
  const bundle = evidenceBundle(
    reference,
    extra,
    cards,
    sensitivity,
    "2026-11-09T03:00:00Z",
  );
  const encoded = JSON.stringify(bundle);
  assert.equal(bundle.current.summary.required_trust_at_56, 174185205);
  assert.equal(bundle.current.parent_timeline[0].end_balance, -37);
  assert.equal(bundle.current.child_timeline[0].benefit_regime, "disability");
  assert.equal(bundle.assumption_version, "scenario-v1");
  assert.equal(bundle.comparisons.length, 1);
  assert.equal(bundle.sensitivity?.variants.length, 1);
  assert.equal(encoded.includes("private-key"), false);
  assert.equal(encoded.includes("private natural input"), false);
});
test("unsupported required balance remains null in JSON and explicit in report", () => {
  const unsupported = {
    ...result,
    summary: {
      ...result.summary,
      required_trust_at_56: null,
      required_status: "unsupported_withdrawal_cap",
    },
  };
  const bundle = evidenceBundle(reference, unsupported, [], null, "date");
  assert.equal(bundle.current.summary.required_trust_at_56, null);
  assert.match(evidenceHtml(bundle), /계산 미지원/);
  assert.match(evidenceHtml(bundle), /가상 계약 기반 계산/);
});
test("HTML escapes all variable markup and has no executable script or external resources", () => {
  const html = evidenceHtml(
    evidenceBundle(reference, result, [], null, "date"),
  );
  assert.equal(html.includes("<script>"), false);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;검토&gt;/);
  assert.match(html, /default-src 'none'/);
  assert.equal(/<(?:script|iframe|img)\b/.test(html), false);
  assert.match(html, /174,185,205/);
  assert.match(html, /-37/);
});
test("CSV preserves negative numbers, nulls, provenance and spreadsheet quoting", () => {
  const csv = timelineCsv(reference, result);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.equal(csv.trim().split("\r\n").length, 3); // header + parent + child, with header text containing no newlines
  assert.match(csv, /,2040,69,/);
  assert.match(csv, /,-37,,/);
  assert.equal(csvCell(-37), "-37");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
});

test("every exported HTML table has matching column counts", () => {
  const cards = addSnapshot([], reference, result, "1", "date");
  const sensitivity: Sensitivity = {
    field: "monthly_child_cost",
    context_key: resultKey(result),
    computed_at: "date",
    variants: [
      { value: 1800000, inputs: result.effective_inputs, results: [result] },
    ],
  };
  const html = evidenceHtml(
    evidenceBundle(reference, result, cards, sensitivity, "date"),
  );
  for (const table of html.matchAll(/<table>([\s\S]*?)<\/table>/g)) {
    const columns = (table[1].match(/<th>/g) || []).length;
    const body = table[1].split("<tbody>")[1];
    for (const row of body.matchAll(/<tr>([\s\S]*?)<\/tr>/g))
      assert.equal((row[1].match(/<td>/g) || []).length, columns);
  }
});
