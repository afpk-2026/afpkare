import React, { useId, useState } from "react";
export type Row = {
  year: number;
  child_age?: number;
  parent_age?: number;
  phase?: string;
  start_balance: number;
  inflows: number;
  outflows: number;
  benefits: number | null;
  shortfall?: number;
  interest: number;
  end_balance: number;
  benefit_regime?: string;
  components?: Record<string, number>;
};
export const money = (v: number | null | undefined) => {
  if (v == null) return "계산 미지원";
  if (Math.abs(v) < 1000000) return `${v.toLocaleString("ko-KR")}원`;
  if (Math.abs(v) < 100000000)
    return `${Math.round(v / 10000).toLocaleString("ko-KR")}만 원`;
  return `${(v / 100000000).toFixed(2)}억 원`;
};
export function Chart({
  title,
  rows,
  otherRows,
  label,
  otherLabel,
  cursorYear,
}: {
  title: string;
  rows: Row[];
  otherRows: Row[];
  label: string;
  otherLabel: string;
  cursorYear?: number;
}) {
  const id = useId().replace(/:/g, "");
  const [hoverYear, setHoverYear] = useState<number | null>(null);
  const all = [...rows, ...otherRows].map((x) => x.end_balance),
    min = Math.min(0, ...all),
    max = Math.max(1, ...all),
    range = max - min;
  const first = rows[0]?.year ?? 2026,
    last = Math.max(rows.at(-1)?.year ?? 2026, otherRows.at(-1)?.year ?? 2026);
  const x = (year: number) =>
    42 + ((year - first) / Math.max(1, last - first)) * 510;
  const y = (v: number) => 18 + ((max - v) / range) * 155;
  const points = (r: Row[]) =>
    r.map((row) => `${x(row.year)},${y(row.end_balance)}`).join(" ");
  const active =
    hoverYear == null ? undefined : rows.find((r) => r.year === hoverYear);
  const other =
    hoverYear == null ? undefined : otherRows.find((r) => r.year === hoverYear);
  const reveal = Math.max(first, Math.min(last, cursorYear ?? last));
  const shown = rows.filter((r) => r.year <= reveal).at(-1);
  const selectYear = (event: React.PointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = Math.max(
      0,
      Math.min(1, (event.clientX - rect.left) / rect.width),
    );
    setHoverYear(Math.round(first + fraction * (last - first)));
  };
  return (
    <div className="real-chart">
      <h3>{title}</h3>
      <div className="chart-stage" onPointerLeave={() => setHoverYear(null)}>
        <svg
          tabIndex={0}
          onFocus={() => setHoverYear(Math.round(reveal))}
          onBlur={() => setHoverYear(null)}
          onKeyDown={(event) => {
            if (
              !["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(
                event.key,
              )
            )
              return;
            event.preventDefault();
            if (event.key === "Escape") {
              setHoverYear(null);
              return;
            }
            setHoverYear((year) =>
              event.key === "Home"
                ? first
                : event.key === "End"
                  ? last
                  : Math.max(
                      first,
                      Math.min(
                        last,
                        (year ?? Math.round(reveal)) +
                          (event.key === "ArrowRight" ? 1 : -1),
                      ),
                    ),
            );
          }}
          aria-describedby={`${id}-help${hoverYear == null ? "" : ` ${id}-tooltip`}`}
          viewBox="0 0 570 210"
          role="img"
          aria-label={`${title} 연도별 경로. ${label} 실선, ${otherLabel} 점선. 상세 값은 아래 연도별 표 참조.`}
        >
          <defs>
            <clipPath id={`${id}-reveal`}>
              <rect
                x="42"
                y="16"
                width={Math.max(0, x(reveal) - 42)}
                height="160"
              />
            </clipPath>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#004EA2" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#004EA2" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((p) => (
            <g key={p}>
              <line
                x1="42"
                x2="552"
                y1={18 + p * 155}
                y2={18 + p * 155}
                stroke="#dce4ef"
              />
              <text x="0" y={22 + p * 155}>
                {((max - p * range) / 1e8).toFixed(1)}억
              </text>
            </g>
          ))}
          <line x1="42" x2="552" y1={y(0)} y2={y(0)} stroke="#9aabc0" />
          {[2031, 2036, 2062, 2071]
            .filter((v) => v >= first && v <= last)
            .map((v) => (
              <line
                key={v}
                x1={x(v)}
                x2={x(v)}
                y1="18"
                y2="173"
                stroke="#dce4ef"
                strokeDasharray="3 4"
              />
            ))}
          <polyline
            points={points(otherRows)}
            fill="none"
            stroke="#B38944"
            strokeWidth="2"
            strokeDasharray="5 4"
          />
          <g clipPath={`url(#${id}-reveal)`}>
            {rows.length > 0 && (
              <polygon
                points={`${x(rows[0].year)},${y(0)} ${points(rows)} ${x(rows.at(-1)!.year)},${y(0)}`}
                fill={`url(#${id}-fill)`}
              />
            )}
            <polyline
              points={points(rows)}
              fill="none"
              stroke="#004EA2"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          </g>
          {shown && cursorYear != null && cursorYear <= last && (
            <circle
              cx={x(shown.year)}
              cy={y(shown.end_balance)}
              r="3.5"
              fill="#004EA2"
            />
          )}
          {hoverYear != null && (
            <g pointerEvents="none">
              <line
                x1={x(hoverYear)}
                x2={x(hoverYear)}
                y1="18"
                y2="173"
                stroke="#004EA2"
                strokeDasharray="3 3"
              />
              {other && (
                <circle
                  cx={x(other.year)}
                  cy={y(other.end_balance)}
                  r="4"
                  fill="#B38944"
                  stroke="white"
                  strokeWidth="2"
                />
              )}
              {active && (
                <circle
                  cx={x(active.year)}
                  cy={y(active.end_balance)}
                  r="5"
                  fill="#004EA2"
                  stroke="white"
                  strokeWidth="2"
                />
              )}
            </g>
          )}
          <rect
            x="42"
            y="18"
            width="510"
            height="155"
            fill="transparent"
            onPointerMove={selectYear}
            onPointerDown={selectYear}
          />
          {[first, Math.round((first + last) / 2), last].map((v) => (
            <text key={v} x={x(v) - 12} y="196">
              {v}
            </text>
          ))}
        </svg>
        {hoverYear != null && (
          <div
            id={`${id}-tooltip`}
            role="tooltip"
            className={`chart-tooltip ${hoverYear < (first + last) / 2 ? "tooltip-right" : "tooltip-left"}`}
          >
            <header>
              <b>{hoverYear}년</b>
              <span>
                {active?.child_age != null
                  ? `자녀 ${active.child_age}세`
                  : active?.parent_age != null
                    ? `부모 기준 ${active.parent_age}세`
                    : ""}
              </span>
            </header>
            <div>
              <span className="legend-dot" />
              {label}
              <strong>
                {active
                  ? `${active.end_balance.toLocaleString("ko-KR")}원`
                  : "해당 연도 경로 없음"}
              </strong>
            </div>
            <div>
              <span className="legend-dot other" />
              {otherLabel}
              <strong>
                {other
                  ? `${other.end_balance.toLocaleString("ko-KR")}원`
                  : "해당 연도 경로 없음"}
              </strong>
            </div>
            {active && (
              <footer>
                연간 유입 {money(active.inflows)} · 유출{" "}
                {money(active.outflows)}
                {active.shortfall != null && active.shortfall > 0
                  ? ` · 부족 ${money(active.shortfall)}`
                  : ""}
              </footer>
            )}
          </div>
        )}
      </div>
      <div className="chart-legend">
        <span>
          <i />
          {label}
        </span>
        <span>
          <i className="other" />
          {otherLabel}
        </span>
        <small>연말 잔액</small>
      </div>
      <p className="chart-hint" id={`${id}-help`}>
        마우스·터치로 연도 확인 · 키보드 ← →
      </p>
      <details open>
        <summary>{title} 연도별 수치 보기</summary>
        <div className="timeline-table">
          <table>
            <thead>
              <tr>
                <th>연도 / 나이</th>
                <th>연초</th>
                <th>유입</th>
                <th>유출</th>
                <th>급여*</th>
                <th>수익</th>
                <th>연말</th>
                <th>부족</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.year}>
                  <th>
                    {r.year} / {r.child_age ?? r.parent_age}세
                    {r.benefit_regime === "old_age" && r.child_age === 65
                      ? " 전환"
                      : ""}
                  </th>
                  {[
                    r.start_balance,
                    r.inflows,
                    r.outflows,
                    r.benefits,
                    r.interest,
                    r.end_balance,
                    r.shortfall ?? null,
                  ].map((v, i) => (
                    <td key={i}>
                      {v == null ? "—" : v.toLocaleString("ko-KR")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fine">
          금액: 원. * 자녀 급여는 별도 생활비 재원으로 신탁 유입에 더하지 않음.
          부모 급여는 유입에 포함. 자녀 생전 적립기의 급여는 소비에 사용하며 이
          경로의 계산 범위 밖.
        </p>
      </details>
    </div>
  );
}
