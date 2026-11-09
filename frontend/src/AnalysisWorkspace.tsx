import React, { useEffect, useRef, useState } from "react";
import { money } from "./Chart.tsx";
import { fromDisplay } from "./units.ts";
import {
  requestSimulation,
  type Reference,
  type Result,
} from "./simulation.ts";
import {
  addSnapshot,
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

const names = { B: "B", B_PRIME: "B′" };
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
}: {
  reference: Reference;
  current: Result;
  alternative: Result;
  disabled: boolean;
}) {
  const [field, setField] = useState("monthly_child_cost");
  const [lower, setLower] = useState(""),
    [upper, setUpper] = useState("");
  const [analysis, setAnalysis] = useState<Sensitivity | null>(null),
    [loading, setLoading] = useState(false),
    [analysisError, setAnalysisError] = useState("");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]),
    [sequence, setSequence] = useState(1),
    [message, setMessage] = useState(""),
    [cardError, setCardError] = useState("");
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
  function pin() {
    setCardError("");
    setMessage("");
    try {
      setSnapshots(
        addSnapshot(
          snapshots,
          reference,
          current,
          String(sequence),
          new Date().toISOString(),
        ),
      );
      setSequence(sequence + 1);
      setMessage(
        "적용한 계산을 비교 카드에 고정했습니다. 새로고침하면 삭제됩니다.",
      );
    } catch (e) {
      setCardError(
        e instanceof Error ? e.message : "비교 카드를 추가하지 못했습니다.",
      );
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
    setMessage(
      "적용된 계산의 파일을 생성했습니다. 보고서 고정값과 미확인 가정을 함께 확인해 주세요.",
    );
  }
  const delta = (value: number | null, base: number | null) =>
    value == null || base == null
      ? "비교 불가"
      : `${value - base > 0 ? "+" : ""}${money(value - base)}`;
  return (
    <div className="analysis-workspace">
      <section className="card sensitivity" aria-labelledby="sensitivity-title">
        <div className="section-title">
          <h2 id="sensitivity-title">
            한 가정의 영향 <span className="tag">F08 · P1</span>
          </h2>
          <span className="badge">민감도 분석</span>
        </div>
        <p className="muted">
          다른 입력을 고정하고 한 가정의 하한·현재·상한에서 B와 B′를
          재계산합니다.
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
        <p className="fine">
          분석은 적용 입력을 바꾸지 않습니다. 기본 구간: 금액 ±20%(최소 10만
          원), 수익률 ±0.5%p, 나이 ±5세. 허용 범위에서 조정하며 같은 값은 한
          번만 계산합니다.
        </p>
        {analysisError && (
          <p role="alert" className="error">
            {analysisError}
          </p>
        )}
        {visibleAnalysis && (
          <>
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
                        r.strategy === current.strategy ? current : alternative;
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
                            {v.value === current.effective_inputs[field] && (
                              <small>현재</small>
                            )}
                          </th>
                          <td>{names[r.strategy]}</td>
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
            <p className="fine" role="status">
              민감도 계산 완료 · {visibleAnalysis.variants.length}개 입력값 ×
              B/B′ · {current.assumption_version}. 필요 잔액이 미지원이면 차이도
              비교 불가로 표시합니다. 자동 권고가 아닙니다.
            </p>
          </>
        )}
      </section>
      <section
        className="card scenario-comparison"
        aria-labelledby="scenario-title"
      >
        <div className="section-title">
          <h2 id="scenario-title">
            가상 사례 나란히 보기 <span className="tag">F09 · P1</span>
          </h2>
          <span className="badge">{snapshots.length}/3개 고정</span>
        </div>
        <p className="muted">
          적용한 사례를 고정하고 입력이나 전략을 바꿔 차이를 살펴보세요.
        </p>
        <div className="scenario-actions">
          <button disabled={disabled} onClick={pin}>
            현재 계산을 비교 카드에 고정
          </button>
          {snapshots.length > 0 && (
            <button
              disabled={disabled}
              onClick={() => {
                setSnapshots([]);
                setCardError("");
                setMessage("비교 카드를 모두 삭제했습니다.");
              }}
            >
              비교 카드 모두 삭제
            </button>
          )}
        </div>
        <p className="fine">
          현재 탭에서만 유지됩니다. 새로고침·초기화 시 비교 카드는 삭제되며,
          브라우저 저장소에 계산 결과를 보관하지 않습니다.
        </p>
        {cardError && (
          <p role="alert" className="error">
            {cardError}
          </p>
        )}
        {snapshots.length > 0 ? (
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
                  <th>관리</th>
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
                    <td>{names[s.result.strategy]}</td>
                    {INPUT_KEYS.map((k) => (
                      <td key={k}>
                        {formatInput(k, s.result.effective_inputs[k])}
                      </td>
                    ))}
                    <td>{money(s.result.summary.required_trust_at_56)}</td>
                    <td>{money(s.result.summary.projected_trust_at_56)}</td>
                    <td>{money(s.result.summary.child_shortfall_total)}</td>
                    <td>{money(s.result.summary.parent_asset_min)}</td>
                    <td>
                      {s.id !== "current" && (
                        <button
                          aria-label={`${s.label} 삭제`}
                          onClick={() => {
                            setSnapshots(
                              snapshots.filter((x) => x.id !== s.id),
                            );
                            setCardError("");
                          }}
                        >
                          삭제
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-comparison">
            아직 고정한 사례가 없습니다. 현재 계산을 추가해 비교를 시작하세요.
          </p>
        )}
      </section>
      <section className="card exports" aria-labelledby="export-title">
        <div className="section-title">
          <h2 id="export-title">
            계산 근거 가져가기 <span className="tag">F10 · P1</span>
          </h2>
          <span className="badge">가정·한계 포함</span>
        </div>
        <p className="muted">
          편집 중인 값 대신 적용된 입력과 원 단위 결과를 내보냅니다.
        </p>
        <div className="export-actions">
          <button
            disabled={disabled || loading}
            onClick={() => exportFile("json")}
          >
            근거 묶음 JSON 다운로드
          </button>
          <button disabled={disabled} onClick={() => exportFile("csv")}>
            연도별 경로 CSV 다운로드
          </button>
          <button
            disabled={disabled || loading}
            onClick={() => exportFile("html")}
          >
            근거 보고서 HTML 다운로드
          </button>
        </div>
        <p className="fine">
          JSON·HTML에는 고정한 사례와 완료된 현재 민감도 분석도 포함됩니다.
          CSV는 현재 전략의 부모·자녀 연도표입니다. 파일은 이 브라우저에서
          생성하며 서버에 업로드하지 않습니다. HTML은 열어서 브라우저 인쇄로
          PDF를 저장할 수 있습니다.
        </p>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
