import React from "react";
import { money } from "./Chart.tsx";
import { formatInput, type Sensitivity, type Snapshot } from "./analysis.ts";
import type { Result } from "./simulation.ts";
import { strategyLabels } from "./strategyLabels.ts";

export function SensitivityBars({
  analysis,
  field,
  currentValue,
}: {
  analysis: Sensitivity;
  field: string;
  currentValue: number;
}) {
  const max = Math.max(
    1,
    ...analysis.variants.flatMap((v) =>
      v.results.flatMap((r) => [
        r.summary.required_trust_at_56 ?? 0,
        r.summary.projected_trust_at_56,
      ]),
    ),
  );
  return (
    <div className="sensitivity-visual" aria-label="민감도 잔액 비교 시각화">
      <div className="visual-legend">
        <span>
          <i className="bar-b" /> {strategyLabels.B} 예상
        </span>
        <span>
          <i className="bar-bp" /> {strategyLabels.B_PRIME} 예상
        </span>
        <span>
          <i className="need-line" /> 필요액
        </span>
      </div>
      {analysis.variants.map((v) => {
        const required = v.results[0].summary.required_trust_at_56;
        return (
          <article
            key={v.value}
            className={v.value === currentValue ? "is-current" : ""}
          >
            <header>
              <b>{formatInput(field, v.value)}</b>
              {v.value === currentValue && <small>현재</small>}
              <span>필요 {money(required)}</span>
            </header>
            <svg
              preserveAspectRatio="none"
              viewBox="0 0 320 34"
              role="img"
              aria-label={
                v.results
                  .map(
                    (r) =>
                      `${strategyLabels[r.strategy]} 예상 ${money(r.summary.projected_trust_at_56)}`,
                  )
                  .join(", ") + `, 필요 ${money(required)}`
              }
            >
              {v.results.map((r, i) => (
                <g key={r.strategy}>
                  <rect
                    x="0"
                    y={i * 18}
                    width="310"
                    height="11"
                    rx="3"
                    fill="#eef4fb"
                  />
                  <rect
                    x="0"
                    y={i * 18}
                    width={
                      (Math.max(0, r.summary.projected_trust_at_56) / max) * 310
                    }
                    height="11"
                    rx="3"
                    fill={r.strategy === "B" ? "#004EA2" : "#B38944"}
                  />
                </g>
              ))}
              {required != null && (
                <line
                  x1={(required / max) * 310}
                  x2={(required / max) * 310}
                  y1="0"
                  y2="32"
                  stroke="#8b5c46"
                  strokeWidth="2"
                />
              )}
            </svg>
            <footer>
              {v.results.map((r) => (
                <span key={r.strategy}>
                  {strategyLabels[r.strategy]}{" "}
                  {money(r.summary.projected_trust_at_56)}
                </span>
              ))}
            </footer>
          </article>
        );
      })}
      <p className="fine">
        모든 막대는 같은 축입니다. 선은 필요 잔액, 막대는 56세 예상 잔액입니다.
      </p>
    </div>
  );
}

export function SnapshotCards({
  current,
  snapshots,
}: {
  current: Result;
  snapshots: Snapshot[];
}) {
  return (
    <div className="snapshot-grid" aria-label="사례 요약 카드">
      {[
        { id: "current", label: "현재 적용", result: current },
        ...snapshots,
      ].map((s) => (
        <article key={s.id} className={s.id === "current" ? "is-current" : ""}>
          <header>
            <b>{s.label}</b>
            <span>{strategyLabels[s.result.strategy]}</span>
          </header>
          <p className="snapshot-inputs">
            생활비{" "}
            {formatInput(
              "monthly_child_cost",
              s.result.effective_inputs.monthly_child_cost,
            )}{" "}
            ·{" "}
            {formatInput(
              "net_real_return",
              s.result.effective_inputs.net_real_return,
            )}{" "}
            · {s.result.effective_inputs.child_end_age}세
          </p>
          <strong>{money(s.result.summary.child_shortfall_total)}</strong>
          <small>자녀 평생 생활비 부족액</small>
          <dl>
            <div>
              <dt>필요 잔액</dt>
              <dd>{money(s.result.summary.required_trust_at_56)}</dd>
            </div>
            <div>
              <dt>56세 예상</dt>
              <dd>{money(s.result.summary.projected_trust_at_56)}</dd>
            </div>
            <div>
              <dt>부모 최저</dt>
              <dd>{money(s.result.summary.parent_asset_min)}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}
