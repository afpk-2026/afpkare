import { GuidedTrial } from "./GuidedTrial.tsx";
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
import "./workspace.css";
import {
  matchingSources,
  TrustLibrary,
  TrustConversationProvider,
  type TrustSource,
  type SourceRequest,
} from "./TrustLibrary.tsx";
import { CaseSlots, useCaseSlots, type SlotName } from "./CaseSlots.tsx";
import type { Snapshot } from "./analysis.ts";
import { Entrance, SessionControl } from "./Entrance.tsx";
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
import { sampleEventGroups } from "./sampleEvents.ts";

const PROJECT_NAME = "AFPKare";
const TEAM_NAME = "OOOO팀";
const CONTEST_TITLE =
  "제1회 전국 대학생 AI 재무설계 콘테스트 「AFPK 영 플래너 챌린지 2026」";
const TEAM_CREDIT = "OOOO팀 제출작 - 김나예, 박민정, 박민준, 장유찬";
const strategies: Record<Strategy, string> = {
  B: "B · 단계 적립",
  B_PRIME: "B′ · 사후 보충",
};
const caseExamples: { title: string; detail: string; changes: Inputs }[] = [
  {
    title: "생활비가 늘어날 때",
    detail: "월 생활비 210만 원 · 95세까지 준비",
    changes: { monthly_child_cost: 2_100_000 },
  },
  {
    title: "재취업이 어려울 때",
    detail: "재취업 소득 0원 · 생활비 월 180만 원",
    changes: { monthly_parent_reemployment_income: 0 },
  },
  {
    title: "더 오래 준비할 때",
    detail: "100세까지 준비 · 생활비 월 180만 원",
    changes: { child_end_age: 100 },
  },
];
function App() {
  const displayPreferences = usePreferences();
  const [entered, setEntered] = useState(
    () =>
      Object.hasOwn(pages, location.hash.slice(1)) ||
      location.hash === "#formulas",
  );
  function enter() {
    history.replaceState(null, "", "#simulation");
    setEntered(true);
    window.scrollTo(0, 0);
  }
  function leave() {
    history.replaceState(null, "", location.pathname + location.search);
    setEntered(false);
    window.scrollTo(0, 0);
  }
  return entered ? (
    <Workspace onExit={leave} displayPreferences={displayPreferences} />
  ) : (
    <Entrance onEnter={enter} />
  );
}

function Workspace({
  onExit,
  displayPreferences,
}: {
  onExit: () => void;
  displayPreferences: ReturnType<typeof usePreferences>;
}) {
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
  const [preferences, setPreferences] = displayPreferences;
  useEffect(() => {
    const navigate = () => {
      setPage(currentPage());
      if (location.hash === "#formulas") {
        requestAnimationFrame(() =>
          document.getElementById("formula-panel")?.scrollIntoView(),
        );
      } else window.scrollTo(0, 0);
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
  const [eventGroup, setEventGroup] = useState(sampleEventGroups[0]);
  const [eventValue, setEventValue] = useState<number | null>(null);
  const [eventApplied, setEventApplied] = useState(false);
  const [editingSlot, setEditingSlot] = useState<SlotName | null>(null);
  const [activeSlot, setActiveSlot] = useState<SlotName | null>(null);
  const [slotActionsTarget, setSlotActionsTarget] =
    useState<HTMLDivElement | null>(null);
  const [retry, setRetry] = useState(0);
  const caseSlots = useCaseSlots(ref);
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
    saveEditedSlot = false,
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
      const target = slot ?? (saveEditedSlot ? editingSlot : null);
      let copiedSaved = true;
      if (!slot && saveEditedSlot && editingSlot) {
        copiedSaved = caseSlots.write(editingSlot, {
          schema_version: 1,
          case_id: ref.case_id,
          source_version: ref.source_version,
          strategy: s,
          overrides: Object.fromEntries(
            Object.entries(inputs).filter(
              ([key, value]) => ref.defaults[key] !== value,
            ),
          ),
        });
      }
      if (slot || !saveEditedSlot) setEditingSlot(null);
      setActiveSlot(copiedSaved ? target : null);
      setApplied(inputs);
      setStrategy(s);
      setDraft(fill(inputs, ref));
      const stored = persist(ref, inputs, s);
      setNotice(
        stored && copiedSaved
          ? ""
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
    setEditingSlot(null);
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
  useEffect(() => {
    if (ref && page === "settings" && location.hash === "#formulas")
      document.getElementById("formula-panel")?.scrollIntoView();
  }, [ref, page]);
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
          <img
            className="afpkare-logo"
            src="/brand/afpkare-logo.png"
            alt={PROJECT_NAME}
            width="2172"
            height="724"
          />
        </a>
        <p className="contest-heading">{CONTEST_TITLE}</p>
        <div className="header-credit">
          <b>{TEAM_NAME}</b>
          <small>{TEAM_CREDIT}</small>
          <div className="care-header-actions">
            <button onClick={onExit}>소개 홈</button>
            <SessionControl />
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
                  : page === "settings"
                    ? "글자와 색상, 움직임을 내게 맞게 조정하세요."
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
            {page === "simulation" && (
              <>
                <GuidedTrial
                  reference={ref}
                  disabled={busy}
                  onApply={(inputs) => apply(inputs, "B")}
                />
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
                    <a href={href} key={href}>
                      <span className="consumer-link-number" aria-hidden="true">
                        {number}
                      </span>
                      <strong>{title}</strong>
                      <span className="consumer-link-description">
                        {description}
                      </span>
                      <span className="consumer-link-arrow" aria-hidden="true">
                        ↗
                      </span>
                    </a>
                  ))}
                </nav>
                <div ref={setSlotActionsTarget} />
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
                    <details open>
                      <summary>
                        적용 입력 · 기준과 비교{" "}
                        {changed ? "(변경 있음)" : "(기준 사례)"}
                      </summary>
                      <div className="table-scroll">
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
                      </div>
                    </details>
                    <details open>
                      <summary>B/B′ 계산 결과 비교</summary>
                      <div className="table-scroll">
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
                      </div>
                    </details>
                    {busy && (
                      <p className="fine" role="status">
                        재계산 중…
                      </p>
                    )}
                  </section>
                )}
              </>
            )}
            {page === "report" && (
              <div className="results">
                <ReportInsights
                  reference={ref}
                  slots={caseSlots.slots}
                  disabled={busy}
                  onSelectSlot={(name) => {
                    const saved = caseSlots.slots[name];
                    return saved
                      ? apply(
                          { ...ref.defaults, ...saved.overrides },
                          saved.strategy,
                          name,
                        )
                      : Promise.resolve(false);
                  }}
                  onCopy={() => {
                    const name = caseSlots.copy({
                      schema_version: 1,
                      case_id: ref.case_id,
                      source_version: ref.source_version,
                      strategy,
                      overrides: Object.fromEntries(
                        Object.entries(applied).filter(
                          ([key, value]) => ref.defaults[key] !== value,
                        ),
                      ),
                    });
                    if (name) {
                      setActiveSlot(name);
                      setEditingSlot(name);
                      requestAnimationFrame(() =>
                        document
                          .querySelector<HTMLInputElement>(
                            "#settings-panel input",
                          )
                          ?.focus(),
                      );
                    }
                    return name;
                  }}
                  reportValues={ref.report_values}
                  appliedResult={result}
                  appliedComparison={comparison}
                  activeSlot={activeSlot}
                  snapshots={snapshots}
                >
                  <p className="fine">
                    2026년 실질 가격 · 비용과 최대 후회 단위 억 원
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
                            className={row.strategy === "B" ? "selected" : ""}
                          >
                            <th>
                              {row.strategy === "B_PRIME" ? "B′" : row.strategy}
                              <small>{row.label}</small>
                            </th>
                            {row.costs.map((v, i) => (
                              <td key={i}>{v.toFixed(2)}</td>
                            ))}
                            <td>{row.max_regret.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="fine">
                    보고서는 최대 후회가 가장 작은 B안을 권고합니다. E안은
                    누나의 금전 기여를 0원으로 유지한다는 가족의 제약에 따라
                    제외했습니다.
                  </p>
                </ReportInsights>{" "}
              </div>
            )}
            {page === "trusts" && (
              <TrustLibrary
                sources={sources}
                loadError={catalogError}
                onAsk={askSource}
              />
            )}
            {page === "settings" && (
              <>
                <PreferencesPanel
                  value={preferences}
                  onChange={setPreferences}
                />
                <FormulaReference />
              </>
            )}
            <div hidden={page !== "events"}>
              <section className="card">
                <h2>보고서 기준으로 바로 시작</h2>
                <p>
                  보고서 기준 가정에서 아래 조건을 바꾼 예시입니다. 적용하면
                  현재 입력이 예시의 가정으로 바뀝니다. 비교할 입력은 먼저
                  시뮬레이터에서 저장해 두세요.
                </p>
                <div className="consumer-cases">
                  {caseExamples.map((example) => (
                    <article key={example.title}>
                      <h3>{example.title}</h3>
                      <p>{example.detail}</p>
                      <button
                        disabled={busy}
                        onClick={async () => {
                          if (
                            await apply(
                              { ...ref.defaults, ...example.changes },
                              "B",
                            )
                          ) {
                            location.hash = "simulation";
                            setNotice(
                              example.title +
                                " 사례를 적용했습니다. B 단계 적립을 기준으로 계산했습니다.",
                            );
                          }
                        }}
                      >
                        이 사례로 계산
                      </button>
                    </article>
                  ))}
                </div>
              </section>
              <section className="card" id="events-panel">
                <h2>샘플 사건</h2>
                <p>
                  유형과 상황을 고르면 현재 가정에서 해당 값만 바꿔 계산할 수
                  있습니다.
                </p>
                <div
                  className="care-event-types"
                  role="group"
                  aria-label="사건 유형"
                >
                  {sampleEventGroups.map((group) => (
                    <button
                      type="button"
                      key={group.field}
                      disabled={busy}
                      aria-pressed={group === eventGroup}
                      onClick={() => {
                        if (group === eventGroup) return;
                        setEventGroup(group);
                        setEventValue(null);
                        setEventApplied(false);
                      }}
                    >
                      {group.title}
                    </button>
                  ))}
                </div>
                <div
                  className="care-event-options"
                  role="group"
                  aria-label={`${eventGroup.title} 상황 선택`}
                >
                  {eventGroup.options.map((event) => (
                    <button
                      type="button"
                      disabled={busy}
                      key={event.value}
                      aria-pressed={event.value === eventValue}
                      onClick={() => {
                        setEventValue(event.value);
                        setEventApplied(false);
                      }}
                    >
                      <strong>{event.label}</strong>
                      <span>
                        {eventGroup.monthly && "월 "}
                        {display(eventGroup.field, event.value)}
                      </span>
                    </button>
                  ))}
                </div>
                {eventValue !== null && (
                  <div className="care-event-preview">
                    <h3>{ref.fields[eventGroup.field].label}</h3>
                    <p>
                      현재{" "}
                      {eventGroup.monthly && "월 "}
                      {display(eventGroup.field, applied[eventGroup.field])}
                      {applied[eventGroup.field] !== eventValue && (
                        <>
                          {" → 사건 적용 시 "}
                          {eventGroup.monthly && "월 "}
                          {display(eventGroup.field, eventValue)}
                        </>
                      )}
                    </p>
                    {hasUnappliedDraft && (
                      <p className="fine">
                        사건을 적용하면 오른쪽의 미적용 입력이 현재 가정으로
                        돌아갑니다.
                      </p>
                    )}
                    <button
                      className="primary"
                      disabled={
                        busy || applied[eventGroup.field] === eventValue
                      }
                      onClick={async () => {
                        const appliedEvent = await apply({
                          ...applied,
                          [eventGroup.field]: eventValue,
                        });
                        setEventApplied(appliedEvent);
                      }}
                    >
                      {busy ? "계산 중…" : "사건 적용하고 계산"}
                    </button>
                    {applied[eventGroup.field] === eventValue && (
                      <p role="status">
                        {eventApplied
                          ? "사건을 적용했습니다."
                          : "현재 같은 값이 적용되어 있습니다."}{" "}
                        <a href="#simulation">시뮬레이션 결과 보기</a>
                        {" · "}
                        <a href="#report">보고서에서 비교</a>
                      </p>
                    )}
                  </div>
                )}
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
            <CaseSlots
              reference={ref}
              slots={caseSlots.slots}
              onWrite={caseSlots.write}
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
              actionsTarget={slotActionsTarget}
              onLoad={(name, slot) =>
                apply(
                  { ...ref.defaults, ...slot.overrides },
                  slot.strategy,
                  name,
                )
              }
              onSave={(name, saved) => {
                if (saved) {
                  setActiveSlot(name);
                  setEditingSlot(null);
                } else if (activeSlot === name) setActiveSlot(null);
                if (!saved && editingSlot === name) setEditingSlot(null);
              }}
              onCompare={setSnapshots}
            />
            <section className="applied-summary" aria-label="현재 적용 요약">
              <div
                className="care-rail-heading"
                id="current-case-summary"
                tabIndex={-1}
              >
                <h2>
                  {activeSlot ? `슬롯 ${activeSlot} 적용 중` : "현재 적용"}
                </h2>
                <span className="applied-strategy">{strategies[strategy]}</span>
              </div>
              <p className="care-applied-inputs">
                <span>
                  생활비{" "}
                  <b>
                    {display("monthly_child_cost", applied.monthly_child_cost)}{" "}
                    / 월
                  </b>
                </span>
                <span>
                  수익률{" "}
                  <b>{display("net_real_return", applied.net_real_return)}</b>
                </span>
                <span>
                  준비 기간{" "}
                  <b>{display("child_end_age", applied.child_end_age)}까지</b>
                </span>
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
            </section>
            <section
              className="card care-assumptions"
              id="settings-panel"
              tabIndex={-1}
            >
              <StepTitle step="01">전략과 가정</StepTitle>
              {editingSlot && (
                <p className="fine" role="status">
                  사례 {editingSlot} 수정 중 · 변경 적용하면 이 사례에
                  저장됩니다.
                </p>
              )}
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
                  void apply(undefined, strategy, null, true);
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
            </section>
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
createRoot(document.getElementById("root")!).render(
  <TrustConversationProvider>
    <App />
  </TrustConversationProvider>,
);
