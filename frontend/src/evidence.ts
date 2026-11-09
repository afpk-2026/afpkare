import type { Reference, Result } from "./simulation.ts";
import type { Snapshot, Sensitivity } from "./analysis.ts";
import { INPUT_KEYS } from "./analysis.ts";

const summaryKeys = [
  "required_trust_at_56",
  "required_trust_83",
  "required_trust_95",
  "projected_trust_at_56",
  "pre_supplement_trust_at_56",
  "supplement_at_56",
  "child_shortfall_total",
  "child_shortfall_years",
  "parent_asset_min",
  "parent_first_negative_year",
  "parent_feasible",
  "required_status",
] as const;
const rowKeys = [
  "year",
  "child_age",
  "parent_age",
  "mother_age",
  "phase",
  "start_balance",
  "evaluation_balance",
  "opening_transfer",
  "inflows",
  "outflows",
  "benefits",
  "benefit_monthly_components",
  "benefit_regime",
  "survivor_pension",
  "living_cost",
  "shortfall",
  "interest",
  "end_balance",
  "components",
] as const;
const select = (value: object, keys: readonly string[]) =>
  Object.fromEntries(
    keys
      .filter((k) => k in value)
      .map((k) => [k, (value as Record<string, unknown>)[k]]),
  );
function calculation(result: Result) {
  return {
    case_id: result.case_id,
    source_version: result.source_version,
    assumption_version: result.assumption_version,
    calculation_status: result.calculation_status,
    strategy: result.strategy,
    effective_inputs: select(result.effective_inputs, INPUT_KEYS),
    summary: select(result.summary, summaryKeys),
    child_timeline: result.child_timeline.map((r) => select(r, rowKeys)),
    parent_timeline: result.parent_timeline.map((r) => select(r, rowKeys)),
    source_refs: result.source_refs,
    warnings: result.warnings,
  };
}
export function evidenceBundle(
  reference: Reference,
  current: Result,
  snapshots: Snapshot[],
  sensitivity: Sensitivity | null,
  exportedAt: string,
) {
  return {
    export_schema_version: 1,
    app_version: "0.3.2",
    exported_at: exportedAt,
    title: "부모가 없는 날 · 가상 계산 근거",
    base_year: reference.base_year,
    money_unit: "KRW_integer",
    case_id: reference.case_id,
    source_version: reference.source_version,
    assumption_version: current.assumption_version,
    disclaimer:
      "가상 계약 기반 계산이며 실제 수급·세금·상품 계약의 확정 판정이 아닙니다. 보고서 고정값과 구별합니다.",
    input_definitions: Object.fromEntries(
      INPUT_KEYS.map((k) => [k, reference.fields[k]]),
    ),
    assumptions: reference.assumptions,
    evidence: reference.evidence,
    current: calculation(current),
    comparisons: snapshots.map((s) => ({
      id: s.id,
      label: s.label,
      captured_at: s.captured_at,
      calculation: calculation(s.result),
    })),
    sensitivity: sensitivity
      ? {
          field: sensitivity.field,
          computed_at: sensitivity.computed_at,
          variants: sensitivity.variants.map((v) => ({
            value: v.value,
            inputs: select(v.inputs, INPUT_KEYS),
            results: v.results.map(calculation),
          })),
        }
      : null,
  };
}
export function csvCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") return String(value);
  let text = String(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function timelineCsv(reference: Reference, current: Result): string {
  const headers = [
    "case_id",
    "source_version",
    "assumption_version",
    "strategy",
    "base_year",
    "money_unit",
    "generation",
    "year",
    "age",
    "phase",
    "start_balance",
    "inflows",
    "outflows",
    "benefits",
    "interest",
    "end_balance",
    "shortfall",
    "benefit_regime",
  ];
  const rows = [
    ...current.parent_timeline.map((r) => ({ generation: "parent", r })),
    ...current.child_timeline.map((r) => ({ generation: "child", r })),
  ].map(({ generation, r }) => [
    reference.case_id,
    reference.source_version,
    current.assumption_version,
    current.strategy,
    reference.base_year,
    "KRW",
    generation,
    r.year,
    r.child_age ?? r.parent_age,
    r.phase ?? "",
    r.start_balance,
    r.inflows,
    r.outflows,
    r.benefits,
    r.interest,
    r.end_balance,
    r.shortfall ?? null,
    r.benefit_regime ?? "",
  ]);
  return (
    "\uFEFF" +
    [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}
export const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function evidenceHtml(
  bundle: ReturnType<typeof evidenceBundle>,
): string {
  const h = escapeHtml;
  const table = (headers: string[], rows: unknown[][]) =>
    `<table><thead><tr>${headers.map((x) => `<th>${h(x)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((x) => `<td>${h(x == null ? "계산 미지원" : x)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const calc = bundle.current;
  const number = (v: unknown) =>
    typeof v === "number"
      ? v.toLocaleString("ko-KR")
      : v == null
        ? "계산 미지원"
        : String(v);
  const metrics = (r: ReturnType<typeof calculation>) => [
    r.strategy,
    number(r.summary.required_trust_at_56),
    number(r.summary.projected_trust_at_56),
    number(r.summary.child_shortfall_total),
    number(r.summary.parent_asset_min),
    r.summary.parent_first_negative_year ?? "없음",
  ];
  const annual = (rows: Record<string, unknown>[]) =>
    table(
      ["연도", "나이", "연초", "유입", "유출", "급여", "수익", "연말", "부족"],
      rows.map((r) => [
        r.year,
        r.child_age ?? r.parent_age,
        ...[
          "start_balance",
          "inflows",
          "outflows",
          "benefits",
          "interest",
          "end_balance",
          "shortfall",
        ].map((k) => (r[k] == null ? "—" : number(r[k]))),
      ]),
    );
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${h(bundle.title)}</title><style>body{font:14px/1.7 sans-serif;color:#243f34;max-width:1100px;margin:35px auto;padding:20px}h1{font-size:28px}h2{margin-top:35px}table{width:100%;border-collapse:collapse;font-size:11px;page-break-inside:auto}th,td{border:1px solid #dce4d7;padding:7px;text-align:left}th{background:#eef3e9}tr{break-inside:avoid}thead{display:table-header-group}.note{background:#f5f0e5;padding:15px}code{overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}@media print{body{margin:0;max-width:none;padding:0}h2{break-after:avoid}@page{size:A4 landscape;margin:15mm}}</style></head><body>
 <h1>${h(bundle.title)}</h1><p class="note">${h(bundle.disclaimer)}</p><p>기준: ${bundle.base_year}년 실질 가격 · 금액: 원 · 생성: ${h(bundle.exported_at)}</p><p>사례 <code>${h(bundle.case_id)}</code> · 출처 ${h(bundle.source_version)} · 가정 ${h(bundle.assumption_version)}</p>
 <h2>적용 입력</h2>${table(
   ["입력", "값", "단위", "근거"],
   INPUT_KEYS.map((k) => [
     bundle.input_definitions[k].label,
     calc.effective_inputs[k],
     bundle.input_definitions[k].unit,
     bundle.input_definitions[k].source,
   ]),
 )}
 <h2>계산 결과 및 고정 비교 사례</h2>${table(["사례", "전략", "56세 필요 잔액", "56세 예상 잔액", "자녀 부족액", "부모 최저 금융자산", "첫 음수 연도"], [["현재 적용", ...metrics(calc)], ...bundle.comparisons.map((s) => [s.label, ...metrics(s.calculation)])])}${bundle.comparisons
   .map(
     (s) =>
       `<h3>${h(s.label)} · ${h(s.captured_at)}</h3>${table(
         ["입력", "고정한 값"],
         INPUT_KEYS.map((k) => [
           bundle.input_definitions[k].label,
           s.calculation.effective_inputs[k],
         ]),
       )}`,
   )
   .join("")}
 ${
   bundle.sensitivity
     ? `<h2>한 입력의 민감도</h2><p>${h(bundle.input_definitions[bundle.sensitivity.field].label)} (${h(bundle.input_definitions[bundle.sensitivity.field].unit)}) · 다른 입력은 적용 설정으로 고정</p>${table(
         [
           "변경값(기본 단위)",
           "전략",
           "필요 잔액",
           "56세 예상",
           "자녀 부족",
           "부모 최저",
           "첫 음수",
         ],
         bundle.sensitivity.variants.flatMap((v) =>
           v.results.map((r) => [v.value, ...metrics(r)]),
         ),
       )}`
     : ""
 }
 <h2>보고서 근거와 확인 상태</h2>${table(
   ["근거", "상태", "설명"],
   bundle.evidence.map((e) => [e.ref, e.status, e.detail]),
 )}<h2>계산 가정과 한계</h2><ol>${calc.warnings.map((w) => `<li>${h(w)}</li>`).join("")}</ol><p>연결 근거: ${calc.source_refs.map(h).join(" · ")}</p><details><summary>계산 계약 원자료 · 단위는 필드명과 가정 설명 참조</summary><pre>${h(JSON.stringify(bundle.assumptions, null, 2))}</pre></details>
 <h2>부모 연도별 경로</h2>${annual(calc.parent_timeline)}<h2>자녀 연도별 경로</h2>${annual(calc.child_timeline)}<p>적립기의 자녀 급여는 계산 범위 밖으로 — 표시. 자녀 급여는 신탁 유입에 더하지 않으며 부모 급여는 유입에 포함합니다. 이 문서는 외부 리소스 없이 인쇄할 수 있습니다.</p></body></html>`;
}
export function downloadFile(contents: string, mime: string, filename: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
