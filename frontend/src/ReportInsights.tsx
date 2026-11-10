import React, { useEffect, useId, useState } from "react";
import data from "./report-baseline.json";
import { money } from "./Chart.tsx";
import type { Snapshot } from "./analysis.ts";
import type { Result } from "./simulation.ts";
import { StepTitle } from "./StepTitle.tsx";

type Series = {
  label: string;
  points: number[][];
  color: string;
  dashed?: boolean;
};
type BenefitCurves = {
  survivor_monthly: number;
  assumption_version: string;
  curves: { age: number; points: number[][] }[];
};
const won = (value: number) => `${value.toLocaleString("ko-KR")}원`;
function ReferenceChart({
  title,
  series,
  xLabel,
  yLabel,
  xFormat,
  xValueFormat = xFormat,
  yFormat,
}: {
  title: string;
  series: Series[];
  xLabel: string;
  yLabel: string;
  xFormat: (n: number) => string;
  xValueFormat?: (n: number) => string;
  yFormat: (n: number) => string;
}) {
  const id = useId();
  const xs = [
    ...new Set(series.flatMap((s) => s.points.map((p) => p[0]))),
  ].sort((a, b) => a - b);
  const [selected, setSelected] = useState<number | null>(null);
  const min = xs[0],
    max = xs[xs.length - 1],
    top =
      Math.max(...series.flatMap((s) => s.points.map((p) => p[1])), 1) * 1.1;
  const x = (n: number) => 62 + ((n - min) / (max - min || 1)) * 466,
    y = (n: number) => 230 - (n / top) * 202;
  const index = selected === null ? null : Math.min(selected, xs.length - 1);
  return (
    <figure className="reference-chart">
      <figcaption>{title}</figcaption>
      <svg
        viewBox="0 0 560 280"
        role="img"
        aria-labelledby={id}
        tabIndex={0}
        aria-label="← → 키와 Home/End 키로 표본 값을 확인하세요."
        onKeyDown={(e) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            setSelected(
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? xs.length - 1
                  : Math.max(
                      0,
                      Math.min(
                        xs.length - 1,
                        (index ?? 0) + (e.key === "ArrowRight" ? 1 : -1),
                      ),
                    ),
            );
          }
        }}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const target =
            min +
            ((((e.clientX - rect.left) / rect.width) * 560 - 62) / 466) *
              (max - min);
          let closest = 0;
          xs.forEach((v, i) => {
            if (Math.abs(v - target) < Math.abs(xs[closest] - target))
              closest = i;
          });
          setSelected(closest);
        }}
      >
        <title id={id}>
          {title} · {xLabel} / {yLabel}
        </title>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line
              x1="62"
              x2="528"
              y1={y((top * i) / 4)}
              y2={y((top * i) / 4)}
              className="reference-grid"
            />
            <text x="54" y={y((top * i) / 4) + 4} textAnchor="end">
              {yFormat((top * i) / 4)}
            </text>
          </g>
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <text
            key={i}
            x={x(min + ((max - min) * i) / 4)}
            y="250"
            textAnchor="middle"
          >
            {xFormat(min + ((max - min) * i) / 4)}
          </text>
        ))}
        {series.map((s) => (
          <path
            key={s.label}
            d={s.points
              .map((p, i) => `${i ? "L" : "M"}${x(p[0])},${y(p[1])}`)
              .join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth="3"
            strokeDasharray={s.dashed ? "7 4" : undefined}
          />
        ))}
        {index !== null && (
          <g>
            <line
              x1={x(xs[index])}
              x2={x(xs[index])}
              y1="25"
              y2="230"
              stroke="var(--secondary)"
              strokeDasharray="3 3"
            />
            {series.map((s) => {
              const p = s.points.find((p) => p[0] === xs[index]);
              return p ? (
                <circle
                  key={s.label}
                  cx={x(p[0])}
                  cy={y(p[1])}
                  r="4"
                  fill={s.color}
                />
              ) : null;
            })}
          </g>
        )}
        <text x="295" y="275" textAnchor="middle">
          {xLabel}
        </text>
        <text x="62" y="15">
          {yLabel}
        </text>
      </svg>
      <div className="reference-legend">
        {series.map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="reference-readout" role="status">
        {index === null ? (
          <span>그래프를 가리키거나 선택 후 ← → 키로 값을 확인하세요.</span>
        ) : (
          <>
            <b>{xValueFormat(xs[index])}</b>
            {series.map((s) => {
              const p = s.points.find((p) => p[0] === xs[index]);
              return p ? (
                <span key={s.label}>
                  {s.label} · {won(p[1])}
                </span>
              ) : null;
            })}
          </>
        )}
      </div>
    </figure>
  );
}
const ratios = [
  ["가계수지지표", "총지출 ÷ 총소득(세후)", "90% 이하", "91.3%", "주의"],
  ["비상자금지표", "유동자산 ÷ 월 지출", "6개월 이상", "13.7개월", "양호"],
  ["총부채상환지표", "연 원리금 ÷ 연소득", "30% 이하", "15.0%", "양호"],
  [
    "총저축성향지표",
    "연 저축 ÷ 연소득",
    "10% 이상",
    "8.0% (부모 몫 1.7%)",
    "주의",
  ],
  [
    "부모 사후 생활비 준비율",
    "지훈 씨 몫 재원 ÷ 부모 사후 부족액",
    "100% 이상",
    "0%",
    "위험",
  ],
  [
    "조기 사망 보장 충족률",
    "(적립 + 상속 몫) ÷ 필요 잔액",
    "100% 이상",
    "80%",
    "위험",
  ],
];
const schedule: [string, string, number, number, number][] = [
  ["평생계획서 초안·지원자 정기 연락", "지원센터", 0, 30, 0],
  ["수급 반영·세무 처리 서면 확인", "시·군·구 / 세무사", 0, 45, 1],
  ["신탁 조건 확인·보험 인수 심사", "설계사 / 보험사", 15, 45, 2],
  ["확인 결과 재계산·첫 납입액 확정", "설계사", 40, 45, 3],
  ["장애인신탁 계약·첫 납입", "신탁업자", 45, 60, 2],
  ["증여세 신고·과세가액 불산입 신청", "세무사", 60, 150, 3],
  ["보험금청구권 신탁·수익자 지정", "보험사 / 신탁업자", 60, 90, 2],
  ["공정증서 유언·유언대용신탁", "공증인 / 변호사", 60, 120, 2],
  ["후견 유형·개인별 지원계획", "가정법원 / 지원센터", 120, 150, 0],
  ["어머니 국민연금 추후납부 확인·신청", "공단", 150, 180, 3],
];
const categories = ["본인·돌봄 지원", "기관 확인", "금융 계약", "세무·납입"];
const colors = ["#006F4D", "#7C37F2", "#004EA2", "#B38944"];
const tabs = [
  "재무비율 진단",
  "대안 비교",
  "신탁 경로",
  "급여 문턱",
  "180일 일정",
];
export function ReportInsights({
  children,
  result,
  comparison,
  activeSlot,
  snapshots,
}: {
  children: React.ReactNode;
  result: Result | null;
  comparison: Result | null;
  activeSlot: string | null;
  snapshots: Snapshot[];
}) {
  const [tab, setTab] = useState(0);
  const [curves, setCurves] = useState<BenefitCurves | null>(null);
  const [curveError, setCurveError] = useState(false);
  const pension = result?.effective_inputs.monthly_survivor_pension;
  const assumptionVersion = result?.assumption_version;
  const currentCurves =
    curves?.survivor_monthly === pension &&
    curves?.assumption_version === assumptionVersion
      ? curves
      : null;
  useEffect(() => {
    if (tab !== 3 || pension == null) return;
    const controller = new AbortController();
    setCurveError(false);
    void (async () => {
      try {
        const response = await fetch(
          `/api/benefit-curves?survivor_monthly=${pension}`,
          {
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(15000),
            ]),
          },
        );
        if (!response.ok) throw new Error();
        const data: BenefitCurves = await response.json();
        if (
          data.survivor_monthly !== pension ||
          data.assumption_version !== assumptionVersion
        )
          throw new Error();
        if (!controller.signal.aborted) setCurves(data);
      } catch {
        if (!controller.signal.aborted) setCurveError(true);
      }
    })();
    return () => controller.abort();
  }, [tab, pension, assumptionVersion]);
  const id = useId();
  const percent = (n: number) => `${(n / 1e8).toFixed(1)}`;
  const label = (item: Result) =>
    item.strategy === "B" ? "B · 단계 적립" : "B′ · 사후 보충";
  const cases = [result, comparison].filter(
    (item): item is Result => item !== null,
  );
  const summary = result?.summary;
  const firstWithdrawal = result?.child_timeline.find(
    (row) => row.phase === "withdrawal",
  );
  const monthlyCost = result?.effective_inputs.monthly_child_cost ?? 0;
  const monthlyShortfall = (firstWithdrawal?.shortfall ?? 0) / 12;
  const firstShortfall = summary?.child_shortfall_years[0];
  const transitionRows = cases.flatMap((item) =>
    item.child_timeline
      .filter((row) => row.child_age === 64 || row.child_age === 65)
      .map((row) => ({ item, row })),
  );
  const benefits = cases
    .map((item, index) => ({
      label: label(item),
      points: item.child_timeline.flatMap((row) =>
        row.benefits == null || row.child_age == null
          ? []
          : [[row.child_age, row.benefits / 12]],
      ),
      color: index ? "#B38944" : "#004EA2",
      dashed: index === 1,
    }))
    .filter((series) => series.points.length);
  return (
    <section className="card comparison report-insights" id="comparison-panel">
      <div className="section-title">
        <StepTitle step="02">적용 사례 진단</StepTitle>
        <span className="tag">
          {activeSlot ? `슬롯 ${activeSlot}` : "현재 적용"}
        </span>
      </div>
      <p className="fine">
        {result
          ? `${label(result)} · 생활비 ${money(result.effective_inputs.monthly_child_cost)}/월 · 연 ${Number((result.effective_inputs.net_real_return * 100).toFixed(2))}% · ${result.effective_inputs.child_end_age}세까지`
          : "계산 결과를 불러오고 있어요."}
      </p>
      <div className="report-tabs" role="tablist" aria-label="보고서 참고 자료">
        {tabs.map((label, i) => (
          <button
            key={label}
            role="tab"
            id={`${id}-tab-${i}`}
            aria-controls={`${id}-panel`}
            aria-selected={tab === i}
            tabIndex={tab === i ? 0 : -1}
            onClick={() => setTab(i)}
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const next =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? 4
                      : (i + (e.key === "ArrowRight" ? 1 : 4)) % 5;
                setTab(next);
                document.getElementById(`${id}-tab-${next}`)?.focus();
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${tab}`}
        tabIndex={0}
      >
        {tab === 0 && (
          <>
            {summary && (
              <div className="report-stat-row">
                <div>
                  <span>56세 필요 잔액</span>
                  <strong>{money(summary.required_trust_at_56)}</strong>
                </div>
                <div>
                  <span>생활비 부족</span>
                  <strong>{money(summary.child_shortfall_total)}</strong>
                  <span>{summary.child_shortfall_years.length}년</span>
                </div>
                <div>
                  <span>부모 금융자산 최저</span>
                  <strong>{money(summary.parent_asset_min)}</strong>
                </div>
                <div>
                  <span>56세 필요 잔액 충당률</span>
                  <strong>
                    {summary.required_trust_at_56 == null
                      ? "계산 미지원"
                      : summary.required_trust_at_56 === 0
                        ? "필요액 0원"
                        : `${Math.round((summary.projected_trust_at_56 / summary.required_trust_at_56) * 100)}%`}
                  </strong>
                </div>
                {firstWithdrawal && (
                  <div>
                    <span>56세 생활비 충당률</span>
                    <strong>
                      {monthlyCost === 0
                        ? "생활비 0원"
                        : `${Math.round(((monthlyCost - monthlyShortfall) / monthlyCost) * 100)}%`}
                    </strong>
                    <span>(생활비 − 부족액) ÷ 생활비</span>
                  </div>
                )}
              </div>
            )}
            <details>
              <summary>표 7 · 설계 전 재무비율 원문 보기</summary>
              <div className="report-summary">
                <strong>부채·비상자금은 안정적</strong>
                <span>저축과 부모 사후 준비는 보강이 필요해요.</span>
                <b>표 7 · 설계 전 보고서 고정값</b>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {["지표", "산식", "기준 (50대)", "이 가족", "판정"].map(
                        (h) => (
                          <th key={h}>{h}</th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {ratios.map((row) => (
                      <tr key={row[0]}>
                        {row.map((v, i) =>
                          i === 0 ? (
                            <th key={i} scope="row">
                              {v}
                            </th>
                          ) : (
                            <td
                              key={i}
                              className={
                                i === 4
                                  ? `diagnosis ${v === "양호" ? "good" : v === "주의" ? "caution" : "risk"}`
                                  : undefined
                              }
                            >
                              {v}
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="fine">
                상위 네 지표는 보고서가 인용한 한국형 가계재무비율의 50대
                기준입니다. 부채상환·저축성향은 세전 근로소득, 가계수지는 세후
                소득 기준입니다. 아래 두 지표는 이 가족을 위한 진단입니다. 보장
                충족률은 설계 전 법정상속 몫 2.81억 ÷ 필요 3.50억의
                반올림값이며, B/B′ 적용 결과가 아닙니다.
              </p>
            </details>
          </>
        )}
        {tab === 1 && (
          <>
            {cases.length > 0 && (
              <div className="table-scroll">
                <table aria-label="같은 가정으로 계산한 전략 비교">
                  <thead>
                    <tr>
                      <th>전략</th>
                      <th>56세 필요 잔액</th>
                      <th>56세 예상 잔액</th>
                      <th>생활비 부족액</th>
                      <th>부모 금융자산 최저</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((item) => (
                      <tr
                        key={item.strategy}
                        className={item === result ? "selected" : ""}
                      >
                        <th scope="row">
                          {label(item)}
                          {item === result && <small>현재 적용</small>}
                        </th>
                        <td>{money(item.summary.required_trust_at_56)}</td>
                        <td>{money(item.summary.projected_trust_at_56)}</td>
                        <td>{money(item.summary.child_shortfall_total)}</td>
                        <td>{money(item.summary.parent_asset_min)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {snapshots.length > 0 && (
              <>
                <h3>저장한 사례 슬롯 비교</h3>
                <p className="fine">
                  각 슬롯에 저장된 전략과 가정으로 계산한 결과입니다.
                </p>
                <div className="table-scroll">
                  <table aria-label="저장한 사례 슬롯 비교">
                    <thead>
                      <tr>
                        <th scope="col">슬롯</th>
                        <th scope="col">저장 전략</th>
                        <th scope="col">56세 필요 잔액</th>
                        <th scope="col">생활비 부족액</th>
                        <th scope="col">부모 금융자산 최저</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshots.map(
                        ({ id, label: slotLabel, result: saved }) => (
                          <tr
                            key={id}
                            className={id === activeSlot ? "selected" : ""}
                          >
                            <th scope="row">{slotLabel}</th>
                            <td>{label(saved)}</td>
                            <td>{money(saved.summary.required_trust_at_56)}</td>
                            <td>
                              {money(saved.summary.child_shortfall_total)}
                            </td>
                            <td>{money(saved.summary.parent_asset_min)}</td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <details>
              <summary>표 9 · 보고서 대안 비용과 최대 후회</summary>
              {children}
            </details>
          </>
        )}
        {tab === 2 && cases.length > 0 && (
          <div className="reference-pair">
            {["accumulation", "withdrawal"].map((phase) => {
              const series = cases
                .map((item, index) => ({
                  label: label(item),
                  points: item.child_timeline.flatMap((row) =>
                    row.phase === phase && row.child_age != null
                      ? [[row.child_age, row.end_balance]]
                      : [],
                  ),
                  color: index ? "#B38944" : "#004EA2",
                  dashed: index === 1,
                }))
                .filter((item) => item.points.length);
              return (
                series.length > 0 && (
                  <ReferenceChart
                    key={phase}
                    title={
                      phase === "accumulation"
                        ? "부모 생전 적립 · 연말 잔액"
                        : "부모 사후 신탁 · 연말 잔액"
                    }
                    series={series}
                    xLabel="지훈 씨 나이"
                    yLabel="억 원"
                    xFormat={(n) => `${Math.round(n)}세`}
                    yFormat={percent}
                  />
                )
              );
            })}
          </div>
        )}
        {tab === 3 && (
          <div className="benefit-charts">
            {currentCurves ? (
              <>
                <div className="reference-pair">
                  {currentCurves.curves.map(({ age, points }) => (
                    <ReferenceChart
                      key={age}
                      title={`${age}세 · 선택 사례의 급여 문턱`}
                      series={[
                        {
                          label: `유족연금 월 ${money(pension)}`,
                          points,
                          color: "#004EA2",
                        },
                      ]}
                      xLabel="연초 신탁 잔액 (억 원)"
                      yLabel="월 공적급여 (만 원)"
                      xFormat={percent}
                      xValueFormat={won}
                      yFormat={(n) => (n / 1e4).toFixed(0)}
                    />
                  ))}
                </div>
                <p className="fine">
                  연초 신탁 잔액 0~6억 원을 100만 원 간격으로 바꿔 본 보고서
                  모형입니다.
                </p>
              </>
            ) : (
              result && (
                <p className="fine" role="status">
                  {curveError
                    ? "급여 문턱을 불러오지 못했습니다. 다른 탭으로 이동한 뒤 다시 열어 주세요."
                    : "선택 사례의 급여 문턱을 계산하고 있어요."}
                </p>
              )
            )}
            {benefits.length > 0 && (
              <ReferenceChart
                title="현재 가정의 월평균 공적급여 경로"
                series={benefits}
                xLabel="지훈 씨 나이"
                yLabel="만 원 / 월"
                xFormat={(n) => `${Math.round(n)}세`}
                yFormat={(n) => (n / 1e4).toFixed(0)}
              />
            )}
            {benefits.length > 0 && (
              <p className="fine">
                선택 사례의 유족연금{" "}
                {money(result?.effective_inputs.monthly_survivor_pension)}/월을
                반영합니다. 공적급여 합계에는 유족연금 자체를 포함하지 않습니다.
              </p>
            )}
            {transitionRows.length > 0 && (
              <div className="table-scroll">
                <table aria-label="선택 사례의 65세 전후 급여 비교">
                  <thead>
                    <tr>
                      <th scope="col">전략</th>
                      <th scope="col">나이</th>
                      <th scope="col">연초 신탁 잔액</th>
                      <th scope="col">월 공적급여</th>
                      <th scope="col">월 신탁 인출</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transitionRows.map(({ item, row }) => (
                      <tr key={`${item.strategy}-${row.child_age}`}>
                        <th scope="row">{label(item)}</th>
                        <td>{row.child_age}세</td>
                        <td>{money(row.start_balance)}</td>
                        <td>
                          {row.benefits == null
                            ? "—"
                            : money(row.benefits / 12)}
                        </td>
                        <td>{money(row.outflows / 12)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <details>
              <summary>그림 5 · 기준 급여 문턱 보기</summary>
              <div className="reference-pair">
                {[64, 65].map((age) => (
                  <ReferenceChart
                    key={age}
                    title={
                      age === 64
                        ? "64세 · 장애인연금 구간"
                        : "65세 · 기초연금 전환"
                    }
                    series={data.benefit_curves
                      .filter((c) => c.age === age)
                      .map((c) => ({
                        label:
                          c.survivor_monthly === 0
                            ? "유족연금 없음"
                            : "유족연금 월 107만 원",
                        points: c.points,
                        color: c.survivor_monthly === 0 ? "#004EA2" : "#B38944",
                      }))}
                    xLabel="신탁 잔액 (억 원)"
                    yLabel="월 공적급여 (만 원)"
                    xFormat={(n) => (n / 1e8).toFixed(1)}
                    xValueFormat={won}
                    yFormat={(n) => (n / 1e4).toFixed(0)}
                  />
                ))}
              </div>
              <p className="fine">
                그림 5 참고 · 장애인연금·기초연금·부가급여·생계급여 합계이며
                유족연금 자체는 합계에서 제외합니다. 기존 계산 엔진의 100만 원
                간격과 전환 경계 표본을 표시합니다. 실제 기관 수급 판정이
                아닙니다. 현재 입력과 독립된 두 가지 기준 비교입니다.
              </p>
            </details>
          </div>
        )}
        {tab === 4 && (
          <>
            <p className="fine">
              그림 9 · 착수 후 180일 실행 일정 예시. 보고서 도식의 기간을 옮긴
              것으로 개인별 법정 기한·실행 확정을 계산하지 않습니다.
            </p>
            {summary && (
              <div className="report-summary">
                <strong>
                  {activeSlot ? `슬롯 ${activeSlot}` : "현재 적용"} · 재계산과
                  첫 납입 상담에 가져갈 값
                </strong>
                <span>
                  56세 필요 잔액 {money(summary.required_trust_at_56)} · 예상
                  잔액 {money(summary.projected_trust_at_56)}
                </span>
                <span>
                  자녀 생활비{" "}
                  {firstShortfall == null
                    ? "선택 기간 내 부족 없음"
                    : `${firstShortfall}년 첫 부족`}{" "}
                  · 부모 금융자산{" "}
                  {summary.parent_first_negative_year == null
                    ? "모형 기간 내 음수 없음"
                    : `${summary.parent_first_negative_year}년 처음 음수`}
                </span>
              </div>
            )}
            <div className="schedule-legend">
              {categories.map((c, i) => (
                <span key={c}>
                  <i style={{ background: colors[i] }} />
                  {c}
                </span>
              ))}
            </div>
            <div className="table-scroll">
              <table className="schedule-table">
                <thead>
                  <tr>
                    <th>실행할 일 / 담당</th>
                    <th>
                      <div className="schedule-axis">
                        {[0, 30, 60, 90, 120, 150, 180].map((n) => (
                          <span key={n}>{n}일</span>
                        ))}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map(([task, owner, start, end, category]) => (
                    <tr key={task}>
                      <th scope="row">
                        {task}
                        <small>{owner}</small>
                      </th>
                      <td>
                        <div className="schedule-track">
                          <span
                            tabIndex={0}
                            role="img"
                            aria-label={`${task} · ${owner} · 착수 후 ${start}~${end}일`}
                            className={
                              task.startsWith("증여세")
                                ? "schedule-deadline"
                                : ""
                            }
                            style={{
                              left: `${(start / 180) * 100}%`,
                              width: `${((end - start) / 180) * 100}%`,
                              backgroundColor: colors[category],
                            }}
                          ></span>
                          <span className="schedule-tooltip" aria-hidden="true">
                            {task} · {start}–{end}일
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {result && (
          <p className="fine reference-version">
            {result.source_version} · {result.assumption_version}
          </p>
        )}
      </div>
    </section>
  );
}
