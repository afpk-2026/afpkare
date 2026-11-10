import React, { useState } from "react";
import baseline from "./report-baseline.json";
import { money } from "./Chart.tsx";

const strategies = [
  {
    title: "B · 단계 적립",
    description: "부모 생전에 여러 차례 나누어 적립하는 보고서의 대안입니다.",
    color: "#65c4ff",
  },
  {
    title: "B′ · 사후 보충",
    description:
      "부모 생전 적립과 사후 보충을 함께 검토하는 보고서의 대안입니다.",
    color: "#ffcb7b",
  },
];
const steps = [
  {
    title: "생활비 가정 바꾸기",
    description:
      "오른쪽의 ‘전략과 가정 편집’을 누르세요. 예를 들어 부모 사후 월 생활비를 180만 원에서 185만 원으로 바꾸고 ‘변경 적용’을 누릅니다.",
    image: "edit.webp",
    alt: "가정 편집 화면의 부모 사후 월 생활비 입력과 변경 적용 버튼",
  },
  {
    title: "저장한 사례 다시 비교하기",
    description:
      "오른쪽 슬롯을 선택해 ‘현재 적용값 저장’을 누릅니다. 저장한 슬롯을 클릭하면 시뮬레이터와 보고서가 같은 가정으로 바뀝니다. ‘보고서 진단과 대안’의 대안 비교에서 B와 B′의 부족액을 비교해 보세요.",
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
    "운영 환경의 로그인은 HTTPS를 사용하며, 세션을 확인한 뒤 계산 기능을 제공합니다.",
  ],
  [
    "익명정보 처리",
    "시뮬레이터는 가상의 가족과 수치를 사용합니다. 입력한 사례를 익명정보로 변환하는 별도 절차는 제공하지 않습니다.",
  ],
  [
    "민감정보 보호",
    "실명·연락처·계좌번호·건강정보 대신 가상의 금액과 나이를 입력하세요. 공식 자료 검색은 브라우저에서 대조하고 자료 식별자만 서버에 보냅니다.",
  ],
  [
    "운영통제 및 공공기준",
    "운영자가 데모 접속을 관리하고, 세션은 로그아웃·만료·서버 재시작 시 종료됩니다. 공공 도입 기준 충족 여부는 별도 검토 대상입니다.",
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
  const [selected, setSelected] = useState(0);
  const x = (age: number) => 30 + ((age - 56) / 39) * 360;
  const y = (balance: number) => 133 - (balance / 200_000_000) * 110;
  return (
    <figure className="landing-demo">
      <figcaption>
        <span>보고서 기준 사례</span>
        <strong>부모 사후 신탁 경로</strong>
      </figcaption>
      <div className="landing-demo-controls" aria-label="전략 예시 선택">
        {strategies.map((strategy, index) => (
          <button
            key={strategy.title}
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
          >
            {strategy.title}
          </button>
        ))}
      </div>
      <svg
        viewBox="0 0 420 165"
        role="img"
        aria-label="56세에서 95세까지의 기준 사례 신탁 잔액 경로"
      >
        {[0, 50_000_000, 100_000_000, 150_000_000, 200_000_000].map((value) => (
          <line
            key={value}
            x1="30"
            x2="390"
            y1={y(value)}
            y2={y(value)}
            stroke="#345673"
          />
        ))}
        {baseline.trust.map((item, index) => (
          <polyline
            key={item.strategy}
            points={item.withdrawal
              .map(([age, balance]) => `${x(age)},${y(balance)}`)
              .join(" ")}
            fill="none"
            stroke={strategies[index].color}
            strokeWidth={selected === index ? 4 : 2}
            strokeDasharray={index ? "6 4" : undefined}
          />
        ))}
        {[56, 65, 83, 95].map((age) => (
          <text
            key={age}
            x={x(age)}
            y="153"
            textAnchor="middle"
            fill="#dcecff"
            fontSize="13"
          >
            {age}세
          </text>
        ))}
      </svg>
      <div className="landing-demo-stat">
        <span>56세 연초 예상 잔액</span>
        <strong>{money(baseline.trust[selected].projected)}</strong>
      </div>
      <p>{strategies[selected].description}</p>
    </figure>
  );
}

export function ServiceOverview({ onStart }: { onStart: () => void }) {
  return (
    <>
      <section id="about" className="landing-section landing-story">
        <div>
          <p className="eyebrow">01 / 서비스 배경</p>
          <h2>
            부모의 노후부터
            <br />
            자녀의 생활까지
          </h2>
        </div>
        <div>
          <p>
            한 가족의 재무설계에는 부모가 생활비를 충당하는 기간과 자녀가 부모
            사후에 생활을 이어가는 기간이 함께 들어 있습니다. 적립액만 봐서는
            어느 시점에 자금이 부족해지고, 무엇을 조정하면 달라지는지 파악하기
            어렵습니다.
          </p>
          <p>
            케어 파트너스는 보고서 속 지훈 씨 가족을 가상 사례로 옮겼습니다.
            같은 사례에 서로 다른 가정을 적용해 장기간의 자금 흐름을 살펴보고,
            가족과 전문가에게 어떤 질문을 가져갈지 정리할 수 있습니다.
          </p>
          <p>
            디지털 화면을 읽거나 조작하기 어려우면 금융 정보와 상담 창구를 찾는
            일부터 막힐 수 있습니다. 장애인의 장기 생활과 돌봄에 맞는 신탁 등
            금융상품 선택지도 제한적입니다. 흩어진 정보를 찾더라도 부모 사후에
            누가 재산을 관리하고 생활비를 어떻게 지급할지 정하는 일은 가족에게
            남습니다.
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
      </section>
      <section className="landing-section landing-differences">
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
        <p>
          로그인 후 지훈 씨 가족의 가상 사례에서 아래 순서대로 따라해 보세요.
        </p>
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
      <section id="evidence" className="landing-section landing-evidence">
        <p className="eyebrow">04 / 근거를 읽는 방법</p>
        <h2>결과 옆에서 산식과 자료를 확인하세요</h2>
        <div className="landing-evidence-grid">
          <article>
            <h3>보고서 진단과 대안</h3>
            <p>
              선택한 가정에서 계산된 필요 잔액, 생활비 부족액, 신탁과 급여
              경로를 확인할 수 있습니다. 보고서의 설계 전 진단과 180일 일정도
              별도로 열어볼 수 있습니다.
            </p>
          </article>
          <article>
            <h3>은행과 신탁 상품</h3>
            <p>
              은행 8곳의 홈페이지와 신탁 자료 8건의 원문 링크를 모았습니다.
              상품이나 용어가 궁금하면 AI 도우미에서 관련 공식 문서 요약을
              확인할 수 있습니다.
            </p>
          </article>
          <article>
            <h3>입력 변경 도우미</h3>
            <p>
              예시 문장으로 생활비나 설계 종료 나이 등을 제안받을 수 있습니다.
              제안 내용을 확인하고 적용을 눌러야 계산에 반영됩니다.
            </p>
          </article>
          <article>
            <h3>비교와 내보내기</h3>
            <p>
              저장한 사례를 현재 결과와 비교하고, 샘플 사건과 민감도 화면에서 한
              가지 가정의 영향을 살펴봅니다. 계산 근거를 JSON, CSV, HTML로
              내려받을 수 있습니다.
            </p>
          </article>
        </div>
      </section>
      <section id="privacy" className="landing-section landing-safeguards">
        <p className="eyebrow">05 / 개인정보 보호</p>
        <h2>개인정보를 보호하는 방법</h2>
        <p>
          가상 사례를 중심으로 서비스에 필요한 정보만 처리합니다. 현재 보호
          조치와 공공 도입 시 검토할 항목을 확인하세요.
        </p>
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
        <p className="eyebrow">06 / 접근성</p>
        <h2>읽고 쓰기 편한 화면</h2>
        <p>로그인한 뒤 왼쪽 메뉴의 ‘환경설정’에서 화면을 나에게 맞춰 보세요.</p>
        <dl>
          {accessibility.map(([title, detail]) => (
            <div key={title}>
              <dt>{title}</dt>
              <dd>{detail}</dd>
            </div>
          ))}
        </dl>
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
    </>
  );
}
