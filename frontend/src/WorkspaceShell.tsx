import React, { useEffect, useState } from "react";

export const pages = {
  simulation: "재무 설계 시뮬레이터",
  report: "보고서 진단과 대안",
  formulas: "계산산식 보기",
  events: "샘플 사건과 민감도",
  trusts: "은행과 신탁 상품",
  settings: "환경설정",
};
export type Page = keyof typeof pages;
export function currentPage(): Page {
  const hash = window.location.hash.slice(1);
  return Object.hasOwn(pages, hash) ? (hash as Page) : "simulation";
}

const defaults = {
  size: "normal",
  contrast: false,
  patterns: false,
  motion: false,
  reader: false,
};
type Preferences = typeof defaults;
const key = "family-finance:accessibility";
export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? "{}");
      return {
        size: ["normal", "large", "largest"].includes(stored.size)
          ? stored.size
          : "normal",
        contrast: stored.contrast === true,
        patterns: stored.patterns === true,
        motion: stored.motion === true,
        reader: stored.reader === true,
      };
    } catch {
      return defaults;
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.textSize = preferences.size;
    root.toggleAttribute("data-high-contrast", preferences.contrast);
    root.toggleAttribute("data-patterns", preferences.patterns);
    root.toggleAttribute("data-no-motion", preferences.motion);
    try {
      localStorage.setItem(key, JSON.stringify(preferences));
    } catch {}
  }, [preferences]);
  return [preferences, setPreferences] as const;
}

export function PreferencesPanel({
  value,
  onChange,
}: {
  value: Preferences;
  onChange: (p: Preferences) => void;
}) {
  const options = [
    ["contrast", "고대비 모드", "텍스트와 카드 경계를 더 뚜렷하게 표시합니다."],
    ["patterns", "색약 모드", "그래프의 선 모양과 상태 패턴을 강조합니다."],
    [
      "motion",
      "애니메이션 끄기",
      "그래프 자동 재생과 부드러운 스크롤을 줄입니다.",
    ],
    [
      "reader",
      "화면 읽기 안내",
      "메뉴 이동 시 중앙 화면 제목으로 초점을 옮깁니다.",
    ],
  ] as const;
  return (
    <div className="care-settings">
      <section className="card">
        <h2>내 접근성 환경</h2>
        <fieldset>
          <legend>글자 크기</legend>
          {(
            [
              ["normal", "기본"],
              ["large", "크게"],
              ["largest", "아주 크게"],
            ] as const
          ).map(([size, label]) => (
            <label key={size}>
              <input
                type="radio"
                name="text-size"
                checked={value.size === size}
                onChange={() => onChange({ ...value, size })}
              />{" "}
              {label}
            </label>
          ))}
        </fieldset>
        <div className="care-option-grid">
          {options.map(([name, label, detail]) => (
            <label className="care-option" key={name}>
              <span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={value[name]}
                onChange={(event) =>
                  onChange({ ...value, [name]: event.target.checked })
                }
              />
            </label>
          ))}
        </div>
      </section>
      <section className="card">
        <h2>개인정보와 브라우저 데이터</h2>
        <p>
          가상의 금액과 나이로 실험해 보세요. 실제 이름, 연락처, 계좌번호,
          건강정보는 입력하지 마세요.
        </p>
        <p>
          적용한 가상 입력과 접근성 설정은 이 브라우저에 보관됩니다. 대화와 계산
          결과는 새로고침이나 로그아웃 시 지워집니다. 가상 사례 슬롯은 오른쪽
          패널에서 삭제할 수 있습니다.
        </p>
        <button onClick={() => onChange(defaults)}>접근성 설정 초기화</button>
      </section>
    </div>
  );
}
