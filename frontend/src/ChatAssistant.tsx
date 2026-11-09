import React, { useEffect, useRef, useState } from "react";
import { FloatingAssistant } from "./FloatingAssistant.tsx";
import { chatContext, describeChanges, randomSamples } from "./chat.ts";
import { validInputs, type Inputs } from "./storage.ts";
import type { Reference } from "./simulation.ts";

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  changes?: Inputs;
  context?: string;
  stage?: "pending" | "applying" | "applied" | "cancelled";
};
const greeting: Message = {
  id: 0,
  role: "assistant",
  text: "어떤 가정을 바꿔 볼까요? 지원하는 입력의 변경값을 제안해 드릴게요. 확인 후 계산 결과에 반영할 수 있습니다.",
};

export function ChatAssistant({
  reference,
  applied,
  disabled,
  resetKey,
  onApply,
}: {
  reference: Reference;
  applied: Inputs;
  disabled: boolean;
  resetKey: number;
  onApply: (changes: Inputs) => Promise<boolean>;
}) {
  const [messages, setMessages] = useState<Message[]>([greeting]);
  const [sentence, setSentence] = useState("");
  const [loading, setLoading] = useState(false);
  const [examples, setExamples] = useState(() =>
    randomSamples(reference.samples),
  );
  const sequence = useRef(0),
    request = useRef<AbortController | null>(null),
    generation = useRef(0),
    inFlight = useRef(false),
    confirming = useRef(false);
  const thread = useRef<HTMLDivElement>(null),
    composer = useRef<HTMLTextAreaElement>(null);
  const context = chatContext(reference, applied),
    contextRef = useRef(context);
  contextRef.current = context;
  const add = (message: Omit<Message, "id">) => {
    const id = ++sequence.current;
    setMessages((all) => [...all.slice(-23), { ...message, id }]);
  };
  const mark = (id: number, stage: Message["stage"]) =>
    setMessages((all) => all.map((m) => (m.id === id ? { ...m, stage } : m)));
  useEffect(() => {
    generation.current++;
    request.current?.abort();
    inFlight.current = false;
    setLoading(false);
    setMessages([greeting]);
    setSentence("");
    return () => {
      generation.current++;
      request.current?.abort();
    };
  }, [resetKey]);
  useEffect(() => {
    const element = thread.current;
    if (element)
      element.scrollTo({
        top: element.scrollHeight,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
  }, [messages, loading]);
  async function send() {
    const text = sentence.trim();
    if (!text || disabled || inFlight.current || confirming.current) return;
    const capturedContext = contextRef.current,
      id = ++generation.current;
    const controller = new AbortController();
    request.current = controller;
    inFlight.current = true;
    setMessages((all) =>
      all.map((m) =>
        m.stage === "pending" ? { ...m, stage: "cancelled" } : m,
      ),
    );
    add({ role: "user", text });
    setSentence("");
    setLoading(true);
    try {
      const response = await fetch("/api/parse-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(25000),
        ]),
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      if (id !== generation.current) return;
      if (!response.ok)
        throw new Error(
          data.message ?? "변경 제안을 받지 못했습니다. 다시 보내주세요.",
        );
      if (
        data.status !== "proposal" ||
        data.requires_confirmation !== true ||
        !validInputs(data.changes, reference.fields) ||
        !Object.keys(data.changes).length
      )
        throw new Error(
          "지원하지 않는 변경 제안입니다. 입력을 직접 바꾸거나 다시 보내주세요.",
        );
      if (contextRef.current !== capturedContext) {
        add({
          role: "assistant",
          text: "요청 중 적용 입력이 바뀌어 이전 제안은 사용하지 않았어요. 현재 입력을 기준으로 다시 보내주세요.",
        });
        return;
      }
      add({
        role: "assistant",
        text: `다음과 같이 바꿀 수 있어요.\n${describeChanges(reference.fields, applied, data.changes)}\n확인하고 적용해 주세요.`,
        changes: data.changes,
        context: capturedContext,
        stage: "pending",
      });
    } catch (error) {
      if (id !== generation.current) return;
      add({
        role: "assistant",
        text:
          error instanceof Error && error.name !== "TimeoutError"
            ? error.message
            : "응답이 늦어지고 있어요. 다시 보내거나 전략과 가정에서 직접 입력해 주세요.",
      });
    } finally {
      if (id === generation.current) {
        inFlight.current = false;
        setLoading(false);
      }
    }
  }
  async function confirm(message: Message) {
    if (
      confirming.current ||
      disabled ||
      loading ||
      message.stage !== "pending" ||
      !message.changes ||
      message.context !== contextRef.current
    )
      return;
    confirming.current = true;
    const before = { ...applied };
    const capturedGeneration = generation.current;
    mark(message.id, "applying");
    let ok = false;
    try {
      ok = await onApply(message.changes);
    } catch {
      ok = false;
    } finally {
      confirming.current = false;
    }
    if (capturedGeneration !== generation.current) return;
    mark(message.id, ok ? "applied" : "pending");
    add({
      role: "assistant",
      text: ok
        ? `요청하신 변경을 계산 결과에 반영했어요.\n${describeChanges(reference.fields, before, message.changes)}`
        : "변경을 적용하지 못했어요. 다시 적용하거나 전략과 가정에서 직접 입력해 주세요.",
    });
  }
  return (
    <FloatingAssistant>
      <div
        className="chat-thread"
        ref={thread}
        role="log"
        aria-label="입력 변경 대화"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {messages.map((m) => (
          <div key={m.id} className={`chat-message ${m.role}`}>
            <span className="chat-speaker">
              {m.role === "user" ? "나" : "입력 도우미"}
            </span>
            <div className="chat-bubble">{m.text}</div>
            {m.changes && m.stage === "pending" && m.context === context && (
              <div className="chat-confirm">
                <button
                  className="primary"
                  disabled={disabled || loading}
                  onClick={() => void confirm(m)}
                >
                  확인하고 적용
                </button>
                <button
                  disabled={disabled || loading}
                  onClick={() => mark(m.id, "cancelled")}
                >
                  취소
                </button>
              </div>
            )}
            {m.stage === "pending" && m.context !== context && (
              <small className="chat-state">입력이 바뀐 이전 제안</small>
            )}
            {m.stage === "applying" && (
              <small className="chat-state">계산 결과에 반영 중…</small>
            )}
            {m.stage === "applied" && (
              <small className="chat-state">적용 완료</small>
            )}
            {m.stage === "cancelled" && (
              <small className="chat-state">사용하지 않은 제안</small>
            )}
          </div>
        ))}
        {loading && (
          <div className="chat-message assistant">
            <div className="chat-bubble chat-typing" role="status">
              변경 제안을 확인하고 있어요<span aria-hidden="true"> ···</span>
            </div>
          </div>
        )}
      </div>
      <div className="chat-bottom">
        <div className="suggestions-heading">
          <span>이렇게 물어보세요</span>
          <button
            aria-label="예시 질문 새로 고르기"
            onClick={() => setExamples(randomSamples(reference.samples))}
          >
            ↻
          </button>
        </div>
        <div className="chat-suggestions" aria-label="옆으로 넘기는 예시 질문">
          {examples.map((s) => (
            <button
              key={s.id}
              disabled={loading || disabled}
              title="입력창에 넣기"
              onClick={() => {
                setSentence(s.text);
                composer.current?.focus({ preventScroll: true });
              }}
            >
              {s.text}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label className="chat-input-label" htmlFor="chat-input">
            자연어 변경 문장
          </label>
          <textarea
            id="chat-input"
            ref={composer}
            aria-label="자연어 변경 문장"
            rows={2}
            maxLength={120}
            value={sentence}
            placeholder="예: 생활비가 월 185만 원이면?"
            disabled={loading || disabled}
            onChange={(e) => setSentence(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            className="primary chat-send"
            aria-label="변경 요청 보내기"
            disabled={loading || disabled || !sentence.trim()}
          >
            {loading ? "제안 확인 중…" : "보내기"}
            <span aria-hidden="true">↗</span>
          </button>
        </form>
        <details className="chat-privacy">
          <summary>지원 범위·개인정보 안내</summary>
          <p>
            예시의 지원 필드·값·단위만 보내주세요. 이름·연락처·건강정보는
            입력하지 마세요. AI는 변경값만 제안하며 계산은 확인 후 기존 계산기로
            수행합니다.
          </p>
        </details>
      </div>
    </FloatingAssistant>
  );
}
