import React, { useEffect, useId, useRef, useState } from "react";

export type TrustSource = {
  id: string;
  bank: string;
  title: string;
  category: string;
  url: string;
  document: string;
  terms: string[];
  summary: string;
};
export type SourceRequest = { ids: string[]; sequence: number };
const banks = [
  ["KB국민은행", "kb.png", "https://www.kbstar.com/"],
  ["신한은행", "sh.ico", "https://www.shinhan.com/"],
  ["하나은행", "ha.png", "https://www.hanabank.com/"],
  ["우리은행", "wr.png", "https://www.wooribank.com/"],
  ["NH농협은행", "nh.png", "https://banking.nonghyup.com/"],
  ["IBK기업은행", "ibk.gif", "https://www.ibk.co.kr/"],
  ["카카오뱅크", "k.svg", "https://www.kakaobank.com/"],
  ["토스뱅크", "t.png", "https://www.tossbank.com/"],
];

const bankImages = new Map(banks.map(([name, image]) => [name, image]));

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^가-힣a-z0-9]/g, "");
export function matchingSources(text: string, sources: TrustSource[]) {
  const value = normalize(text);
  if (value.length < 2 || value.length > 180) return [];
  const matches = sources.map((source) => {
    const name = normalize(source.title);
    if (value.includes(name)) return { source, score: name.length + 100 };
    const terms = [...source.terms, source.category, source.bank].map(
      normalize,
    );
    const score = Math.max(
      0,
      ...terms.map((term) =>
        value.includes(term) || (value.length >= 3 && term.includes(value))
          ? Math.min(term.length, value.length)
          : 0,
      ),
    );
    return { source, score };
  });
  return matches
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((match) => match.source.id);
}

export function TrustLibrary({
  sources,
  onAsk,
  loadError,
}: {
  sources: TrustSource[];
  onAsk: (ids: string[]) => void;
  loadError: boolean;
}) {
  const [search, setSearch] = useState("");
  const [purpose, setPurpose] = useState("");
  const products = sources.filter((source) => source.bank);
  const categories = [...new Set(products.map((source) => source.category))];
  const filtered = products.filter(
    (source) =>
      (!purpose || source.category === purpose) &&
      normalize(
        [
          source.bank,
          source.title,
          source.category,
          source.summary,
          ...source.terms,
        ].join(" "),
      ).includes(normalize(search)),
  );
  return (
    <>
      <details className="card care-directory">
        <summary>은행 공식 홈페이지 찾아보기</summary>
        <div className="directory-heading">
          <h2>은행 바로가기</h2>
          <span>8개 기관</span>
        </div>
        <p>은행 로고를 선택하면 공식 홈페이지가 열립니다.</p>
        <div className="care-library-grid bank-grid">
          {banks.map(([name, image, url]) => (
            <a
              className="care-bank-card"
              key={name}
              href={url}
              target="_blank"
              rel="noreferrer"
              aria-label={`${name} 공식 홈페이지 (새 창)`}
            >
              <img src={`/banks/${image}`} alt="" loading="lazy" />
              <strong>{name}</strong>
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      </details>
      <section className="card care-directory">
        <div className="directory-heading">
          <h2>신탁 자료</h2>
          <span>공식 문서</span>
        </div>
        <p>
          상품을 선택하면 공식 자료가 열립니다. 자세한 내용은 공식 문서 기반 AI
          도우미에게 물어보세요.
        </p>
        <div className="product-search">
          <label>
            어떤 준비가 필요한가요?
            <select
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
            >
              <option value="">모든 목적</option>
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            은행·상품·관심 내용 검색
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="예: 후견인, 하나, 사후 지급"
            />
          </label>
        </div>
        {products.length > 0 && (
          <p role="status">{filtered.length}개 자료를 찾았습니다.</p>
        )}
        {products.length > 0 && filtered.length === 0 && (
          <button
            onClick={() => {
              setSearch("");
              setPurpose("");
            }}
          >
            검색 조건 초기화
          </button>
        )}
        {loadError && (
          <p role="alert">
            신탁 자료를 불러오지 못했습니다. 새로고침해 다시 시도해 주세요.
          </p>
        )}
        {!loadError && !sources.length && (
          <p role="status">신탁 자료를 불러오고 있습니다.</p>
        )}
        <div className="care-library-grid trust-grid">
          {filtered.map((source) => (
            <article
              className="care-library-item"
              key={source.id}
              data-source-id={source.id}
            >
              <div className="trust-item-copy">
                <p className="trust-bank-label">
                  {bankImages.has(source.bank) && (
                    <img
                      src={`/banks/${bankImages.get(source.bank)}`}
                      alt=""
                      loading="lazy"
                    />
                  )}
                  {source.bank} · {source.category}
                </p>
                <h3>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.title} <span aria-hidden="true">↗</span>
                  </a>
                </h3>
                <p>{source.summary}</p>
                <p className="fine">
                  상담 시 최소 가입금액, 보수, 추가 납입, 지급 조건을
                  확인하세요.
                </p>
              </div>
              <button
                aria-label={`${source.title} AI로 자료 읽기`}
                onClick={() => onAsk([source.id])}
              >
                <span aria-hidden="true">✦</span> AI 설명
              </button>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export function TrustChat({
  sources,
  request,
}: {
  sources: TrustSource[];
  request: SourceRequest | null;
}) {
  const [query, setQuery] = useState("");
  const [semanticSearch, setSemanticSearch] = useState(false);
  const [answer, setAnswer] = useState<{
    mode: string;
    sources: TrustSource[];
  } | null>(null);
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  const searchInput = useRef<HTMLTextAreaElement>(null);
  const suggestions = useRef<HTMLDivElement>(null);
  const suggestionsId = useId();
  function scrollSuggestions(direction: number) {
    const row = suggestions.current;
    if (row) row.scrollBy({ left: direction * row.clientWidth });
  }
  useEffect(() => () => controller.current?.abort(), []);
  async function ask(ids: string[], semanticQuery?: string) {
    controller.current?.abort();
    setAnswer(null);
    if (!ids.length && !semanticQuery) {
      setMessage(
        "연결되는 공식 자료가 없어요. 은행명이나 상품 이름으로 찾아보세요.",
      );
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setMessage("공식 자료를 확인하고 있어요.");
    try {
      const response = await fetch("/api/trust-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_ids: ids,
          semantic_query: semanticQuery,
        }),
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(25000)]),
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (!abort.signal.aborted) {
        setAnswer(result);
        setMessage(
          !result.sources.length
            ? semanticQuery && result.mode === "official_sources"
              ? "AI 의미 검색을 사용할 수 없어요. 은행이나 상품 이름으로 기본 검색을 해보세요."
              : "질문과 연결되는 공식 자료를 찾지 못했어요. 은행이나 상품 이름을 함께 입력해 보세요."
            : result.mode === "semantic_llm_sources"
              ? "질문의 의미를 바탕으로 AI가 고른 공식 자료"
              : result.mode === "semantic_sources"
                ? "질문의 의미와 가까운 공식 자료"
                : result.mode === "llm_sources"
                  ? "AI가 고른 공식 자료"
                  : semanticQuery
                    ? "키워드로 찾은 공식 자료"
                    : "공식 자료 요약",
        );
      }
    } catch {
      if (!abort.signal.aborted)
        setMessage("금융 설명 요청을 완료하지 못했습니다. 다시 시도해 주세요.");
    }
  }
  useEffect(() => {
    if (request) void ask(request.ids);
  }, [request]);
  function submitQuery() {
    const search = query.trim();
    if (search.length < 2) return;
    void ask(
      matchingSources(search, sources),
      semanticSearch ? search : undefined,
    );
    setQuery("");
  }
  return (
    <>
      <div
        className="chat-thread"
        role="log"
        aria-label="공식 신탁 자료 기반 금융 설명"
      >
        <div className="chat-message assistant">
          <span className="chat-speaker">자료 도우미</span>
          <div className="chat-bubble">
            {message ||
              "은행 이름, 상품 이름, 유언대용신탁 같은 용어로 공식 자료를 찾아보세요."}
          </div>
        </div>
        {answer?.sources.map((source) => (
          <article className="care-source-answer" key={source.id}>
            <h3>{source.title}</h3>
            <p>{source.summary}</p>
            <a
              href={source.url}
              target={source.url.startsWith("#") ? undefined : "_blank"}
              rel="noreferrer"
            >
              {source.document} ↗
            </a>
          </article>
        ))}
      </div>
      <form
        className="chat-bottom care-source-search"
        onSubmit={(event) => {
          event.preventDefault();
          submitQuery();
        }}
      >
        {sources.length > 0 && (
          <div>
            <div className="suggestions-heading">
              <span>이렇게 물어보세요</span>
              {sources.length > 1 && (
                <div>
                  <button
                    type="button"
                    aria-label="이전 예시 질문"
                    aria-controls={suggestionsId}
                    onClick={() => scrollSuggestions(-1)}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="다음 예시 질문"
                    aria-controls={suggestionsId}
                    onClick={() => scrollSuggestions(1)}
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
            <div
              id={suggestionsId}
              ref={suggestions}
              className="chat-suggestions"
              role="group"
              aria-label="공식 자료 예시 질문"
            >
              {sources.slice(0, 4).map(({ id, title }) => {
                const example = `${title} 관련 공식 자료가 있나요?`;
                return (
                  <button
                    key={id}
                    type="button"
                    title="입력창에 넣기"
                    onClick={() => {
                      setQuery(example);
                      searchInput.current?.focus({ preventScroll: true });
                    }}
                  >
                    {example}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <label className="chat-input-label" htmlFor="trust-query">
          공식 자료에서 찾아보기
        </label>
        <textarea
          id="trust-query"
          ref={searchInput}
          rows={2}
          maxLength={120}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              submitQuery();
            }
          }}
          placeholder="예: 하나 리빙트러스트"
        />
        <label className="trust-semantic-option">
          <input
            type="checkbox"
            checked={semanticSearch}
            onChange={(event) => setSemanticSearch(event.target.checked)}
          />
          AI 의미 검색 · 입력한 검색어를 Upstage에 전송
        </label>
        <button
          className="primary chat-send"
          disabled={query.trim().length < 2}
        >
          자료 찾기
          <span aria-hidden="true">↗</span>
        </button>
        <details className="chat-privacy">
          <summary>지원 범위·개인정보 안내</summary>
          <p>
            기본 검색은 브라우저에서 검색어를 대조하고 공식 자료 식별자만 서버로
            보냅니다. AI 의미 검색을 선택하면 검색어를 Upstage에 보내 관련
            자료를 찾습니다. 이름, 연락처, 계좌번호 같은 개인정보는 입력하지
            마세요.
          </p>
        </details>
      </form>
    </>
  );
}
