import React, { useEffect, useState } from "react";
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
        if (window.location.hash && window.location.hash !== "#about")
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
          <aside className="care-hero-preview" aria-label="서비스 사용 순서">
            <span>재무 설계 워크스페이스</span>
            <svg viewBox="0 0 290 110" aria-hidden="true">
              <path
                d="M10 102H280 M10 63H280 M10 24H280"
                stroke="#dce4ef"
                fill="none"
              />
              <path
                d="M10 85C55 84 78 34 126 42S191 90 280 32"
                stroke="#004ea2"
                strokeWidth="4"
                fill="none"
              />
              <path
                d="M10 97C66 94 84 72 128 76S218 53 280 67"
                stroke="#b38944"
                strokeWidth="4"
                strokeDasharray="8 5"
                fill="none"
              />
            </svg>
            <ol>
              <li>가정 바꾸기</li>
              <li>자금 경로 비교하기</li>
              <li>보고서와 신탁 자료 살펴보기</li>
            </ol>
          </aside>
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
        <section id="about" className="care-about">
          <p className="eyebrow">ABOUT THE SERVICE</p>
          <h2>케어 파트너스 소개</h2>
          <div className="care-option-grid">
            <article className="card">
              <h3>가정으로 비교하기</h3>
              <p>
                생활비·유족연금·수익률을 바꿔 B와 B′의 자금 경로를 비교합니다.
              </p>
            </article>
            <article className="card">
              <h3>근거까지 확인하기</h3>
              <p>
                재무비율과 보고서 산식, 은행의 공식 신탁 자료를 한 곳에서
                살펴봅니다.
              </p>
            </article>
            <article className="card">
              <h3>브라우저에 가상 사례 보관</h3>
              <p>적용한 입력을 네 개 슬롯에 저장하고 필요할 때 불러옵니다.</p>
            </article>
            <article className="card">
              <h3>읽기 환경 조정</h3>
              <p>글자 크기, 고대비, 색약 모드와 그래프 움직임을 설정합니다.</p>
            </article>
          </div>
        </section>
      </main>
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
