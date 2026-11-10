import React, { useEffect, useState } from "react";
import { Chart, money } from "./Chart.tsx";
import type { Result } from "./simulation.ts";

const names = { B: "B · 단계 적립", B_PRIME: "B′ · 사후 보충" };
const milestones = [
  [2031, "정년"],
  [2036, "국민연금"],
  [2062, "부모 사후"],
  [2071, "65세 전환"],
] as const;

export function SimulationPaths({
  result,
  comparison,
  baseline,
  changed,
  motionDisabled = false,
}: {
  result: Result;
  comparison: Result | null;
  baseline: Result | null;
  changed: boolean;
  motionDisabled?: boolean;
}) {
  const first = result.parent_timeline[0]?.year ?? 2026;
  const last = result.child_timeline.at(-1)?.year ?? first;
  const [year, setYear] = useState(last);
  const [playing, setPlaying] = useState(false);
  const [playbackRun, setPlaybackRun] = useState(0);
  const [systemReduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const reduced = motionDisabled || systemReduced;
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReduced(media.matches);
      if (media.matches) {
        setPlaying(false);
        setYear(last);
      }
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [last]);
  useEffect(() => {
    setYear(reduced ? last : first);
    setPlaying(!reduced);
    setPlaybackRun((value) => value + 1);
  }, [result, first, last, reduced]);
  useEffect(() => {
    if (!playing) return;
    let handle = 0;
    let previous: number | undefined;
    let cursor = year;
    const tick = (now: number) => {
      if (previous != null)
        cursor = Math.min(
          last,
          cursor + ((now - previous) * (last - first)) / 5000,
        );
      previous = now;
      setYear(cursor);
      if (cursor < last) handle = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
    // The playback starts at the captured year; updating each frame must not restart it.
  }, [playing, playbackRun, first, last]);
  const other = changed ? baseline : comparison;
  const otherLabel = changed
    ? `기준 사례 · ${names[result.strategy]}`
    : names[result.strategy === "B" ? "B_PRIME" : "B"];
  const need = result.summary.required_trust_at_56;
  const coverage =
    need == null
      ? null
      : need === 0
        ? null
        : result.summary.projected_trust_at_56 / need;
  const years = result.child_timeline.filter(
    (row) => (row.child_age ?? 0) >= 56,
  );
  return (
    <>
      <div className="simulation-player" aria-label="자금 경로 재생">
        <button
          className="play-button"
          disabled={reduced}
          aria-label={playing ? "경로 일시정지" : "경로 재생"}
          aria-pressed={playing}
          onClick={() => {
            if (year >= last) setYear(first);
            setPlaying(!playing);
          }}
        >
          <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>
          {reduced
            ? "재생 꺼짐"
            : playing
              ? "일시정지"
              : year >= last
                ? "다시 재생"
                : "재생"}
        </button>
        <div className="playback-year">
          <strong>{Math.floor(year)}</strong>
          <small>{year >= last ? "전체 경로" : "연도별 재생"}</small>
        </div>
        <input
          aria-label="경로 재생 연도"
          type="range"
          min={first}
          max={last}
          step="1"
          value={Math.floor(year)}
          onChange={(e) => {
            setPlaying(false);
            setYear(Number(e.target.value));
          }}
        />
        <button
          className="show-all"
          onClick={() => {
            setPlaying(false);
            setYear(last);
          }}
        >
          전체 보기
        </button>
      </div>
      <div className="milestone-track" aria-label="주요 시점">
        {milestones.map(([value, label]) => (
          <button
            key={value}
            disabled={value > last}
            aria-pressed={Math.floor(year) === value}
            onClick={() => {
              setPlaying(false);
              setYear(value);
            }}
          >
            <small>{value}</small>
            <b>{label}</b>
          </button>
        ))}
      </div>
      <div className="path-grid">
        <Chart
          title="부모 금융자산"
          rows={result.parent_timeline}
          otherRows={other?.parent_timeline ?? []}
          label={names[result.strategy]}
          otherLabel={otherLabel}
          cursorYear={year}
        />
        <Chart
          title="자녀 신탁 잔액"
          rows={result.child_timeline}
          otherRows={other?.child_timeline ?? []}
          label={names[result.strategy]}
          otherLabel={otherLabel}
          cursorYear={year}
        />
      </div>
      <div className="plan-overview" aria-label="계획 한눈에 보기">
        <article>
          <small>자녀 · 필요액 대비 예상 잔액</small>
          <strong>
            {coverage == null
              ? need === 0
                ? "필요액 0원"
                : "계산 미지원"
              : `${Math.round(coverage * 100)}%`}
          </strong>
          <svg
            viewBox="0 0 200 10"
            role="img"
            aria-label={`필요 잔액 ${money(need)}, 예상 잔액 ${money(result.summary.projected_trust_at_56)}`}
          >
            <rect width="200" height="10" rx="5" fill="#eef4fb" />
            <rect
              width={
                coverage == null ? 0 : Math.max(0, Math.min(1, coverage)) * 200
              }
              height="10"
              rx="5"
              fill={coverage != null && coverage < 1 ? "#B38944" : "#004EA2"}
            />
          </svg>
          <p>
            필요 {money(need)} / 예상{" "}
            {money(result.summary.projected_trust_at_56)}
          </p>
        </article>
        <article
          className={result.summary.parent_feasible ? "" : "plan-warning"}
        >
          <small>부모 · 금융자산 최저</small>
          <strong>{money(result.summary.parent_asset_min)}</strong>
          <p>
            {result.summary.parent_feasible
              ? "전 기간 금융자산 0원 이상"
              : `${result.summary.parent_first_negative_year}년부터 음수 · 재원 재검토`}
          </p>
        </article>
        <article>
          <small>자녀 · 생활비 부족 연도</small>
          <strong>
            {result.summary.child_shortfall_years.length}
            <em> / {years.length}년</em>
          </strong>
          <div className="year-heatmap" aria-label="연도별 생활비 부족 여부">
            {years.map((r) => (
              <span
                key={r.year}
                className={(r.shortfall ?? 0) > 0 ? "shortfall" : ""}
                title={`${r.year}년 · ${r.child_age}세 · 부족 ${money(r.shortfall ?? 0)}`}
              />
            ))}
          </div>
          <p>
            <i className="heatmap-dot" />
            충당 <i className="heatmap-dot shortfall" />
            부족 · 상세는 그래프 툴팁
          </p>
        </article>
      </div>
      {need == null && (
        <p className="error">
          필요 잔액 계산 미지원 · 월 인출 한도와 0~15억 원 탐색 범위에서 유효한
          잔액을 찾지 못했습니다.
        </p>
      )}
      {changed && baseline && (
        <details className="baseline-summary">
          <summary>기준 사례 수치 비교</summary>
          <p>
            필요 잔액 {money(baseline.summary.required_trust_at_56)} · 자녀
            부족액 {money(baseline.summary.child_shortfall_total)} · 부모 최저{" "}
            {money(baseline.summary.parent_asset_min)} (95세 목표)
          </p>
        </details>
      )}
    </>
  );
}
