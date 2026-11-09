import React from "react";
import { StepTitle } from "./StepTitle.tsx";

// Current arithmetic.md §§3, 7, 8. Section 6 documents an older model and is not shown.
export function FormulaReference() {
  return (
    <aside className="evidence formula-reference" aria-label="계산 산식">
      <section className="card" id="formula-panel">
        <p className="eyebrow">HOW IT IS CALCULATED</p>
        <StepTitle step="06">계산 산식</StepTitle>
        <p className="fine">보고서 v1.5 · 2026년 실질 가격 · 금액 단위 원</p>
        <article>
          <span className="formula-index">식 1</span>
          <h3>자녀 신탁의 연간 변화</h3>
          <p className="equation">want = max(0, N − Y − B)</p>
          <p className="equation">w = min(want, 1,500,000, ⌊F / 12⌋)</p>
          <p className="equation">
            F<sub>다음 해</sub> = trunc(max(0, F − 12w) × (1 + r))
          </p>
          <p className="formula-caption">
            연초 잔액으로 급여 판정 → 12개월 인출 → 연말 수익
          </p>
          <dl className="formula-terms">
            <div>
              <dt>F</dt>
              <dd>연초 신탁 잔액</dd>
            </div>
            <div>
              <dt>N</dt>
              <dd>월 생활비</dd>
            </div>
            <div>
              <dt>Y</dt>
              <dd>월 유족연금</dd>
            </div>
            <div>
              <dt>B</dt>
              <dd>월 공적급여</dd>
            </div>
            <div>
              <dt>w</dt>
              <dd>월 신탁 인출</dd>
            </div>
            <div>
              <dt>r</dt>
              <dd>순실질수익률</dd>
            </div>
          </dl>
        </article>
        <article>
          <span className="formula-index">식 2</span>
          <h3>최소 필요 잔액</h3>
          <p className="equation">min F ∈ {"{0, 500만, …, 15억}"}</p>
          <p className="equation">모든 해에 N − Y − B(F) − w ≤ 0</p>
          <p className="formula-caption">
            56세부터 종료 나이까지 양 끝 포함. 500만 원 간격으로 순서대로
            검사합니다.
          </p>
        </article>
        <article>
          <span className="formula-index">식 3</span>
          <h3>부모 금융자산</h3>
          <p className="equation">
            W<sub>다음 해</sub> = trunc(W × (1 + r) + 연간 수입 − 연간 지출)
          </p>
          <dl className="formula-terms">
            <div>
              <dt>수입</dt>
              <dd>근로·재취업·퇴직급여·국민/유족연금·주택연금</dd>
            </div>
            <div>
              <dt>지출</dt>
              <dd>소비·장애 추가비·대출 상환·보험·신탁 납입</dd>
            </div>
            <div>
              <dt>W</dt>
              <dd>부모 금융자산</dd>
            </div>
          </dl>
        </article>
        <article>
          <span className="formula-index">급여</span>
          <h3>소득인정액</h3>
          <p className="equation">
            I<sub>장</sub> = Y + ⌊max(0, F − 2천만) × 0.04 / 12⌋
          </p>
          <p className="equation">
            I<sub>기</sub> = Y + G + max(0, F − 8,500만) × 0.0626
          </p>
          <p className="formula-caption">
            G: 65세 이후 월 기초연금. 해 초 신탁 잔액 F를 사용하며 65세 해에
            급여 모형을 전환합니다.
          </p>
        </article>
        <article>
          <span className="formula-index">식 4</span>
          <h3>보고서 대안 비용·후회</h3>
          <p className="equation">
            cost(a, s) = 3 × 평생 부족액 + 잃는 공적급여
          </p>
          <p className="equation">
            regret(a, s) = cost(a, s) − min cost(대안, s)
          </p>
          <p className="equation">
            최대 후회(a) = max<sub>s</sub> regret(a, s)
          </p>
          <p className="formula-caption">
            a: 전략 · s: 사건. 사건별 후회의 최댓값을 비교하는 보고서 식입니다.
          </p>
        </article>
        <p className="formula-footnote">trunc: 0 방향 정수 절사 · ⌊ ⌋: 내림</p>
      </section>
    </aside>
  );
}
