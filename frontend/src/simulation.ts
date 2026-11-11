import { validInputs } from "./storage.ts";
import type { Inputs, Fields, Strategy } from "./storage.ts";
import type { Row } from "./Chart.tsx";
export type Reference = {
  case_id: string;
  source_version: string;
  base_year: number;
  defaults: Inputs;
  fields: Fields;
  blockers: string[];
  evidence: { ref: string; status: string; detail: string }[];
  report_values: {
    required_83: number;
    required_95: number;
    projected_b_56: number;
  };
  report_comparison: {
    strategy: string;
    label: string;
    costs: number[];
    max_regret: number;
  }[];
  samples: { id: string; text: string }[];
  assumptions: { version: string; notes: string[] };
};
export type Summary = {
  required_trust_at_56: number | null;
  required_trust_83: number | null;
  required_trust_95: number | null;
  projected_trust_at_56: number;
  child_shortfall_total: number;
  child_shortfall_years: number[];
  parent_asset_min: number;
  parent_first_negative_year: number | null;
  parent_feasible: boolean;
  required_status: string;
  comparison_costs: Record<
    string,
    { shortfall: number; lost_benefits: number; cost: number }
  >;
};
export type Result = {
  status: string;
  case_id: string;
  source_version: string;
  calculation_status: string;
  reason?: string;
  effective_inputs: Inputs;
  strategy: Strategy;
  summary: Summary;
  child_timeline: Row[];
  parent_timeline: Row[];
  warnings: string[];
  source_refs: string[];
  assumption_version: string;
};

export async function requestSimulation(
  reference: Reference,
  inputs: Inputs,
  strategy: Strategy,
  signal?: AbortSignal,
): Promise<Result> {
  const overrides = Object.fromEntries(
    Object.entries(inputs).filter(([k, v]) => v !== reference.defaults[k]),
  );
  let response: Response;
  try {
    response = await fetch("/api/simulations", {
      method: "POST",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
        : AbortSignal.timeout(30000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id: reference.case_id, strategy, overrides }),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(
      "계산 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
  let data: Result;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "계산 서버의 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
  if (!response.ok)
    throw new Error(
      data.reason ?? "계산 요청이 거부되었습니다. 입력과 연결을 확인해 주세요.",
    );
  if (
    data.status !== "calculated" ||
    data.strategy !== strategy ||
    !validInputs(data.effective_inputs, reference.fields) ||
    !Object.keys(reference.defaults).every(
      (k) => data.effective_inputs?.[k] === inputs[k],
    ) ||
    data.case_id !== reference.case_id ||
    data.source_version !== reference.source_version ||
    data.assumption_version !== reference.assumptions.version
  )
    throw new Error(
      "입력 또는 계산 버전이 달라 결과를 사용할 수 없습니다. 새로고침해 주세요.",
    );
  return data as Result;
}
