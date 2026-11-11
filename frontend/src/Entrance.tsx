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
  const [registering, setRegistering] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState("");
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
    if (registering && password !== confirmation) {
      setError("비밀번호 확인 값이 다릅니다.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (registering) {
        const response = await fetch("/api/session/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
          signal: AbortSignal.timeout(10000),
        });
        const data = await response.json();
        if (!response.ok || data.registered !== true)
          throw new Error(data.message ?? "입력 형식을 확인해 주세요.");
        setRegistering(false);
        setPassword("");
        setConfirmation("");
        setNotice(
          "가입이 완료되었습니다. 아이디와 비밀번호로 로그인해 주세요.",
        );
        return;
      }
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
            setNotice("");
            setRegistering(false);
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
          setConfirmation("");
        }}
      >
        <div className="login-heading">
          <h2 id="login-title">{registering ? "회원가입" : "로그인"}</h2>
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
        <form onSubmit={submit}>
          <label htmlFor="login-username">아이디</label>
          <input
            id="login-username"
            name="username"
            autoComplete="username"
            pattern={
              registering ? "[a-zA-Z0-9][a-zA-Z0-9_.-]{2,31}" : undefined
            }
            required
            maxLength={128}
            placeholder="아이디를 입력하세요"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          {registering && (
            <p className="fine">
              아이디는 영문·숫자로 시작하는 3~32자입니다. 점·밑줄·하이픈을
              사용할 수 있으며 대소문자를 구분하지 않습니다.
            </p>
          )}
          <label htmlFor="demo-password">비밀번호</label>
          <input
            id="demo-password"
            name="password"
            placeholder="비밀번호를 입력하세요"
            type="password"
            autoComplete={registering ? "new-password" : "current-password"}
            minLength={registering ? 12 : undefined}
            required
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {registering && (
            <>
              <p className="fine">비밀번호는 12~128자로 입력하세요.</p>
              <label htmlFor="password-confirmation">비밀번호 확인</label>
              <input
                id="password-confirmation"
                type="password"
                autoComplete="new-password"
                required
                maxLength={128}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "확인 중…" : registering ? "가입하기" : "로그인"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setRegistering(!registering);
              setPassword("");
              setConfirmation("");
              setError("");
              setNotice("");
            }}
          >
            {registering ? "로그인으로 돌아가기" : "계정 만들기"}
          </button>
          <button
            className="login-guest"
            type="button"
            onClick={() => dialog.current?.close()}
          >
            로그인 없이 계속하기
          </button>
        </form>
        {notice && <p role="status">{notice}</p>}
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
