import React, { useEffect, useRef, useState } from "react";

export function FloatingAssistant({
  children,
  initiallyOpen = true,
  title = "케어 파트너스 도우미",
  openRequest = 0,
}: {
  children: React.ReactNode;
  initiallyOpen?: boolean;
  title?: string;
  openRequest?: number;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  useEffect(() => {
    if (openRequest) setOpen(true);
  }, [openRequest]);
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const initial = useRef(true);
  const close = () => {
    setOpen(false);
    launcher.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const target = window.matchMedia("(max-width: 760px)").matches
        ? panel.current?.querySelector<HTMLElement>("button")
        : panel.current?.querySelector<HTMLElement>(
            "textarea, input:not(:disabled), button",
          );
      target?.focus({ preventScroll: true });
    });
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
            <h2 id="assistant-title">{title}</h2>
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
        {open ? "도우미 접기" : "AI 도우미 열기"}
      </button>
    </div>
  );
}
