import React, { useEffect, useId, useRef, useState } from "react";
import {
  requestSimulation,
  type Reference,
  type Result,
} from "./simulation.ts";
import { money } from "./Chart.tsx";
import type { Inputs } from "./storage.ts";
import { fromDisplay } from "./units.ts";

const guideKey = "family-finance:guide-seen";

function hasSeenGuide() {
  try {
    return localStorage.getItem(guideKey) === "1";
  } catch {
    return false;
  }
}

export function GuidedTrial({
  reference,
  disabled,
  onApply,
}: {
  reference: Reference;
  disabled: boolean;
  onApply: (inputs: Inputs) => Promise<boolean>;
}) {
  const [dim, setDim] = useState(() => !hasSeenGuide());
  const [view, setView] = useState<"trial" | "shortcuts" | "idle">(
    dim ? "trial" : "idle",
  );
  const card = useRef<HTMLElement>(null);
  const shortcuts = useRef<HTMLElement>(null);
  const returnFocus = useRef(false);
  const request = useRef<AbortController | null>(null);
  const titleId = useId();
  const shortcutsTitleId = useId();
  const [step, setStep] = useState(0);
  const [monthly, setMonthly] = useState("185");
  const [baseline, setBaseline] = useState<Result | null>(null);
  const [trial, setTrial] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [applying, setApplying] = useState(false);

  useEffect(() => () => request.current?.abort(), []);

  useEffect(() => {
    if (returnFocus.current) {
      returnFocus.current = false;
      card.current?.querySelector("h2")?.focus({ preventScroll: true });
      return;
    }
    if (view === "idle" && step === 0) return;
    if (!disabled || view === "shortcuts") {
      const panel = view === "shortcuts" ? shortcuts.current : card.current;
      const target = panel?.querySelector<HTMLElement>("[data-guide-focus]");
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "nearest" });
    }
  }, [view, step, disabled]);

  function finish(
    nextView: "shortcuts" | "idle" = "idle",
    restoreFocus = true,
  ) {
    request.current?.abort();
    setLoading(false);
    returnFocus.current = nextView === "idle" && restoreFocus;
    setView(nextView);
    if (nextView === "idle") setDim(false);
    try {
      localStorage.setItem(guideKey, "1");
    } catch {}
  }

  async function calculate() {
    if (loading || disabled) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      if (step === 0) {
        const result = await requestSimulation(
          reference,
          reference.defaults,
          "B",
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setBaseline(result);
        setStep(1);
      } else {
        const amount = fromDisplay("monthly_child_cost", monthly);
        const field = reference.fields.monthly_child_cost;
        if (
          !Number.isFinite(amount) ||
          amount < field.min ||
          amount > field.max
        )
          throw new Error(
            "생활비는 월 0~1,000만 원 범위에서 원 단위까지 입력하세요.",
          );
        const result = await requestSimulation(
          reference,
          { ...reference.defaults, monthly_child_cost: amount },
          "B",
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setTrial(result);
        setStep(2);
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setError(
        error instanceof Error ? error.message : "계산을 완료하지 못했습니다.",
      );
    } finally {
      if (request.current === controller) {
        request.current = null;
        setLoading(false);
      }
    }
  }

  const difference =
    baseline?.summary.required_trust_at_56 != null &&
    trial?.summary.required_trust_at_56 != null
      ? trial.summary.required_trust_at_56 -
        baseline.summary.required_trust_at_56
      : null;

  return (
    <>
      <section
        ref={card}
        className={
          dim && view === "trial"
            ? "card guided-trial guide-spotlight"
            : "card guided-trial"
        }
        aria-labelledby={titleId}
        aria-busy={loading || applying}
        onKeyDown={(event) => {
          if (event.key === "Escape" && view === "trial" && !applying) {
            event.stopPropagation();
            finish();
          }
        }}
      >
        <div className="section-title">
          <h2 id={titleId} tabIndex={-1}>
            처음이신가요?
          </h2>
          {view === "trial" && (
            <button disabled={applying} onClick={() => finish()}>
              건너뛰기
            </button>
          )}
        </div>
        <ol className="guide-progress" aria-label="체험 단계">
          {["예시 사례 열기", "생활비 바꾸기", "결과 차이 확인"].map(
            (label, index) => (
              <li
                key={label}
                aria-current={step === index ? "step" : undefined}
              >
                {label}
              </li>
            ),
          )}
        </ol>
        {step === 0 && (
          <>
            <p>
              아래 버튼을 눌러 지훈 씨 가족의 예시를 열어 보세요. 월 생활비를
              바꾸면 필요한 자금이 얼마나 달라지는지 확인할 수 있어요.
            </p>
            <button
              className="primary"
              disabled={loading || disabled}
              data-guide-focus
              onClick={() => void calculate()}
            >
              {loading ? "사례 불러오는 중…" : "예시 사례 열기"}
            </button>
          </>
        )}
        {step === 1 && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void calculate();
            }}
          >
            <label>
              부모 사후 월 생활비 (만 원)
              <input
                type="number"
                data-guide-focus
                min="0"
                max="1000"
                step="0.0001"
                required
                value={monthly}
                onChange={(event) => setMonthly(event.target.value)}
              />
            </label>
            <p>
              기준 생활비는 180만 원입니다. 185만 원으로 늘리면 필요한 자금은
              얼마나 달라질까요?
            </p>
            <button className="primary" disabled={loading || disabled}>
              {loading ? "계산 중…" : "결과 차이 확인"}
            </button>
          </form>
        )}
        {step === 2 && baseline && trial && (
          <>
            <h3 tabIndex={-1} data-guide-focus>
              생활비를 바꾼 결과
            </h3>
            <div className="report-stat-row">
              <div>
                <span>기준 필요 자금</span>
                <strong>{money(baseline.summary.required_trust_at_56)}</strong>
              </div>
              <div>
                <span>
                  월 생활비 {money(trial.effective_inputs.monthly_child_cost)}일
                  때
                </span>
                <strong>{money(trial.summary.required_trust_at_56)}</strong>
              </div>
              <div>
                <span>필요 자금 변화</span>
                <strong>
                  {difference == null
                    ? "계산 범위 초과"
                    : difference === 0
                      ? "차이 없음"
                      : `${money(Math.abs(difference))} ${difference > 0 ? "증가" : "감소"}`}
                </strong>
              </div>
            </div>
            <p>
              56세에 필요한 신탁 잔액을 비교했습니다. 이 가정을 적용하면 자금
              경로와 보고서에서도 결과를 확인할 수 있습니다.
            </p>
            <button
              disabled={disabled || applying}
              className="primary"
              onClick={async () => {
                setApplying(true);
                try {
                  if (await onApply(trial.effective_inputs))
                    finish("shortcuts");
                  else
                    setError("가정을 적용하지 못했습니다. 다시 시도해 주세요.");
                } finally {
                  setApplying(false);
                }
              }}
            >
              {applying ? "적용 중…" : "이 가정으로 계속하기"}
            </button>{" "}
            <button
              disabled={applying}
              onClick={() => {
                setStep(1);
                setError("");
              }}
            >
              생활비 다시 바꾸기
            </button>
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </section>
      <section
        ref={shortcuts}
        className={
          view === "shortcuts"
            ? `card guide-shortcuts${dim ? " guide-spotlight" : ""}`
            : undefined
        }
        aria-labelledby={view === "shortcuts" ? shortcutsTitleId : undefined}
        onKeyDown={(event) => {
          if (view === "shortcuts" && event.key === "Escape") {
            event.stopPropagation();
            finish();
          }
        }}
      >
        {view === "shortcuts" && (
          <>
            <div className="section-title">
              <h2 id={shortcutsTitleId} tabIndex={-1} data-guide-focus>
                다른 기능 둘러보기
              </h2>
              <button type="button" onClick={() => finish()}>
                가이드 마치기
              </button>
            </div>
            <p>관심 있는 기능을 골라 바로 이동할 수 있어요.</p>
          </>
        )}
        <nav className="consumer-links" aria-label="다음으로 살펴보기">
          {[
            [
              "#events",
              "상황별 사례로 시작",
              "생활비 변화나 은퇴 등 우리 가족과 비슷한 상황을 살펴보세요.",
              "01",
            ],
            [
              "#report",
              "보고서 결과 비교",
              "저장한 사례를 골라 진단과 준비 방법을 비교해 보세요.",
              "02",
            ],
            [
              "#trusts",
              "목적에 맞는 신탁 찾기",
              "돌봄과 생활비 준비에 필요한 상품과 공식 자료를 찾아보세요.",
              "03",
            ],
          ].map(([href, title, description, number]) => (
            <a
              href={href}
              key={href}
              onClick={
                view === "shortcuts" ? () => finish("idle", false) : undefined
              }
            >
              <span className="consumer-link-number" aria-hidden="true">
                {number}
              </span>
              <strong>{title}</strong>
              <span className="consumer-link-description">{description}</span>
              <span className="consumer-link-arrow" aria-hidden="true">
                ↗
              </span>
            </a>
          ))}
        </nav>
      </section>
    </>
  );
}
