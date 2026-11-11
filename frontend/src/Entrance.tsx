import React, { useEffect, useRef, useState } from "react";
import { LandingPreview, ServiceOverview } from "./ServiceOverview.tsx";
import { FormulaReference } from "./FormulaReference.tsx";
import { TrustChat, type TrustSource } from "./TrustLibrary.tsx";
import { FloatingAssistant } from "./FloatingAssistant.tsx";

export async function sessionRequest(path: string, body?: object) {
  const response = await fetch("/api/session" + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || typeof data?.authenticated !== "boolean")
    throw new Error(
      data?.message ??
        "로그인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  return data.authenticated as boolean;
}

export function SessionControl() {
  const [signedIn, setSignedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void sessionRequest("")
        .then((value) => {
          if (active) setSignedIn(value);
        })
        .catch(() => {});
    };
    refresh();
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(timer);
    };
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (
      location.protocol !== "https:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)
    ) {
      setError("HTTPS 주소에서 로그인해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (await sessionRequest("/login", { username, password })) {
        setPassword("");
        setSignedIn(true);
        dialog.current?.close();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError("");
    try {
      setSignedIn(await sessionRequest("/logout", {}));
    } catch {
      setError("로그아웃을 완료하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className={signedIn ? undefined : "primary"}
        disabled={busy}
        onClick={() => {
          if (signedIn) void logout();
          else {
            setError("");
            dialog.current?.showModal();
          }
        }}
      >
        {signedIn ? "로그아웃" : "로그인"}
      </button>
      {signedIn && error && <span role="alert">{error}</span>}
      <dialog
        className="card care-session-dialog"
        ref={dialog}
        aria-labelledby="login-title"
        aria-describedby="login-help"
        onClose={() => {
          setPassword("");
        }}
      >
        <div className="login-heading">
          <h2 id="login-title">로그인</h2>
          <button
            type="button"
            aria-label="로그인 창 닫기"
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        <p id="login-help">
          로그인 없이도 시뮬레이터와 신탁 자료 검색을 이용할 수 있습니다.
        </p>
        <p className="fine">
          운영자에게 전달받은 아이디와 비밀번호를 입력하세요.
        </p>
        <form onSubmit={submit}>
          <label htmlFor="login-username">아이디</label>
          <input
            id="login-username"
            name="username"
            autoComplete="username"
            required
            maxLength={128}
            placeholder="아이디를 입력하세요"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <label htmlFor="demo-password">비밀번호</label>
          <input
            id="demo-password"
            name="password"
            placeholder="비밀번호를 입력하세요"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button className="primary" disabled={busy}>
            {busy ? "확인 중…" : "로그인"}
          </button>
          <button
            className="login-guest"
            type="button"
            onClick={() => dialog.current?.close()}
          >
            로그인 없이 계속하기
          </button>
        </form>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </dialog>
    </>
  );
}

export function Entrance({ onEnter }: { onEnter: () => void }) {
  const [sources, setSources] = useState<TrustSource[]>([]);
  const [sourceError, setSourceError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setSourceError(false);
    fetch("/api/trust-sources", {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
    })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data: { sources: TrustSource[] }) => {
        if (!controller.signal.aborted)
          setSources(
            data.sources.map((source) => ({
              ...source,
              url: source.url === "#formulas" ? "#formula-panel" : source.url,
            })),
          );
      })
      .catch(() => {
        if (!controller.signal.aborted) setSourceError(true);
      });
    return () => controller.abort();
  }, [retry]);
  return (
    <div className="care-home">
      <header className="care-header">
        <a href="#" className="brand">
          <span className="brandmark" aria-hidden="true">
            ♥
          </span>
          <strong>케어 파트너스</strong>
        </a>
        <nav aria-label="홈 메뉴">
          <a href="#about">서비스 소개</a>
          <a href="#workflow">이용 방법</a>
          <a href="#impact">계산 체험</a>
          <a href="#evidence">자료와 근거</a>
          <a href="#privacy">개인정보와 접근성</a>
          <SessionControl />
        </nav>
      </header>
      <main className="care-landing">
        <section className="care-hero">
          <div>
            <p className="eyebrow">CARE PARTNERS</p>
            <h1>
              두 세대의 내일,
              <br />
              하나의 계획으로.
            </h1>
            <p>
              부모의 노후와 자녀의 생활을 가상 사례로 함께 살펴보세요. 가정을
              바꾸고 재무설계 보고서의 산식과 결과를 확인할 수 있습니다.
            </p>
            <div className="care-hero-actions">
              <button className="primary" onClick={onEnter}>
                시뮬레이터 시작하기 <span aria-hidden="true">↗</span>
              </button>
              <a href="#about">서비스 알아보기</a>
            </div>
          </div>
          <LandingPreview />
        </section>
        <ServiceOverview onStart={onEnter} />
        <FormulaReference />
      </main>
      <footer className="landing-footer">
        <strong>케어 파트너스</strong>
        <p>AFPK 영 플래너 챌린지 2026 제출작</p>
      </footer>
      <FloatingAssistant title="신탁과 재무설계 자료 도우미">
        {sourceError && (
          <p role="alert" className="fine">
            자료 목록을 불러오지 못했습니다.{" "}
            <button onClick={() => setRetry((value) => value + 1)}>
              다시 연결
            </button>
          </p>
        )}
        <TrustChat
          sources={sources}
          request={null}
          formulaHref="#formula-panel"
        />
      </FloatingAssistant>
    </div>
  );
}
