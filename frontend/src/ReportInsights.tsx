import React, { useId, useState } from "react";
import data from "./report-baseline.json";
import { StepTitle } from "./StepTitle.tsx";

type Series = {
  label: string;
  points: number[][];
  color: string;
  dashed?: boolean;
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
export function ReportInsights({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useState(0);
  const id = useId();
  const percent = (n: number) => `${(n / 1e8).toFixed(1)}`;
  return (
    <section className="card comparison report-insights" id="comparison-panel">
      <div className="section-title">
        <StepTitle step="02">보고서 기준 사례</StepTitle>
        <span className="tag">기준 사례 참고</span>
      </div>
      <p className="fine">
        보고서 v1.5의 진단과 실행 흐름입니다. 지금 적용한 가정의 결과는
        오른쪽 패널에서 확인하세요.
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
              충족률은 설계 전 법정상속 몫 2.81억 ÷ 필요 3.50억의 반올림값이며,
              B/B′ 적용 결과가 아닙니다.
            </p>
          </>
        )}
        {tab === 1 && children}
        {tab === 2 && (
          <>
            <div className="reference-pair">
              {(["accumulation", "withdrawal"] as const).map((phase) => (
                <ReferenceChart
                  key={phase}
                  title={
                    phase === "accumulation"
                      ? "부모 생전 적립 · 연말 잔액"
                      : "부모 사후 신탁 · 연말 잔액"
                  }
                  series={data.trust.map((s, i) => ({
                    label:
                      s.strategy === "B" ? "B · 단계 적립" : "B′ · 사후 보충",
                    points: s[phase],
                    color: i === 0 ? "#004EA2" : "#B38944",
                    dashed: i === 1,
                  }))}
                  xLabel="지훈 씨 나이"
                  yLabel="억 원"
                  xFormat={(n) => `${Math.round(n)}세`}
                  yFormat={percent}
                />
              ))}
            </div>
            <div className="report-stat-row">
              {data.trust.map((s) => (
                <div key={s.strategy}>
                  <b>{s.strategy === "B" ? "B" : "B′"} · 56세 연초</b>
                  <span>
                    {won(s.pre_supplement)}
                    {s.supplement > 0
                      ? ` + 사후 보충 ${won(s.supplement)}`
                      : ""}
                  </span>
                  <strong>{won(s.projected)}</strong>
                </div>
              ))}
            </div>
            <p className="fine">
              그림 8 참고 · 기준 입력·보고서 산식 재현. 사후 그래프는 56세 연초
              보충 후 인출·수익을 반영한 연말 값입니다. 보고서의 반올림된 그림
              숫자에 맞춰 경로를 조정하지 않았습니다. ‘조기 사망 공백 0.44억 →
              25세부터 0’은 보고서의 별도 보장 사례 설명이며 이 경로의 동적
              계산값이 아닙니다.
            </p>
          </>
        )}
        {tab === 3 && (
          <>
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
          </>
        )}
        {tab === 4 && (
          <>
            <p className="fine">
              그림 9 · 착수 후 180일 실행 일정 예시. 보고서 도식의 기간을 옮긴
              것으로 개인별 법정 기한·실행 확정을 계산하지 않습니다.
            </p>
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
                        <div
                          className="schedule-track"
                          aria-label={`${start}일부터 ${end}일까지`}
                        >
                          <span
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
                          >
                            <span className="sr-only">
                              {start}~{end}일
                            </span>
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
        {(tab === 2 || tab === 3) && (
          <p className="fine reference-version">
            {data.source_version} · {data.assumption_version} · 기준 입력 고정
          </p>
        )}
      </div>
    </section>
  );
}
