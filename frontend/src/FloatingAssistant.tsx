import React, { useEffect, useRef, useState } from "react";

export function FloatingAssistant({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const close = () => {
    setOpen(false);
    launcher.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() =>
      panel.current
        ?.querySelector<HTMLElement>("input:not(:disabled), button")
        ?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [open]);
  return (
    <div className="floating-assistant">
      <section
        ref={panel}
        id="assistant-panel"
        className="assistant-panel"
        role="dialog"
        aria-labelledby="assistant-title"
        hidden={!open}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            close();
          }
        }}
      >
        <header className="assistant-header">
          <div>
            <span>AI INPUT ASSISTANT</span>
            <h2 id="assistant-title">말로 바꾸는 가정</h2>
          </div>
          <button aria-label="AI 입력 도우미 닫기" onClick={close}>
            ×
          </button>
        </header>
        <div className="assistant-body">{children}</div>
      </section>
      <button
        className="assistant-launcher"
        ref={launcher}
        aria-expanded={open}
        aria-controls="assistant-panel"
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span aria-hidden="true">✦</span>
        {open ? "도우미 접기" : "AI로 입력 바꾸기"}
      </button>
    </div>
  );
}
