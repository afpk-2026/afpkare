import React, { useState } from "react";
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
  const [hidden, setHidden] = useState(hasSeenGuide);
  const [step, setStep] = useState(0);
  const [monthly, setMonthly] = useState("185");
  const [baseline, setBaseline] = useState<Result | null>(null);
  const [trial, setTrial] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function finish() {
    setHidden(true);
    try {
      localStorage.setItem(guideKey, "1");
    } catch {}
  }

  async function calculate() {
    setLoading(true);
    setError("");
    try {
      if (step === 0) {
        setBaseline(
          await requestSimulation(reference, reference.defaults, "B"),
        );
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
        setTrial(
          await requestSimulation(
            reference,
            { ...reference.defaults, monthly_child_cost: amount },
            "B",
          ),
        );
        setStep(2);
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "계산을 완료하지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (hidden)
    return (
      <button
        className="text-button"
        onClick={() => {
          setStep(0);
          setError("");
          setHidden(false);
        }}
      >
        처음 사용 가이드 다시 보기
      </button>
    );

  const difference =
    baseline?.summary.required_trust_at_56 != null &&
    trial?.summary.required_trust_at_56 != null
      ? trial.summary.required_trust_at_56 -
        baseline.summary.required_trust_at_56
      : null;

  return (
    <section
      className="card guided-trial"
      aria-label="처음 사용 가이드"
      aria-busy={loading}
    >
      <div className="section-title">
        <h2>생활비를 바꿔 보며 시작하세요</h2>
        <button disabled={loading} onClick={finish}>
          건너뛰기
        </button>
      </div>
      <ol className="guide-progress" aria-label="체험 단계">
        {["예시 사례 열기", "생활비 바꾸기", "결과 차이 확인"].map(
          (label, index) => (
            <li key={label} aria-current={step === index ? "step" : undefined}>
              {label}
            </li>
          ),
        )}
      </ol>
      {step === 0 && (
        <>
          <p>
            지훈 씨 가족의 월 생활비 180만 원, 95세까지 준비하는 B 단계 적립
            사례로 시작합니다.
          </p>
          <button
            className="primary"
            disabled={loading || disabled}
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
          <div className="report-stat-row" role="status">
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
            disabled={disabled || loading}
            className="primary"
            onClick={async () => {
              setLoading(true);
              try {
                if (await onApply(trial.effective_inputs)) finish();
                else
                  setError("가정을 적용하지 못했습니다. 다시 시도해 주세요.");
              } finally {
                setLoading(false);
              }
            }}
          >
            이 가정으로 계속하기
          </button>{" "}
          <button
            disabled={loading}
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
  );
}
