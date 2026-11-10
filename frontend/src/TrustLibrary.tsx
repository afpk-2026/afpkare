import React, { useEffect, useRef, useState } from "react";

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
  return (
    <>
      <section className="card care-directory">
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
      </section>
      <section className="card care-directory">
        <div className="directory-heading">
          <h2>신탁 자료</h2>
          <span>공식 문서</span>
        </div>
        <p>
          상품을 선택하면 공식 자료가 열립니다. 자세한 내용은 공식 문서 기반 AI
          도우미에게 물어보세요.
        </p>
        {loadError && (
          <p role="alert">
            신탁 자료를 불러오지 못했습니다. 새로고침해 다시 시도해 주세요.
          </p>
        )}
        {!loadError && !sources.length && (
          <p role="status">신탁 자료를 불러오고 있습니다.</p>
        )}
        <div className="care-library-grid trust-grid">
          {sources
            .filter((source) => source.bank)
            .map((source) => (
              <article
                className="care-library-item"
                key={source.id}
                data-source-id={source.id}
              >
                <div className="trust-item-copy">
                  <p>
                    {source.bank} · {source.category}
                  </p>
                  <h3>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.title} <span aria-hidden="true">↗</span>
                    </a>
                  </h3>
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
  const [answer, setAnswer] = useState<{
    mode: string;
    sources: TrustSource[];
  } | null>(null);
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function ask(ids: string[]) {
    controller.current?.abort();
    setAnswer(null);
    if (!ids.length) {
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
        body: JSON.stringify({ source_ids: ids }),
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(25000)]),
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (!abort.signal.aborted) {
        setAnswer(result);
        setMessage(
          result.mode === "llm_sources"
            ? "AI가 고른 공식 자료"
            : "공식 자료 요약",
        );
      }
    } catch {
      if (!abort.signal.aborted)
        setMessage("자료 설명 요청을 완료하지 못했습니다. 다시 시도해 주세요.");
    }
  }
  useEffect(() => {
    if (request) void ask(request.ids);
  }, [request]);
  return (
    <>
      <div className="chat-thread" role="log" aria-label="공식 신탁 자료 설명">
        <p>
          {message ||
            "은행 이름, 상품 이름, 유언대용신탁 같은 용어로 공식 자료를 찾아보세요."}
        </p>
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
          void ask(matchingSources(query, sources));
          setQuery("");
        }}
      >
        <label htmlFor="trust-query">공식 자료에서 찾아보기</label>
        <input
          id="trust-query"
          maxLength={120}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="예: 하나 리빙트러스트"
        />
        <button className="primary" disabled={!query.trim()}>
          자료 찾기
        </button>
        <small>
          입력한 문구는 이 브라우저에서 자료와 대조합니다. 서버에는 연결된 공식
          자료의 식별자만 전송합니다.
        </small>
      </form>
    </>
  );
}
