import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { StepTitle } from "./StepTitle.tsx";
import { SensitivityBars, SnapshotCards } from "./AnalysisVisuals.tsx";
import { money } from "./Chart.tsx";
import { fromDisplay } from "./units.ts";
import {
  requestSimulation,
  type Reference,
  type Result,
} from "./simulation.ts";
import {
  defaultRange,
  formatInput,
  INPUT_KEYS,
  resultKey,
  variantInputs,
  type Snapshot,
  type Sensitivity,
} from "./analysis.ts";
import {
  downloadFile,
  evidenceBundle,
  evidenceHtml,
  timelineCsv,
} from "./evidence.ts";
import { strategyLabels } from "./strategyLabels.ts";

const displayNumber = (field: string, value: number) =>
  String(
    Number(
      (field === "net_real_return"
        ? value * 100
        : field === "child_end_age"
          ? value
          : value / 10000
      ).toFixed(4),
    ),
  );
export function AnalysisWorkspace({
  reference,
  current,
  alternative,
  disabled,
  exportTarget,
  snapshots,
}: {
  reference: Reference;
  current: Result;
  alternative: Result;
  disabled: boolean;
  exportTarget: HTMLElement | null;
  snapshots: Snapshot[];
}) {
  const [field, setField] = useState("monthly_child_cost");
  const [lower, setLower] = useState(""),
    [upper, setUpper] = useState("");
  const [analysis, setAnalysis] = useState<Sensitivity | null>(null),
    [loading, setLoading] = useState(false),
    [analysisError, setAnalysisError] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const requestId = useRef(0),
    controller = useRef<AbortController | null>(null);
  const contextKey = resultKey(current);
  function invalidate() {
    requestId.current++;
    controller.current?.abort();
    setAnalysis(null);
    setLoading(false);
    setAnalysisError("");
  }
  useEffect(() => {
    invalidate();
    const [lo, hi] = defaultRange(
      field,
      current.effective_inputs[field],
      reference.fields,
    );
    setLower(displayNumber(field, lo));
    setUpper(displayNumber(field, hi));
    return () => {
      requestId.current++;
      controller.current?.abort();
    };
  }, [contextKey, field]);
  const visibleAnalysis =
    analysis?.context_key === contextKey && analysis.field === field
      ? analysis
      : null;
  async function analyze() {
    invalidate();
    const id = requestId.current;
    try {
      const variants = variantInputs(
        field,
        current.effective_inputs,
        fromDisplay(field, lower),
        fromDisplay(field, upper),
        reference.fields,
      );
      const abort = new AbortController();
      controller.current = abort;
      setLoading(true);
      const rows = await Promise.all(
        variants.map(async (inputs) => ({
          value: inputs[field],
          inputs,
          results: await Promise.all(
            (["B", "B_PRIME"] as const).map((s) =>
              requestSimulation(reference, inputs, s, abort.signal),
            ),
          ),
        })),
      );
      if (id !== requestId.current) return;
      setAnalysis({
        field,
        context_key: contextKey,
        computed_at: new Date().toISOString(),
        variants: rows,
      });
    } catch (e) {
      if (id === requestId.current)
        setAnalysisError(
          e instanceof Error
            ? `분석을 완료하지 못했습니다. ${e.message}`
            : "분석을 완료하지 못했습니다. 다시 시도해 주세요.",
        );
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }
  function exportFile(kind: "json" | "csv" | "html") {
    const date = new Date().toISOString(),
      bundle = evidenceBundle(
        reference,
        current,
        snapshots,
        visibleAnalysis,
        date,
      );
    const prefix = `family-finance-${current.strategy}-${date.slice(0, 10)}`;
    if (kind === "json")
      downloadFile(
        JSON.stringify(bundle, null, 2),
        "application/json;charset=utf-8",
        prefix + "-evidence.json",
      );
    else if (kind === "csv")
      downloadFile(
        timelineCsv(reference, current),
        "text/csv;charset=utf-8",
        prefix + "-timeline.csv",
      );
    else
      downloadFile(
        evidenceHtml(bundle),
        "text/html;charset=utf-8",
        prefix + "-report.html",
      );
    setExportMessage(
      "다운로드를 요청했습니다. 브라우저에서 완료 여부를 확인해 주세요.",
    );
  }
  const delta = (value: number | null, base: number | null) =>
    value == null || base == null
      ? "비교 불가"
      : `${value - base > 0 ? "+" : ""}${money(value - base)}`;
  return (
    <div className="analysis-workspace">
      <section
        className="card scenario-comparison"
        aria-labelledby="scenario-title"
      >
        <div className="section-title">
          <StepTitle step="04" id="scenario-title">
            가상 사례 나란히 보기
          </StepTitle>
          <span className="badge">{snapshots.length}/4개 저장</span>
        </div>
        <p className="muted">
          오른쪽 사례 슬롯에 저장한 가정을 다시 계산해 현재 결과와 비교합니다.
        </p>
        {snapshots.length > 0 ? (
          <>
            <SnapshotCards current={current} snapshots={snapshots} />
            <details open>
              <summary>입력·지표 전체 비교 표</summary>
              <div className="table-scroll">
                <table aria-label="고정 사례 비교">
                  <thead>
                    <tr>
                      <th>사례</th>
                      <th>전략</th>
                      {INPUT_KEYS.map((k) => (
                        <th key={k}>{reference.fields[k].label}</th>
                      ))}
                      <th>필요 잔액</th>
                      <th>56세 예상</th>
                      <th>자녀 부족액</th>
                      <th>부모 최저</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { id: "current", label: "현재 적용", result: current },
                      ...snapshots,
                    ].map((s) => (
                      <tr
                        key={s.id}
                        className={s.id === "current" ? "selected" : ""}
                      >
                        <th>
                          {s.label}
                          <small>{s.result.assumption_version}</small>
                        </th>
                        <td>{strategyLabels[s.result.strategy]}</td>
                        {INPUT_KEYS.map((k) => (
                          <td key={k}>
                            {formatInput(k, s.result.effective_inputs[k])}
                          </td>
                        ))}
                        <td>{money(s.result.summary.required_trust_at_56)}</td>
                        <td>{money(s.result.summary.projected_trust_at_56)}</td>
                        <td>{money(s.result.summary.child_shortfall_total)}</td>
                        <td>{money(s.result.summary.parent_asset_min)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <p className="empty-comparison">
            아직 고정한 사례가 없습니다. 오른쪽 슬롯에 가정을 저장해 비교를
            시작하세요.
          </p>
        )}
      </section>
      <section
        className="card advanced-analysis"
        aria-labelledby="sensitivity-title"
      >
        <header id="sensitivity-title">
          <span className="badge">선택</span>
          <strong>고급 분석 · 한 가정의 영향</strong>
          <small>낮은 값·현재 값·높은 값 비교</small>
        </header>
        <section className="advanced-content" aria-label="고급 민감도 분석">
          <p className="muted">
            다른 입력은 그대로 두고, 한 입력만 낮은 값·현재 값·높은 값으로
            바꿔 두 준비 방법을 다시 계산합니다.
          </p>
          <form
            className="sensitivity-controls"
            onSubmit={(e) => {
              e.preventDefault();
              void analyze();
            }}
          >
            <label>
              바꿀 가정
              <select
                aria-label="민감도 분석 입력"
                value={field}
                disabled={disabled || loading}
                onChange={(e) => setField(e.target.value)}
              >
                {INPUT_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {reference.fields[k].label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              하한 (
              {field === "net_real_return"
                ? "%"
                : field === "child_end_age"
                  ? "세"
                  : "만 원/월"}
              )
              <input
                aria-label="민감도 하한"
                inputMode="decimal"
                value={lower}
                disabled={disabled}
                onChange={(e) => {
                  invalidate();
                  setLower(e.target.value);
                }}
              />
            </label>
            <div className="sensitivity-current">
              <small>현재 적용값</small>
              <strong>
                {formatInput(field, current.effective_inputs[field])}
              </strong>
            </div>
            <label>
              상한 (
              {field === "net_real_return"
                ? "%"
                : field === "child_end_age"
                  ? "세"
                  : "만 원/월"}
              )
              <input
                aria-label="민감도 상한"
                inputMode="decimal"
                value={upper}
                disabled={disabled}
                onChange={(e) => {
                  invalidate();
                  setUpper(e.target.value);
                }}
              />
            </label>
            <button
              className="primary"
              disabled={disabled || loading}
              type="submit"
            >
              {loading ? "분석 중…" : "민감도 계산"}
            </button>
          </form>
          <details>
            <summary>구간 설정 기준</summary>
            <p className="fine">
              분석은 적용 입력을 바꾸지 않습니다. 기본 구간: 금액 ±20%(최소 10만
              원), 수익률 ±0.5%p, 나이 ±5세. 허용 범위에서 조정하며 같은 값은 한
              번만 계산합니다.
            </p>
          </details>
          {analysisError && (
            <p role="alert" className="error">
              {analysisError}
            </p>
          )}
          {visibleAnalysis && (
            <>
              <SensitivityBars
                analysis={visibleAnalysis}
                field={field}
                currentValue={current.effective_inputs[field]}
              />
              <details open>
                <summary>민감도 전체 지표 표</summary>
                <div className="table-scroll">
                  <table aria-label="민감도 분석 결과">
                    <thead>
                      <tr>
                        <th>변경값</th>
                        <th>전략</th>
                        <th>필요 잔액</th>
                        <th>현재 대비</th>
                        <th>56세 예상</th>
                        <th>자녀 부족액</th>
                        <th>부모 최저</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleAnalysis.variants.flatMap((v) =>
                        v.results.map((r) => {
                          const base =
                            r.strategy === current.strategy
                              ? current
                              : alternative;
                          return (
                            <tr
                              key={`${v.value}-${r.strategy}`}
                              className={
                                v.value === current.effective_inputs[field]
                                  ? "selected"
                                  : ""
                              }
                            >
                              <th>
                                {formatInput(field, v.value)}
                                {v.value ===
                                  current.effective_inputs[field] && (
                                  <small>현재</small>
                                )}
                              </th>
                              <td>{strategyLabels[r.strategy]}</td>
                              <td>{money(r.summary.required_trust_at_56)}</td>
                              <td>
                                {delta(
                                  r.summary.required_trust_at_56,
                                  base.summary.required_trust_at_56,
                                )}
                              </td>
                              <td>{money(r.summary.projected_trust_at_56)}</td>
                              <td>{money(r.summary.child_shortfall_total)}</td>
                              <td>{money(r.summary.parent_asset_min)}</td>
                            </tr>
                          );
                        }),
                      )}
                    </tbody>
                  </table>
                </div>
              </details>
              <p className="fine" role="status">
                민감도 계산 완료 · {visibleAnalysis.variants.length}개 입력값에서
                두 준비 방법 비교 · {current.assumption_version}. 필요 잔액이 미지원이면
                차이도 비교 불가로 표시합니다. 자동 권고가 아닙니다.
              </p>
            </>
          )}
        </section>
      </section>
      {exportTarget &&
        createPortal(
          <>
            <button
              disabled={disabled || loading}
              onClick={() => exportFile("json")}
            >
              근거 묶음 json 내보내기 <span aria-hidden="true">↗</span>
            </button>
            <button disabled={disabled} onClick={() => exportFile("csv")}>
              연도별 경로 csv 내보내기 <span aria-hidden="true">↗</span>
            </button>
            <button
              disabled={disabled || loading}
              onClick={() => exportFile("html")}
            >
              근거 보고서 html 다운로드 <span aria-hidden="true">↗</span>
            </button>
            {exportMessage && (
              <p className="fine" role="status">
                {exportMessage}
              </p>
            )}
          </>,
          exportTarget,
        )}
    </div>
  );
}
