import React from "react";
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
}: {
  title: string;
  rows: Row[];
  otherRows: Row[];
  label: string;
  otherLabel: string;
}) {
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
  return (
    <div className="real-chart">
      <h3>{title}</h3>
      <svg
        viewBox="0 0 570 210"
        role="img"
        aria-label={`${title} 연도별 경로. ${label} 실선, ${otherLabel} 점선. 상세 값은 아래 연도별 표 참조.`}
      >
        {[0, 0.5, 1].map((p) => (
          <g key={p}>
            <line
              x1="42"
              x2="552"
              y1={18 + p * 155}
              y2={18 + p * 155}
              stroke="#e3e9df"
            />
            <text x="0" y={22 + p * 155}>
              {((max - p * range) / 1e8).toFixed(1)}억
            </text>
          </g>
        ))}
        <line x1="42" x2="552" y1={y(0)} y2={y(0)} stroke="#a8b6a2" />
        {[2031, 2036, 2062, 2071]
          .filter((v) => v >= first && v <= last)
          .map((v) => (
            <line
              key={v}
              x1={x(v)}
              x2={x(v)}
              y1="18"
              y2="173"
              stroke="#d9dfd2"
              strokeDasharray="3 4"
            />
          ))}
        <polyline
          points={points(otherRows)}
          fill="none"
          stroke="#a99773"
          strokeWidth="2"
          strokeDasharray="5 4"
        />
        <polyline
          points={points(rows)}
          fill="none"
          stroke="#315b45"
          strokeWidth="2.5"
        />
        {[first, Math.round((first + last) / 2), last].map((v) => (
          <text key={v} x={x(v) - 12} y="196">
            {v}
          </text>
        ))}
      </svg>
      <p className="fine">
        ━ {label}　┄ {otherLabel} · 연말 잔액 · 가정 기반 직접 계산
      </p>
      <details>
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
