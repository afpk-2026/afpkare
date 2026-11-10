import React, { useEffect, useState } from "react";
import { LandingPreview, ServiceOverview } from "./ServiceOverview.tsx";
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

export function Entrance({ onEnter }: { onEnter: () => void }) {
  const [signedIn, setSignedIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    sessionRequest("")
      .then((value) => {
        if (!active || !value) return;
        setSignedIn(true);
        if (
          [
            "#simulation",
            "#report",
            "#formulas",
            "#events",
            "#trusts",
            "#settings",
          ].includes(window.location.hash)
        )
          onEnter();
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [onEnter]);
  function start() {
    if (signedIn) {
      onEnter();
      return;
    }
    setShowLogin(true);
    requestAnimationFrame(() =>
      document.getElementById("demo-password")?.focus(),
    );
  }
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
      if (await sessionRequest("/login", { password })) {
        setPassword("");
        onEnter();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
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
          <button className="primary" onClick={start}>
            {signedIn ? "시뮬레이터 열기" : "로그인"}
          </button>
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
              <button className="primary" onClick={start}>
                시뮬레이터 시작하기 <span aria-hidden="true">↗</span>
              </button>
              <a href="#about">서비스 알아보기</a>
            </div>
          </div>
          <LandingPreview />
        </section>
        {showLogin && (
          <section className="card care-login" aria-labelledby="login-title">
            <h2 id="login-title">데모 로그인</h2>
            <p>운영자에게 받은 공용 데모 비밀번호를 입력하세요.</p>
            <form onSubmit={submit}>
              <label htmlFor="demo-password">데모 비밀번호</label>
              <input
                id="demo-password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button className="primary" disabled={busy}>
                {busy ? "확인 중…" : "로그인"}
              </button>
            </form>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
          </section>
        )}
        <ServiceOverview onStart={start} />
      </main>
      <footer className="landing-footer">
        <strong>케어 파트너스</strong>
        <p>AFPK 영 플래너 챌린지 2026 제출작</p>
      </footer>
      <FloatingAssistant initiallyOpen={false} title="케어 파트너스 안내">
        <div className="chat-thread">
          <p>
            가상 사례 계산과 공식 신탁 자료 설명은 로그인 후 이용할 수 있어요.
          </p>
          <button className="primary" onClick={start}>
            데모 로그인 열기
          </button>
        </div>
      </FloatingAssistant>
    </>
  );
}
