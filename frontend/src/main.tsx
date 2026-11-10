import React, { useCallback, useEffect, useState } from "react";
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
import "./workspace.css";
import {
  matchingSources,
  TrustLibrary,
  type TrustSource,
  type SourceRequest,
} from "./TrustLibrary.tsx";
import { CaseSlots, type SlotName } from "./CaseSlots.tsx";
import type { Snapshot } from "./analysis.ts";
import { Entrance, sessionRequest } from "./Entrance.tsx";
import {
  currentPage,
  pages,
  PreferencesPanel,
  usePreferences,
} from "./WorkspaceShell.tsx";
import { money } from "./Chart.tsx";
import { fromDisplay } from "./units.ts";
import {
  requestSimulation,
  type Reference,
  type Result,
} from "./simulation.ts";
import { SimulationPaths } from "./SimulationPaths.tsx";
import { StepTitle } from "./StepTitle.tsx";
import { ChatAssistant } from "./ChatAssistant.tsx";
import { ReportInsights } from "./ReportInsights.tsx";
import { FormulaReference } from "./FormulaReference.tsx";
import { AnalysisWorkspace } from "./AnalysisWorkspace.tsx";

const PROJECT_NAME = "케어 파트너스";
const TEAM_NAME = "OOOO팀";
const CONTEST_TITLE =
  "제1회 전국 대학생 AI 재무설계 콘테스트 「AFPK 영 플래너 챌린지 2026」";
const TEAM_CREDIT = "OOOO팀 제출작 - 김나예, 박민정, 박민준, 장유찬";
const strategies: Record<Strategy, string> = {
  B: "B · 단계 적립",
  B_PRIME: "B′ · 사후 보충",
};
function App() {
  const [entered, setEntered] = useState(false);
  const enter = useCallback(() => {
    if (!Object.hasOwn(pages, location.hash.slice(1)))
      history.replaceState(null, "", "#simulation");
    setEntered(true);
  }, []);
  const leave = () => {
    history.replaceState(null, "", location.pathname);
    setEntered(false);
  };
  useEffect(() => {
    if (!entered) return;
    let active = true;
    const verify = () => {
      if (document.visibilityState === "visible")
        void sessionRequest("")
          .then((valid) => {
            if (active && !valid) leave();
          })
          .catch(() => {});
    };
    const timer = window.setInterval(verify, 60_000);
    document.addEventListener("visibilitychange", verify);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", verify);
    };
  }, [entered]);
  return entered ? <Workspace onExit={leave} /> : <Entrance onEnter={enter} />;
}

function Workspace({ onExit }: { onExit: () => void }) {
  const [page, setPage] = useState(currentPage);
  const [sources, setSources] = useState<TrustSource[]>([]);
  const [catalogError, setCatalogError] = useState(false);
  const [sourceRequest, setSourceRequest] = useState<SourceRequest | null>(
    null,
  );
  const [selectionIds, setSelectionIds] = useState<string[]>([]);
  function askSource(ids: string[]) {
    setSourceRequest((previous) => ({
      ids,
      sequence: (previous?.sequence ?? 0) + 1,
    }));
    setSelectionIds([]);
    window.getSelection()?.removeAllRanges();
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/trust-sources", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => setSources(data.sources))
      .catch(() => {
        if (!controller.signal.aborted) setCatalogError(true);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    function readSelection() {
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? "";
      const anchor = selection?.anchorNode?.parentElement;
      const focus = selection?.focusNode?.parentElement;
      if (
        !text ||
        text.length > 180 ||
        !anchor?.closest(".care-content") ||
        !focus?.closest(".care-content")
      ) {
        setSelectionIds([]);
        return;
      }
      const article = anchor.closest<HTMLElement>("[data-source-id]");
      const sourceId = article?.contains(focus)
        ? article.dataset.sourceId
        : undefined;
      setSelectionIds(sourceId ? [sourceId] : matchingSources(text, sources));
    }
    document.addEventListener("selectionchange", readSelection);
    return () => document.removeEventListener("selectionchange", readSelection);
  }, [sources]);
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    if (!location.hash) history.replaceState(null, "", "#simulation");
  }, []);
  async function logout() {
    setLoggingOut(true);
    try {
      await sessionRequest("/logout", {});
      onExit();
    } catch {
      setError(
        "로그아웃을 완료하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.",
      );
    } finally {
      setLoggingOut(false);
    }
  }
  const [preferences, setPreferences] = usePreferences();
  useEffect(() => {
    const navigate = () => {
      setPage(currentPage());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  useEffect(() => {
    if (preferences.reader) document.getElementById("workspace-title")?.focus();
  }, [page, preferences.reader]);
  const [ref, setRef] = useState<Reference | null>(null),
    [draft, setDraft] = useState<Record<string, string>>({}),
    [applied, setApplied] = useState<Inputs>({}),
    [strategy, setStrategy] = useState<Strategy>("B");
  const [result, setResult] = useState<Result | null>(null),
    [comparison, setComparison] = useState<Result | null>(null),
    [baseline, setBaseline] = useState<Result | null>(null),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [activeSlot, setActiveSlot] = useState<SlotName | null>(null);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [retry, setRetry] = useState(0);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
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
        if (response.status === 401 && active) {
          onExit();
          return;
        }
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
  async function apply(
    values?: Inputs,
    s: Strategy = strategy,
    slot: SlotName | null = null,
  ) {
    if (!ref || busy) return false;
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
      return false;
    }
    setBusy(true);
    try {
      await calculate(ref, inputs, s);
      setActiveSlot(slot);
      setApplied(inputs);
      setStrategy(s);
      setDraft(fill(inputs, ref));
      const stored = persist(ref, inputs, s);
      setNotice(
        stored
          ? "가상 사례를 적용했습니다."
          : "가상 사례를 적용했지만 저장소가 차단되어 현재 탭에서만 사용합니다.",
      );
      return true;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "서버에 연결하지 못했습니다. 적용을 다시 시도해 주세요.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    if (!ref || busy) return;
    setError("");
    setActiveSlot(null);
    setAnalysisReset((v) => v + 1);
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
        ? "기준 사례로 초기화했습니다."
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
  const hasUnappliedDraft = Object.entries(fill(applied, ref)).some(
    ([key, value]) => value !== draft[key],
  );
  function openAssumptions() {
    setShowAssumptions(true);
    requestAnimationFrame(() =>
      document.getElementById("settings-panel")?.focus(),
    );
  }
  const preview = (changes: Inputs) => {
    setDraft(fill({ ...applied, ...changes }, ref));
    openAssumptions();
    setNotice("변경안을 입력에 옮겼습니다. 확인 후 변경 적용을 눌러 주세요.");
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
        <a className="brand" href="#simulation">
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
          <div className="care-header-actions">
            <button onClick={onExit}>소개 홈</button>
            <button onClick={() => void logout()} disabled={loggingOut}>
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <a
        className="care-skip"
        href="#workspace-title"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("workspace-title")?.focus();
        }}
      >
        본문으로 이동
      </a>
      <main className="care-main">
        <div className="care-workspace">
          <div className="care-sidebar">
            <nav className="care-nav" aria-label="작업 화면">
              {Object.entries(pages).map(([id, label], index) => (
                <a
                  key={id}
                  href={`#${id}`}
                  aria-current={page === id ? "page" : undefined}
                >
                  <span aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {label}
                </a>
              ))}
            </nav>
          </div>
          <div className="care-content">
            <div className="care-page-heading">
              <p className="eyebrow">FAMILY FINANCIAL PLANNER</p>
              <h1 id="workspace-title" tabIndex={-1}>
                {pages[page]}
              </h1>
              {activeSlot && page === "simulation" && (
                <span className="tag">슬롯 {activeSlot} · 적용 사례</span>
              )}
              <p>
                {page === "trusts"
                  ? "은행 홈페이지와 신탁 상품 공식 문서를 한곳에서 찾아보세요."
                  : "가상 사례에서 가정을 바꾸고 적용 결과를 확인하세요. 모르는 용어를 선택하면 연결된 공식 자료를 볼 수 있어요."}
              </p>
              <button
                className="care-rail-jump"
                onClick={() =>
                  document.getElementById("current-case-summary")?.focus()
                }
              >
                현재 사례와 가정으로 이동
              </button>
            </div>
            <section
              className="card care-assumptions"
              id="settings-panel"
              tabIndex={-1}
              hidden={!showAssumptions}
            >
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
                <div className="care-assumptions-fields">
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
                </div>
                <p className="fine">
                  월 금액 0~1,000만 원 · 수익률 -10~10% · 종료 나이 56~110세
                </p>
                <button className="primary full" type="submit" disabled={busy}>
                  {busy ? "요청 중…" : "변경 적용"}
                </button>
              </form>
              <button
                className="text-button full"
                disabled={busy}
                onClick={reset}
              >
                현재 가정 초기화
              </button>
              <p className="fine">
                설정은 이 브라우저에만 저장됨 · 결과와 자연어 원문은 저장하지
                않습니다.
              </p>
            </section>
            {page === "simulation" && (
              <>
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
                {result && (
                  <section className="card" id="paths-panel">
                    <div className="section-title">
                      <StepTitle step="01">부모와 자녀의 자금 경로</StepTitle>
                      <span className="badge">{strategies[strategy]}</span>
                    </div>
                    <SimulationPaths
                      result={result}
                      comparison={comparison}
                      baseline={baseline}
                      changed={changed}
                      motionDisabled={preferences.motion}
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
                                <td>
                                  {money(v.summary.projected_trust_at_56)}
                                </td>
                                <td>
                                  {money(v.summary.child_shortfall_total)}
                                </td>
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
              </>
            )}
            {page === "report" && (
              <div className="results">
                <ReportInsights
                  result={result}
                  comparison={comparison}
                  activeSlot={activeSlot}
                >
                  <span className="tag">표 9 · 보고서 고정값</span>
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
                            className={
                              row.strategy === strategy ? "selected" : ""
                            }
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
                      사례 고정 비교만 지원합니다. 초기화하면 표 9를 볼 수
                      있습니다.
                    </p>
                  )}
                  <p className="fine">
                    E · 누나에게 금전 부담: 가족의 ‘금전 기여 0원’ 제약 위반으로
                    선택 제외. 신탁 잔액 5억: 표 8 고정 민감도 참고값이며 A안이
                    아닙니다.
                  </p>
                </ReportInsights>{" "}
              </div>
            )}
            {page === "formulas" && <FormulaReference />}
            {page === "trusts" && (
              <TrustLibrary
                sources={sources}
                loadError={catalogError}
                onAsk={askSource}
              />
            )}
            {page === "settings" && (
              <PreferencesPanel value={preferences} onChange={setPreferences} />
            )}
            <div hidden={page !== "events"}>
              <section className="card" id="events-panel">
                <StepTitle step="04">샘플 사건</StepTitle>
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
              {result && comparison && (
                <AnalysisWorkspace
                  key={analysisReset}
                  reference={ref}
                  current={result}
                  alternative={comparison}
                  disabled={busy}
                  exportTarget={exportTarget}
                  snapshots={snapshots}
                />
              )}
            </div>
          </div>
          <aside className="care-rail" aria-label="현재 사례와 설정">
            <div
              className="care-rail-heading"
              id="current-case-summary"
              tabIndex={-1}
            >
              <h2>{activeSlot ? `슬롯 ${activeSlot} 적용 중` : "현재 적용"}</h2>
              <span>{strategies[strategy]}</span>
            </div>
            <p className="care-applied-inputs">
              생활비 {display("monthly_child_cost", applied.monthly_child_cost)}{" "}
              / 월 · {display("net_real_return", applied.net_real_return)} ·{" "}
              {display("child_end_age", applied.child_end_age)}까지
            </p>
            {hasUnappliedDraft && (
              <p className="care-applied-inputs" role="status">
                입력 변경을 확인한 뒤 적용하세요.
              </p>
            )}
            <section
              className="metrics"
              aria-label="계산 결과"
              aria-live="polite"
              aria-busy={busy}
            >
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
                    {result
                      ? money(value as number | undefined | null)
                      : busy
                        ? "계산 중"
                        : "결과 없음"}
                  </strong>
                  <div>
                    <span className="tag">보고서 세부식 직접 계산</span>
                  </div>
                </article>
              ))}
            </section>
            <div className="care-feedback" aria-live="polite">
              {notice && <p className="notice">{notice}</p>}
              {error && (
                <p className="error" role="alert">
                  {error}{" "}
                  <button onClick={() => apply(applied)}>다시 시도</button>
                </p>
              )}
            </div>
            <div>
              <button
                className="care-assumptions-toggle"
                aria-expanded={showAssumptions}
                aria-controls="settings-panel"
                onClick={() =>
                  showAssumptions
                    ? setShowAssumptions(false)
                    : openAssumptions()
                }
              >
                {showAssumptions ? "가정 입력 닫기" : "전략과 가정 편집"}
              </button>
              <CaseSlots
                reference={ref}
                disabled={busy}
                current={
                  result
                    ? {
                        schema_version: 1,
                        case_id: ref.case_id,
                        source_version: ref.source_version,
                        strategy,
                        overrides: Object.fromEntries(
                          Object.entries(applied).filter(
                            ([key, value]) => ref.defaults[key] !== value,
                          ),
                        ),
                      }
                    : null
                }
                activeSlot={activeSlot}
                onLoad={(name, slot) =>
                  apply(
                    { ...ref.defaults, ...slot.overrides },
                    slot.strategy,
                    name,
                  )
                }
                onSave={(name, saved) => {
                  if (saved) setActiveSlot(name);
                  else if (activeSlot === name) setActiveSlot(null);
                }}
                onCompare={setSnapshots}
              />
            </div>
          </aside>
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
      {selectionIds.length > 0 && (
        <button
          className="primary care-selection"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => askSource(selectionIds)}
        >
          선택한 내용의 공식 자료 보기 ↗
        </button>
      )}
      <ChatAssistant
        sources={sources}
        sourceRequest={sourceRequest}
        reference={ref}
        applied={applied}
        disabled={busy}
        resetKey={analysisReset}
        onApply={(changes) => apply({ ...applied, ...changes })}
      />
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
