import type { Inputs, Fields } from "./storage.ts";
import type { Result } from "./simulation.ts";

export type Snapshot = {
  id: string;
  label: string;
  captured_at: string;
  case_id: string;
  source_version: string;
  result: Result;
};
export type Variant = { value: number; inputs: Inputs; results: Result[] };
export type Sensitivity = {
  field: string;
  context_key: string;
  computed_at: string;
  variants: Variant[];
};
export const INPUT_KEYS = [
  "monthly_child_cost",
  "monthly_survivor_pension",
  "net_real_return",
  "monthly_parent_reemployment_income",
  "child_end_age",
] as const;
export function inputKey(inputs: Inputs): string {
  return JSON.stringify(INPUT_KEYS.map((k) => [k, inputs[k]]));
}
export function resultKey(result: Result): string {
  return [
    result.case_id,
    result.source_version,
    result.assumption_version,
    result.strategy,
    inputKey(result.effective_inputs),
  ].join("|");
}
export function defaultRange(
  field: string,
  value: number,
  fields: Fields,
): [number, number] {
  const f = fields[field];
  const delta =
    field === "net_real_return"
      ? 0.005
      : field === "child_end_age"
        ? 5
        : Math.max(100000, Math.round(value * 0.2));
  const quantize = (v: number) =>
    Number((Math.round(v / f.step) * f.step).toFixed(8));
  return [
    quantize(Math.max(f.min, value - delta)),
    quantize(Math.min(f.max, value + delta)),
  ];
}
export function variantInputs(
  field: string,
  inputs: Inputs,
  lower: number,
  upper: number,
  fields: Fields,
): Inputs[] {
  const f = fields[field];
  if (
    !f ||
    ![lower, upper, inputs[field]].every(
      (v) =>
        Number.isFinite(v) &&
        v >= f.min &&
        v <= f.max &&
        Math.abs(v / f.step - Math.round(v / f.step)) < 1e-7,
    )
  )
    throw new Error("분석 구간의 단위·범위를 확인해 주세요.");
  if (lower > inputs[field] || upper < inputs[field])
    throw new Error("하한 ≤ 적용값 ≤ 상한 순서로 입력해 주세요.");
  return [...new Set([lower, inputs[field], upper])]
    .sort((a, b) => a - b)
    .map((value) => ({ ...inputs, [field]: value }));
}
export const formatInput = (key: string, value: number) =>
  key === "net_real_return"
    ? `${Number((value * 100).toFixed(2))}%`
    : key === "child_end_age"
      ? `${value}세`
      : `${(value / 10000).toLocaleString("ko-KR")}만 원/월`;
