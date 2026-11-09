import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  restore,
  save,
  clear,
  validInputs,
  type Inputs,
  type Strategy,
} from "./storage.ts";
import "./style.css";
import { money } from "./Chart.tsx";
import { fromDisplay } from "./units.ts";
import {
  requestSimulation,
  type Reference,
  type Result,
} from "./simulation.ts";
import { SimulationPaths } from "./SimulationPaths.tsx";
import { StepTitle } from "./StepTitle.tsx";
import { FloatingAssistant } from "./FloatingAssistant.tsx";
import { FormulaReference } from "./FormulaReference.tsx";
import { AnalysisWorkspace } from "./AnalysisWorkspace.tsx";

const PROJECT_NAME = "예시 프로젝트명";
const TEAM_NAME = "OOOO팀";
const CONTEST_TITLE =
  "제1회 전국 대학생 AI 재무설계 콘테스트 「AFPK 영 플래너 챌린지 2026」";
const TEAM_CREDIT = "OOOO팀 제출작 - 김나예, 박민정, 박민준, 장유찬";
const strategies: Record<Strategy, string> = {
  B: "B · 단계 적립",
  B_PRIME: "B′ · 사후 보충",
};
function App() {
  const [ref, setRef] = useState<Reference | null>(null),
    [draft, setDraft] = useState<Record<string, string>>({}),
    [applied, setApplied] = useState<Inputs>({}),
    [strategy, setStrategy] = useState<Strategy>("B");
  const [result, setResult] = useState<Result | null>(null),
    [comparison, setComparison] = useState<Result | null>(null),
    [baseline, setBaseline] = useState<Result | null>(null),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [parseBusy, setParseBusy] = useState(false),
    [sample, setSample] = useState("cost185"),
    [sentence, setSentence] = useState("생활비가 월 185만 원이면?"),
    [proposal, setProposal] = useState<Inputs | null>(null),
    [parseError, setParseError] = useState("");
  const [retry, setRetry] = useState(0);
  const [analysisReset, setAnalysisReset] = useState(0);
  const [exportTarget, setExportTarget] = useState<HTMLDivElement | null>(null);
  const fill = (inputs: Inputs, r: Reference) =>
    Object.fromEntries(
      Object.entries(inputs).map(([k, v]) => [
        k,
        String(
          k === "net_real_return"
            ? v * 100
            : k === "child_end_age"
              ? v
              : v / 10000,
        ),
      ]),
    );
  const storage = () => window.localStorage;
  async function calculate(r: Reference, inputs: Inputs, s: Strategy) {
    const changed = Object.keys(r.defaults).some(
      (k) => inputs[k] !== r.defaults[k],
    );
    const [selected, other, referenceResult] = await Promise.all([
      requestSimulation(r, inputs, s),
      requestSimulation(r, inputs, s === "B" ? "B_PRIME" : "B"),
      changed ? requestSimulation(r, r.defaults, s) : Promise.resolve(null),
    ]);
    setResult(selected);
    setComparison(other);
    setBaseline(referenceResult ?? selected);
  }
  useEffect(() => {
    let active = true;
    (async () => {
      setBusy(true);
      setError("");
      try {
        const response = await fetch("/api/reference-case");
        if (!response.ok) throw new Error("기준 사례를 불러오지 못했습니다.");
        const r: Reference = await response.json();
        if (!active) return;
        let restored;
        try {
          restored = restore(storage(), r.case_id, r.source_version, r.fields);
        } catch {
          restored = {
            saved: null,
            notice: "브라우저 저장소가 차단되어 현재 탭에서만 사용합니다.",
          };
        }
        const values = { ...r.defaults, ...restored.saved?.overrides },
          s = restored.saved?.strategy ?? "B";
        setRef(r);
        setApplied(values);
        setDraft(fill(values, r));
        setStrategy(s);
        setNotice(restored.notice);
        await calculate(r, values, s);
      } catch (e) {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
          );
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [retry]);
  function persist(r: Reference, inputs: Inputs, s: Strategy): boolean {
    const overrides = Object.fromEntries(
      Object.entries(inputs).filter(([k, v]) => v !== r.defaults[k]),
    );
    try {
      return save(storage(), {
        schema_version: 1,
        case_id: r.case_id,
        source_version: r.source_version,
        strategy: s,
        overrides,
      });
    } catch {
      return false;
    }
  }
  async function apply(values?: Inputs, s: Strategy = strategy) {
    if (!ref || busy) return;
    setError("");
    const inputs =
      values ??
      Object.fromEntries(
        Object.entries(draft).map(([k, v]) => [k, fromDisplay(k, v)]),
      );
    if (!validInputs(inputs, ref.fields)) {
      setError(
        "입력 범위와 단위를 확인해 주세요. 빈 값·음수 금액·허용 범위 밖 값은 적용할 수 없습니다.",
      );
      return;
    }
    setBusy(true);
    try {
      await calculate(ref, inputs, s);
      setApplied(inputs);
      setStrategy(s);
      setDraft(fill(inputs, ref));
      const stored = persist(ref, inputs, s);
      setProposal(null);
      setNotice(
        stored
          ? "가상 사례 설정을 적용했습니다. 설정은 이 브라우저에만 저장됩니다."
          : "가상 사례를 적용했지만 저장소가 차단되어 현재 탭에서만 사용합니다.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "서버에 연결하지 못했습니다. 적용을 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    if (!ref || busy) return;
    setError("");
    setProposal(null);
    setAnalysisReset((v) => v + 1);
    setParseError("");
    setSample("cost185");
    setSentence("생활비가 월 185만 원이면?");
    setResult(null);
    setComparison(null);
    setBaseline(null);
    setApplied(ref.defaults);
    setDraft(fill(ref.defaults, ref));
    setStrategy("B");
    let ok = false;
    try {
      ok = clear(storage());
    } catch {}
    setNotice(
      ok
        ? "기준 사례로 초기화하고 이 브라우저의 설정을 삭제했습니다."
        : "현재 탭을 초기화했습니다. 저장소 접근이 차단되어 보관값 삭제를 확인할 수 없습니다.",
    );
    setBusy(true);
    try {
      await calculate(ref, ref.defaults, "B");
    } catch {
      setError("초기화했지만 서버에 연결하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  async function parse() {
    setParseError("");
    setProposal(null);
    setParseBusy(true);
    try {
      const response = await fetch("/api/parse-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sentence }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message ?? "제안을 불러오지 못했습니다.");
      if (
        !ref ||
        !validInputs(data.changes, ref.fields) ||
        !Object.keys(data.changes).length
      )
        throw new Error("지원하지 않는 제안입니다.");
      setProposal(data.changes);
    } catch (e) {
      setParseError(
        e instanceof Error
          ? e.message
          : "연결 오류입니다. 수동 입력은 계속 사용할 수 있습니다.",
      );
    } finally {
      setParseBusy(false);
    }
  }
  if (!ref)
    return (
      <main className="loading">
        <h1>부모가 없는 날</h1>
        <p role="status">
          {busy ? "가상 기준 사례를 불러오고 있습니다." : error}
        </p>
        {!busy && (
          <button onClick={() => setRetry((x) => x + 1)}>다시 연결</button>
        )}
      </main>
    );
  const changed = Object.keys(ref.defaults).some(
    (k) => applied[k] !== ref.defaults[k],
  );
  const preview = (changes: Inputs) => {
    setDraft(fill({ ...applied, ...changes }, ref));
    setNotice("변경안을 입력에 옮겼습니다. 확인 후 변경 적용을 눌러 주세요.");
    setProposal(null);
  };
  const display = (key: string, v: number) =>
    key === "net_real_return"
      ? `${(v * 100).toFixed(2)}%`
      : key === "child_end_age"
        ? `${v}세`
        : `${(v / 10000).toLocaleString("ko-KR")}만 원`;
  return (
    <>
      <header className="topbar contest-header">
        <a className="brand" href="#">
          <span className="brandmark">영</span>
          <span>
            <strong>{PROJECT_NAME}</strong>
            <small>{TEAM_NAME}</small>
          </span>
        </a>
        <p className="contest-heading">{CONTEST_TITLE}</p>
        <div className="header-credit">
          <b>{TEAM_NAME}</b>
          <small>{TEAM_CREDIT}</small>
        </div>
      </header>
      <main>
        <section className="heading">
          <div>
            <p className="eyebrow">FAMILY FINANCIAL PLANNER</p>
            <h1>
              두 세대의 내일,
              <br />
              하나의 계획으로.
            </h1>
            <p className="muted">
              부모의 노후와 지훈 씨의 생활비를 함께 살펴보세요. 보고서의 산식을
              직접 실행하고, 입력을 바꿔 두 세대의 자금 흐름이 어떻게 달라지는지
              확인해 보세요.
            </p>
          </div>
          <div className="version">
            <span className="dot" /> 보고서 계산식 재현 데모
            <br />
            <small>보고서 v1.5 · 앱 0.3.2</small>
          </div>
        </section>
        <div className="banner">
          <strong>v1.5 세부 계산식 기반 직접 계산</strong>
          <span>가상 사례 재현 · 기관 수급 판정 미확인</span>
        </div>
        <nav
          className="analysis-nav guided-nav"
          aria-label="시뮬레이터 사용 순서"
        >
          <a href="#settings-panel">
            <b>01</b>전략과 가정
          </a>
          <span aria-hidden="true">→</span>
          <a href="#events-panel">
            <b>02</b>사건 선택
          </a>
          <span aria-hidden="true">→</span>
          <a href="#paths-panel">
            <b>03</b>결과 확인
          </a>
          <span aria-hidden="true">→</span>
          <a href="#scenario-title">
            <b>04</b>사례 비교
          </a>
          <span aria-hidden="true">→</span>
          <a href="#comparison-panel">
            <b>05</b>대안 비교
          </a>
          <span aria-hidden="true">→</span>
          <a href="#formula-panel">
            <b>06</b>산식 보기
          </a>
        </nav>
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error} <button onClick={() => apply(applied)}>다시 시도</button>
          </p>
        )}
        <div className="workspace">
          <aside className="settings">
            <section className="card family">
              <div className="section-title">
                <StepTitle step="00">지훈 씨 가족</StepTitle>
                <span className="badge">기준 사례</span>
              </div>
              <p>
                아버지 55세 · 어머니 52세
                <br />
                지훈 씨 20세 · 누나 23세
              </p>
              <div className="family-assets">
                <span>
                  부모 금융자산 <b>1.50억 원</b>
                </span>
                <span>
                  자녀 예금 <b>1,000만 원</b>
                </span>
              </div>
              <p className="fine">
                가상 설정 · 실명·연락처·건강정보를 입력하지 마세요.
              </p>
            </section>
            <section className="card" id="settings-panel">
              <StepTitle step="01">전략과 가정</StepTitle>
              <div className="strategy-tabs">
                {(Object.keys(strategies) as Strategy[]).map((s) => (
                  <button
                    key={s}
                    aria-pressed={strategy === s}
                    disabled={busy}
                    onClick={() => apply(applied, s)}
                  >
                    {strategies[s]}
                  </button>
                ))}
              </div>
              <p className="fine">
                {strategy === "B"
                  ? "지금 5천만 + 연 600만 × 5년 + 정년 5천만"
                  : "지금·정년 합계 1억 + 사후 필요액 보충"}{" "}
                · 상품 조건 미확인
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void apply();
                }}
              >
                {Object.entries(ref.fields).map(([key, f]) => (
                  <label className="input-field" key={key}>
                    <span>{f.label}</span>
                    <div>
                      <input
                        type="number"
                        required
                        aria-label={f.label}
                        value={draft[key] ?? ""}
                        min={
                          key === "net_real_return"
                            ? -10
                            : f.min / (key === "child_end_age" ? 1 : 10000)
                        }
                        max={
                          key === "net_real_return"
                            ? 10
                            : f.max / (key === "child_end_age" ? 1 : 10000)
                        }
                        step={
                          key === "net_real_return"
                            ? 0.01
                            : key === "child_end_age"
                              ? 1
                              : 0.0001
                        }
                        onChange={(e) => {
                          setDraft({ ...draft, [key]: e.target.value });
                          setProposal(null);
                        }}
                      />
                      <span>
                        {key === "net_real_return"
                          ? "% / 연"
                          : key === "child_end_age"
                            ? "세"
                            : "만 원 / 월"}
                      </span>
                    </div>
                    <small>{f.source}</small>
                  </label>
                ))}
                <p className="fine">
                  월 금액 0~1,000만 원 · 수익률 -10~10% · 종료 나이 56~110세
                </p>
                <button className="primary full" type="submit" disabled={busy}>
                  {busy ? "요청 중…" : "변경 적용"}
                </button>
              </form>
              <button
                className="text-button full"
                disabled={busy || parseBusy}
                onClick={reset}
              >
                초기화 및 이 브라우저의 설정 삭제
              </button>
              <p className="fine">
                설정은 이 브라우저에만 저장됨 · 결과와 자연어 원문은 저장하지
                않습니다.
              </p>
            </section>
            <section className="card" id="events-panel">
              <StepTitle step="02">샘플 사건</StepTitle>
              <p className="fine">선택 → 변경안 확인 → 변경 적용</p>
              <div className="events">
                {[
                  ["재취업 실패", { monthly_parent_reemployment_income: 0 }],
                  [
                    "재취업 월 100만",
                    { monthly_parent_reemployment_income: 1000000 },
                  ],
                  ["생활비 월 185만", { monthly_child_cost: 1850000 }],
                  ["83세까지 비교", { child_end_age: 83 }],
                  ["95세까지 비교", { child_end_age: 95 }],
                ].map(([label, changes]) => (
                  <button
                    disabled={busy}
                    key={String(label)}
                    onClick={() => preview(changes as Inputs)}
                  >
                    {String(label)} ↗
                  </button>
                ))}
              </div>
              <p className="fine">
                어머니 선사망 · 25세 부모 사고: 별도 상속·돌봄 산식 미확정으로
                미지원.
              </p>
            </section>
            <div className="scenario-exports" ref={setExportTarget} />
          </aside>
          <div className="results">
            <section className="metrics" aria-label="계산 결과">
              {[
                ["선택 기간 필요 잔액", result?.summary.required_trust_at_56],
                [
                  `${strategy === "B" ? "B" : "B′"}안 56세 예상 잔액`,
                  result?.summary.projected_trust_at_56,
                ],
                [
                  "자녀 평생 생활비 부족액",
                  result?.summary.child_shortfall_total,
                ],
              ].map(([title, value]) => (
                <article className="card metric" key={String(title)}>
                  <span>{String(title)}</span>
                  <strong className="computed-value">
                    {money(value as number | undefined | null)}
                  </strong>
                  <div>
                    <span className="tag">보고서 세부식 직접 계산</span>
                  </div>
                </article>
              ))}
            </section>
            {result && (
              <section className="card" id="paths-panel">
                <div className="section-title">
                  <StepTitle step="03">부모와 자녀의 자금 경로</StepTitle>
                  <span className="badge">{strategies[strategy]}</span>
                </div>
                <SimulationPaths
                  result={result}
                  comparison={comparison}
                  baseline={baseline}
                  changed={changed}
                />
                <details>
                  <summary>
                    적용 입력 · 기준과 비교{" "}
                    {changed ? "(변경 있음)" : "(기준 사례)"}
                  </summary>
                  <table>
                    <thead>
                      <tr>
                        <th>입력</th>
                        <th>기준</th>
                        <th>적용</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(ref.fields).map((k) => (
                        <tr key={k}>
                          <th>{ref.fields[k].label}</th>
                          <td>{display(k, ref.defaults[k])}</td>
                          <td>{display(k, applied[k])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
                <details>
                  <summary>B/B′ 계산 결과 비교</summary>
                  <table>
                    <thead>
                      <tr>
                        <th>전략</th>
                        <th>56세 잔액</th>
                        <th>자녀 부족액</th>
                        <th>부모 최저</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ...(changed && baseline ? [baseline] : []),
                        result,
                        comparison,
                      ]
                        .filter((v): v is Result => !!v)
                        .map((v) => (
                          <tr
                            key={`${v === baseline ? "baseline" : "applied"}-${v.strategy}`}
                          >
                            <th>
                              {v === baseline ? "기준 · " : "적용 · "}
                              {strategies[v.strategy]}
                            </th>
                            <td>{money(v.summary.projected_trust_at_56)}</td>
                            <td>{money(v.summary.child_shortfall_total)}</td>
                            <td>{money(v.summary.parent_asset_min)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </details>
                <p className="fine" role="status">
                  {busy
                    ? "서버에 재계산을 요청하는 중…"
                    : `계산 완료 · ${result.assumption_version} · ${applied.child_end_age}세 해 포함`}
                </p>
              </section>
            )}
            {result && comparison && (
              <AnalysisWorkspace
                key={analysisReset}
                reference={ref}
                current={result}
                alternative={comparison}
                disabled={busy}
                exportTarget={exportTarget}
              />
            )}
            <section className="card comparison" id="comparison-panel">
              <div className="section-title">
                <StepTitle step="05">대안 비교</StepTitle>
                <span className="tag">표 9 · 보고서 고정값</span>
              </div>
              <p className="fine">
                2026년 기준 · 비용/최대 후회 단위: 억 원 · 새로운 권고를
                계산하지 않습니다.
              </p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>전략</th>
                      <th>기대 경로</th>
                      <th>어머니 먼저</th>
                      <th>25세 사고</th>
                      <th>95세 생존</th>
                      <th>최대 후회</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ref.report_comparison.map((row) => (
                      <tr
                        key={row.strategy}
                        className={row.strategy === strategy ? "selected" : ""}
                      >
                        <th>
                          {row.strategy === "B_PRIME" ? "B′" : row.strategy}
                          <small>{row.label}</small>
                        </th>
                        {row.costs.map((v, i) => (
                          <td key={i}>{changed ? "—" : v.toFixed(2)}</td>
                        ))}
                        <td>{changed ? "—" : row.max_regret.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {changed && (
                <p className="notice">
                  변경 입력의 동적 비용·후회는 계산 미지원입니다. A/D는 기준
                  사례 고정 비교만 지원합니다. 초기화하면 표 9를 볼 수 있습니다.
                </p>
              )}
              <p className="fine">
                E · 누나에게 금전 부담: 가족의 ‘금전 기여 0원’ 제약 위반으로
                선택 제외. 신탁 잔액 5억: 표 8 고정 민감도 참고값이며 A안이
                아닙니다.
              </p>
            </section>
          </div>
          <FormulaReference />
        </div>
        <footer className="contest-footer">
          <div>
            <strong>{PROJECT_NAME}</strong>
            <span>{CONTEST_TITLE}</span>
          </div>
          <div>
            <b>{TEAM_NAME}</b>
            <span>{TEAM_CREDIT}</span>
          </div>
        </footer>
      </main>
      <FloatingAssistant>
        <p className="muted">
          가상 사례의 입력 하나를 값·단위와 함께 적으면 LLM이 변경값을
          제안합니다.
        </p>
        <label className="sentence-field">
          자연어 변경 문장
          <input
            aria-label="자연어 변경 문장"
            maxLength={120}
            value={sentence}
            disabled={parseBusy}
            onChange={(e) => {
              setSentence(e.target.value);
              setProposal(null);
              setParseError("");
            }}
          />
        </label>
        <div className="proposal-form">
          <select
            aria-label="가상 자연어 시연 문장"
            value={sample}
            disabled={parseBusy}
            onChange={(e) => {
              setSample(e.target.value);
              setSentence(
                ref.samples.find((s) => s.id === e.target.value)?.text ?? "",
              );
              setProposal(null);
              setParseError("");
            }}
          >
            {ref.samples.map((s) => (
              <option key={s.id} value={s.id}>
                {s.text}
              </option>
            ))}
          </select>
          <button disabled={parseBusy || busy} onClick={parse}>
            {parseBusy ? "제안 요청 중…" : "변경 제안 받기"}
          </button>
        </div>
        <details>
          <summary>지원 범위·개인정보 안내</summary>
          <p className="fine">
            예시 형식의 지원 필드·숫자·단위만 허용하며, 이름·연락처·건강정보가
            섞인 문장은 서버에서 거부합니다. LLM은 계산·법률 판단을 하지
            않습니다.
          </p>
        </details>
        {parseError && (
          <p role="alert" className="error">
            사용 불가 · {parseError}
          </p>
        )}
        {proposal && (
          <div className="proposal" role="status">
            <strong>제안 변경값을 확인해 주세요</strong>
            {Object.entries(proposal).map(([k, v]) => (
              <p key={k}>
                {ref.fields[k].label}: {display(k, applied[k])} →{" "}
                <b>{display(k, v)}</b>
              </p>
            ))}
            <button
              className="primary"
              disabled={busy}
              onClick={() => apply({ ...applied, ...proposal })}
            >
              확인하고 계산 요청
            </button>
            <button onClick={() => setProposal(null)}>취소</button>
          </div>
        )}
      </FloatingAssistant>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
