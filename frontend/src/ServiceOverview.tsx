import React, { useEffect, useRef, useState } from "react";
import baseline from "./report-baseline.json";
import { money } from "./Chart.tsx";

const strategies = [
  {
    title: "B · 단계 적립",
    color: "#65c4ff",
  },
  {
    title: "B′ · 사후 보충",
    color: "#ffcb7b",
  },
];
const steps = [
  {
    title: "생활비 가정 바꾸기",
    description:
      "오른쪽 ‘전략과 가정’에서 입력을 바꿔 보세요. 예를 들어 부모 사후 월 생활비를 180만 원에서 185만 원으로 바꾸고 ‘변경 적용’을 누릅니다.",
    image: "edit.webp",
    alt: "가정 편집 화면의 부모 사후 월 생활비 입력과 변경 적용 버튼",
  },
  {
    title: "저장한 사례 다시 비교하기",
    description:
      "오른쪽 슬롯을 선택하고 시뮬레이터 본문의 ‘사례 슬롯 관리’에서 ‘현재 적용값 저장’을 누릅니다. 저장한 슬롯을 누르면 해당 가정이 적용됩니다. ‘보고서 진단과 대안’에서 현재 가정 및 저장 슬롯 보기로 바꾸면 B와 B′의 부족액을 비교할 수 있습니다.",
    image: "compare.webp",
    alt: "보고서 대안 비교 표와 오른쪽 A, B, C, D 사례 슬롯",
  },
  {
    title: "공식 문서에서 답 찾기",
    description:
      "‘은행과 신탁 상품’에서 상품 이름을 누르면 원문이 열립니다. ‘AI 설명’을 누르면 공식 자료 요약과 출처 링크를 함께 볼 수 있습니다.",
    image: "sources.webp",
    alt: "신탁 자료 목록과 공식 출처를 제시하는 AI 도우미",
  },
];

const preparation = [
  ["보호자 사후에 대한 막막함을 가장 큰 어려움으로 응답", 34.9],
  ["집이나 재산을 마련했거나 모으는 중", 8.9],
  ["가족 사망에 대비해 다른 보호자를 정함", 2.7],
] as const;

const protections = [
  [
    "공공기관 개인정보 영향평가",
    "공공기관 도입 시 영향평가 적용 여부와 필요한 절차를 검토할 항목입니다. 현재 데모는 영향평가를 완료하지 않았습니다.",
  ],
  [
    "보안",
    "운영 환경의 로그인은 HTTPS를 사용하며, 계산 기능은 로그인 없이 이용할 수 있습니다.",
  ],
  [
    "익명정보 처리",
    "시뮬레이터는 가상의 가족과 수치를 사용합니다. 입력한 사례를 익명정보로 변환하는 별도 절차는 제공하지 않습니다.",
  ],
  [
    "민감정보 보호",
    "실명·연락처·계좌번호·건강정보 대신 가상의 금액과 나이를 입력하세요. 기본 검색은 자료 식별자만 서버에 보냅니다. AI 의미 검색을 선택하면 검색어를 Upstage에 보냅니다.",
  ],
  [
    "운영통제 및 공공기준",
    "개인 계정으로 로그인할 수 있고, 세션은 로그아웃하거나 유효기간이 지나면 종료됩니다. 공공 도입 기준 충족 여부는 별도 검토 대상입니다.",
  ],
];

const accessibility = [
  [
    "스크린리더",
    "메뉴를 옮길 때 화면 제목으로 초점을 이동하는 화면 읽기 안내를 켤 수 있습니다.",
  ],
  ["고대비", "텍스트와 카드 경계를 더 뚜렷하게 표시합니다."],
  ["색약 모드", "그래프 선 모양과 상태 패턴을 함께 표시합니다."],
  ["애니메이션 끄기", "그래프 자동 재생과 부드러운 스크롤을 줄입니다."],
  ["글자 크기 조정", "기본·크게·아주 크게 중에서 선택할 수 있습니다."],
];

export function LandingPreview() {
  const x = (age: number) => 54 + ((age - 56) / 39) * 490;
  const y = (balance: number) => 232 - (balance / 200_000_000) * 200;
  return (
    <figure className="landing-demo">
      <figcaption>
        <span>보고서 기준 사례</span>
        <strong>부모 사후 신탁 경로</strong>
      </figcaption>
      <div className="landing-demo-legend" aria-label="전략 범례">
        {strategies.map((strategy, index) => (
          <span key={strategy.title}>
            <i
              style={{
                borderColor: strategy.color,
                borderTopStyle: index ? "dashed" : "solid",
              }}
            />
            {strategy.title}
          </span>
        ))}
      </div>
      <svg
        viewBox="0 0 580 270"
        role="img"
        aria-label="56세에서 95세까지의 기준 사례 신탁 잔액 경로"
      >
        {[0, 50_000_000, 100_000_000, 150_000_000, 200_000_000].map((value) => (
          <g key={value}>
            <line
              x1="54"
              x2="544"
              y1={y(value)}
              y2={y(value)}
              stroke="#345673"
            />
            <text
              x="46"
              y={y(value) + 4}
              textAnchor="end"
              fill="#dcecff"
              fontSize="12"
            >
              {value / 100_000_000}억
            </text>
          </g>
        ))}
        {baseline.trust.map((item, index) => (
          <polyline
            key={item.strategy}
            points={item.withdrawal
              .map(([age, balance]) => `${x(age)},${y(balance)}`)
              .join(" ")}
            fill="none"
            stroke={strategies[index].color}
            strokeWidth={3}
            strokeDasharray={index ? "6 4" : undefined}
          />
        ))}
        {[56, 65, 83, 95].map((age) => (
          <text
            key={age}
            x={x(age)}
            y="255"
            textAnchor="middle"
            fill="#dcecff"
            fontSize="13"
          >
            {age}세
          </text>
        ))}
      </svg>
      <p>
        보고서 기준 가정에서 두 전략의 신탁 잔액이 어떻게 달라지는지 보여줍니다.
      </p>
      <ol
        className="landing-fund-flow"
        aria-label="신탁 준비와 생활비 지급 흐름"
      >
        <li>
          <span>부모 생전</span>
          <strong>적립</strong>
          <small>자녀를 위한 자금 준비</small>
        </li>
        <li>
          <span>56세부터</span>
          <strong>생활비 지급</strong>
          <small>연금·급여와 신탁 인출</small>
        </li>
        <li>
          <span>65세부터</span>
          <strong>급여 전환</strong>
          <small>바뀐 급여에 맞춰 인출</small>
        </li>
      </ol>
    </figure>
  );
}

const livingCostExamples = [
  { monthly: 180, required: 175_000_000, shortage: 0 },
  { monthly: 185, required: 195_000_000, shortage: 16_030_692 },
];

function LivingCostPreview() {
  const [selected, setSelected] = useState(0);
  const example = livingCostExamples[selected];

  return (
    <div className="landing-impact">
      <div>
        <h3>월 생활비를 골라 보세요</h3>
        <p>두 예시 모두 B안 · 연 순실질수익률 1% · 95세까지</p>
        <div
          className="landing-impact-options"
          role="group"
          aria-label="월 생활비 예시"
        >
          {livingCostExamples.map(({ monthly }, index) => (
            <button
              key={monthly}
              type="button"
              aria-pressed={selected === index}
              onClick={() => setSelected(index)}
            >
              월 {monthly}만 원
            </button>
          ))}
        </div>
      </div>
      <dl aria-live="polite" className="landing-impact-results">
        <div>
          <dt>56세 필요 잔액</dt>
          <dd>{money(example.required)}</dd>
        </div>
        <div>
          <dt>자녀 평생 생활비 부족액</dt>
          <dd>
            {example.shortage > 0 && "약 "}
            {money(example.shortage)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

const checkpoints = [
  [
    "부모가 일하는 동안",
    "노후 생활비를 남기면서 자녀를 위해 얼마를 적립할 수 있을까요?",
    "부모 금융자산 그래프에서 정년 전후의 연도별 잔액을 확인하세요.",
  ],
  [
    "부모가 떠난 뒤",
    "적립금과 유족연금으로 자녀의 생활비를 얼마나 오래 충당할 수 있을까요?",
    "B의 단계 적립과 B′의 사후 보충을 비교하고, 신탁 인출로도 부족한 해가 있는지 살펴보세요.",
  ],
  [
    "자녀가 65세가 되는 해",
    "급여가 바뀌면 신탁에서 매달 꺼내야 하는 금액은 어떻게 달라질까요?",
    "급여 문턱 그래프에서 65세 전후를 나눠 보고, 실제 적용 조건은 상담할 때 확인하세요.",
  ],
];

export function ServiceOverview({ onStart }: { onStart: () => void }) {
  const overview = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!overview.current || typeof IntersectionObserver === "undefined")
      return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const { target, isIntersecting } of entries) {
          if (!isIntersecting) continue;
          target.classList.add("landing-entered");
          observer.unobserve(target);
        }
      },
      { threshold: 0.12 },
    );

    overview.current
      .querySelectorAll(
        ".landing-story-media > figure, .landing-steps > article, .landing-guide-step, " +
          ".landing-safeguards > header, .landing-safeguards dl > div, .landing-evidence-grid > article, " +
          ".landing-checkpoints > article, .landing-impact, .landing-start",
      )
      .forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-overview" ref={overview}>
      <section id="about" className="landing-section landing-story">
        <header className="landing-story-heading">
          <p className="eyebrow">01 / 서비스 배경</p>
          <h2>부모의 노후부터 자녀의 생활까지</h2>
          <p>
            디지털 화면을 이용하기 어렵고 장기 돌봄에 맞는 신탁 상품을 찾기
            힘들면, 부모 사후 누가 재산을 관리하고 생활비를 지급할지 계획하기도
            어려워집니다.
          </p>
        </header>
        <div className="landing-story-media">
          <figure className="landing-story-photo">
            <img
              src="/home/family-planning.webp"
              alt="식탁에서 생활비 계획을 함께 살펴보는 어머니와 성인 자녀"
              loading="lazy"
            />
            <figcaption>
              가족이 함께 생활비 계획을 살펴보는 장면 · AI 생성 이미지
            </figcaption>
          </figure>
          <figure className="landing-preparation">
            <figcaption>
              <strong>부모 사후, 가족이 답한 걱정과 준비</strong>
              <span>2021년 발달장애인 실태조사</span>
            </figcaption>
            <ul>
              {preparation.map(([label, value]) => (
                <li key={label}>
                  <span>{label}</span>
                  <strong>{value}%</strong>
                  <meter min={0} max={100} value={value} aria-hidden="true" />
                </li>
              ))}
            </ul>
            <p>
              서로 다른 문항의 응답 비율입니다. 출처는 보고서 v1.5 그림 1(나),
              보건복지부·한국보건사회연구원(2022) 「2021년 발달장애인 실태조사」
              표 2-226·2-213입니다.
            </p>
          </figure>
        </div>
        <div className="landing-story-outcome">
          <p>
            케어 파트너스는 보고서 속 지훈 씨 가족의 가상 사례로 부모의 노후
            자금과 자녀의 생활비를 함께 계산합니다. 가정을 바꿔 부족 시점을
            비교하고, 가족이나 상담 창구에서 확인할 질문을 정리할 수 있습니다.
          </p>
          <dl className="landing-facts">
            <div>
              <dt>계산 전략</dt>
              <dd>B / B′</dd>
            </div>
            <div>
              <dt>저장 슬롯</dt>
              <dd>A–D</dd>
            </div>
            <div>
              <dt>공식 신탁 자료</dt>
              <dd>8건</dd>
            </div>
          </dl>
        </div>
      </section>
      <section className="landing-section">
        <p className="eyebrow">02 / 케어 파트너스의 차별점</p>
        <h2>같은 가족, 다른 가정. 무엇이 달라질까요?</h2>
        <div className="landing-steps">
          <article>
            <h3>두 세대의 자금 흐름을 함께</h3>
            <p>
              자녀에게 남길 재원을 늘렸을 때 부모의 금융자산이 얼마나 남는지,
              부모 사후에는 자녀가 언제 부족을 겪는지 두 경로에서 확인합니다.
            </p>
          </article>
          <article>
            <h3>월 생활비 5만 원 차이도 비교</h3>
            <p>
              기준 사례와 생활비를 높인 사례를 각각 슬롯에 담아 번갈아 보세요.
              같은 입력을 시뮬레이터와 보고서가 공유하므로 숫자가 바뀐 이유를
              따라가기 쉽습니다.
            </p>
          </article>
          <article>
            <h3>계산에서 원문까지</h3>
            <p>
              보고서 숫자는 계산산식에서, 신탁 상품 설명은 은행의 공식 자료에서
              근거를 확인할 수 있습니다.
            </p>
          </article>
        </div>
      </section>
      <section id="workflow" className="landing-section landing-guide">
        <p className="eyebrow">03 / 화면으로 보는 사용 가이드</p>
        <h2>어떻게 사용할 수 있나요?</h2>
        <p>지훈 씨 가족의 가상 사례에서 아래 순서대로 따라해 보세요.</p>
        {steps.map(({ title, description, image, alt }, index) => (
          <article className="landing-guide-step" key={image}>
            <div>
              <span className="landing-step-number">0{index + 1}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
            <figure>
              <a
                href={`/guide/${image}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`${title} 화면 크게 보기 (새 창)`}
              >
                <img src={`/guide/${image}`} alt={alt} loading="lazy" />
              </a>
              <figcaption>실제 서비스 화면 · 선택하면 확대</figcaption>
            </figure>
          </article>
        ))}
      </section>
      <section id="checkpoints" className="landing-section">
        <p className="eyebrow">04 / 가상 가족의 타임라인</p>
        <h2>가족의 자금 흐름이 바뀌는 세 시점</h2>
        <div className="landing-checkpoints">
          {checkpoints.map(([title, question, detail], index) => (
            <article key={title}>
              <span className="landing-step-number" aria-hidden="true">
                0{index + 1}
              </span>
              <h3>{title}</h3>
              <p>
                <strong>{question}</strong>
              </p>
              <p>{detail}</p>
            </article>
          ))}
        </div>
      </section>
      <section id="privacy" className="landing-section landing-safeguards">
        <header>
          <p className="eyebrow">05 / 개인정보 보호</p>
          <h2>개인정보를 보호하는 방법</h2>
          <p>
            가상 사례를 중심으로 서비스에 필요한 정보만 처리합니다. 현재 보호
            조치와 공공 도입 시 검토할 항목을 확인하세요.
          </p>
        </header>
        <dl>
          {protections.map(([title, detail]) => (
            <div key={title}>
              <dt>{title}</dt>
              <dd>{detail}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section
        id="accessibility"
        className="landing-section landing-safeguards"
      >
        <header>
          <p className="eyebrow">06 / 접근성</p>
          <h2>읽고 쓰기 편한 화면</h2>
          <p>왼쪽 메뉴의 ‘환경설정’에서 화면을 나에게 맞춰 보세요.</p>
        </header>
        <dl>
          {accessibility.map(([title, detail]) => (
            <div key={title}>
              <dt>{title}</dt>
              <dd>{detail}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section id="evidence" className="landing-section">
        <p className="eyebrow">07 / 자료와 계산 근거</p>
        <h2>결과가 어디에서 나왔는지 확인하세요</h2>
        <div className="landing-evidence-grid">
          <article>
            <h3>사례와 산식</h3>
            <p>
              재무설계 보고서 v1.5의 지훈 씨 가족과 계산식 세부 과정이
              기준입니다. 계산산식 보기에서 부모 금융자산, 자녀 신탁, 급여
              전환의 산식을 확인할 수 있습니다.
            </p>
          </article>
          <article>
            <h3>필요 잔액을 찾는 방법</h3>
            <p>
              56세 시작 신탁액을 500만 원 간격으로 늘려, 선택한 종료 나이까지
              매년 생활비를 충당할 수 있는 최소 잔액을 찾습니다. 인출 한도
              안에서 충당할 수 없으면 계산 미지원으로 표시합니다.
            </p>
          </article>
          <article>
            <h3>조사 자료와 보고서 도표</h3>
            <p>
              부모 사후 대비 현황은 2021년 발달장애인 실태조사를 인용한 보고서
              그림 1을 바탕으로 합니다. 보고서 진단 화면에서 계산 결과와 기준
              사례 도표를 구분해 볼 수 있습니다.
            </p>
          </article>
          <article>
            <h3>은행 공식 자료</h3>
            <p>
              은행 8곳의 홈페이지와 신탁 안내·계약서 8건을 연결했습니다. 상품
              카드에서 원문을 열거나 AI 설명으로 요약과 출처를 함께 확인하세요.
            </p>
          </article>
        </div>
        <div className="landing-method">
          <h3>계산 모형이 반영하는 범위</h3>
          <details>
            <summary>한 해의 신탁 잔액은 어떻게 계산하나요?</summary>
            <p>
              연초 잔액으로 그해 급여를 계산합니다. 월 생활비에서 유족연금과
              공적급여를 뺀 뒤, 월 150만 원 한도 안에서 신탁을 인출합니다.
              12개월 인출을 반영한 잔액에 연 순실질수익률을 적용합니다.
            </p>
          </details>
          <details>
            <summary>65세에는 무엇이 달라지나요?</summary>
            <p>
              보고서 모형에서는 65세부터 장애인연금 기초급여 대신 기초연금을
              반영합니다. 자녀 신탁 잔액과 유족연금에 따른 급여 변화는 ‘보고서
              진단과 대안’의 급여 문턱에서 살펴볼 수 있습니다.
            </p>
          </details>
          <details>
            <summary>기준 사례와 내가 바꾼 사례는 어떻게 구분하나요?</summary>
            <p>
              A·D는 보고서 기준 사례의 고정 비교입니다. 월 생활비·수익률 등을
              바꾸면 B·B′의 연도별 경로, 필요 잔액과 부족액을 다시 계산합니다.
            </p>
          </details>
        </div>
      </section>
      <section id="impact" className="landing-section">
        <p className="eyebrow">08 / 활용 효과</p>
        <h2>한 가지 가정을 바꾸고 차이를 살펴보세요</h2>
        <p>
          같은 가족 사례에서 B안, 연 순실질수익률 1%, 95세까지를 유지하고 부모
          사후 월 생활비만 바꾼 예시입니다.
        </p>
        <LivingCostPreview />
        <details open className="landing-impact-table">
          <summary>예시 두 가지를 표로 보기</summary>
          <div className="table-scroll">
            <table aria-label="월 생활비에 따른 가상 사례 계산 비교">
              <thead>
                <tr>
                  <th scope="col">월 생활비</th>
                  <th scope="col">56세 필요 잔액</th>
                  <th scope="col">자녀 평생 생활비 부족액</th>
                </tr>
              </thead>
              <tbody>
                {livingCostExamples.map(({ monthly, required, shortage }) => (
                  <tr key={monthly}>
                    <th scope="row">{monthly}만 원</th>
                    <td>{money(required)}</td>
                    <td>
                      {shortage > 0 && "약 "}
                      {money(shortage)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <p>
          필요 잔액과 부족액이 얼마나 달라지는지 확인하고, 어떤 가정을 가족이나
          상담 창구와 다시 검토할지 정리할 수 있습니다.
        </p>
      </section>
      <section className="landing-section">
        <p className="eyebrow">09 / 기능 소개</p>
        <h2>사례 설정부터 근거 내보내기까지</h2>
        <div className="landing-evidence-grid">
          <article>
            <h3>시뮬레이터와 보고서 진단</h3>
            <p>
              부모 금융자산과 자녀 신탁의 연도별 경로를 보고, 정년·부모
              사후·65세 급여 전환 시점으로 이동할 수 있습니다.
            </p>
          </article>
          <article>
            <h3>사례 슬롯과 고급 분석</h3>
            <p>
              A–D 슬롯에 가정을 저장해 다시 적용하세요. 샘플 사건과 고급
              분석에서는 재취업 소득이나 생활비 한 가지가 결과에 미치는 영향을
              비교합니다.
            </p>
          </article>
          <article>
            <h3>입력 변경과 공식 문서 설명</h3>
            <p>
              AI 도우미의 입력 제안을 확인한 뒤 적용하거나, 낯선 신탁 용어를
              선택해 관련 공식 자료를 찾아볼 수 있습니다.
            </p>
          </article>
          <article>
            <h3>근거 파일 내려받기</h3>
            <p>
              현재 가정과 계산 결과를 JSON으로, 연도별 경로를 CSV로, 읽기용
              보고서를 HTML로 내려받을 수 있습니다.
            </p>
          </article>
        </div>
      </section>
      <section className="landing-start">
        <div>
          <h2>지훈 씨 가족의 사례로 시작하세요</h2>
          <p>한 가지 가정을 바꾸고 두 세대의 자금 경로를 비교해 보세요.</p>
        </div>
        <button className="primary" onClick={onStart}>
          시뮬레이터 시작하기 ↗
        </button>
      </section>
    </div>
  );
}
