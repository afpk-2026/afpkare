import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Snapshot } from "./analysis.ts";
import { requestSimulation, type Reference } from "./simulation.ts";
import { validInputs, type Saved } from "./storage.ts";

const key = "family-finance:case-slots";
const names = ["A", "B", "C", "D"] as const;
export type SlotName = (typeof names)[number];
type Slots = Partial<Record<SlotName, Saved>>;

function readSlots(reference: Reference): Slots {
  try {
    const data = JSON.parse(localStorage.getItem(key) ?? "{}");
    const slots: Slots = {};
    for (const name of names) {
      const entry = data?.[name];
      if (
        entry &&
        entry.schema_version === 1 &&
        entry.case_id === reference.case_id &&
        entry.source_version === reference.source_version &&
        (entry.strategy === "B" || entry.strategy === "B_PRIME") &&
        validInputs(entry.overrides, reference.fields)
      ) {
        slots[name] = {
          schema_version: 1,
          case_id: reference.case_id,
          source_version: reference.source_version,
          strategy: entry.strategy,
          overrides: entry.overrides,
        };
      }
    }
    return slots;
  } catch {
    return {};
  }
}

export function CaseSlots({
  reference,
  current,
  disabled,
  activeSlot,
  actionsTarget,
  onLoad,
  onSave,
  onCompare,
}: {
  reference: Reference;
  current: Saved | null;
  disabled: boolean;
  activeSlot: SlotName | null;
  actionsTarget: HTMLDivElement | null;
  onLoad: (name: SlotName, slot: Saved) => Promise<boolean>;
  onSave: (name: SlotName, saved: boolean) => void;
  onCompare: (snapshots: Snapshot[]) => void;
}) {
  const [slots, setSlots] = useState(() => readSlots(reference));
  const [selected, setSelected] = useState<SlotName>("A");
  const [notice, setNotice] = useState("");
  const [comparisonNotice, setComparisonNotice] = useState("");
  useEffect(() => {
    const update = (event: StorageEvent) => {
      if (!event.key || event.key === key) setSlots(readSlots(reference));
    };
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, [reference]);
  useEffect(() => {
    const controller = new AbortController();
    onCompare([]);
    setComparisonNotice("");
    const active = names.filter((name) => slots[name]);
    if (!active.length) return;
    setComparisonNotice("슬롯 비교를 다시 계산하고 있어요.");
    void Promise.allSettled(
      active.map(async (name) => {
        const slot = slots[name]!;
        const result = await requestSimulation(
          reference,
          { ...reference.defaults, ...slot.overrides },
          slot.strategy,
          controller.signal,
        );
        return {
          id: name,
          label: `슬롯 ${name}`,
          captured_at: new Date().toISOString(),
          case_id: slot.case_id,
          source_version: slot.source_version,
          result,
        };
      }),
    ).then((outcomes) => {
      if (controller.signal.aborted) return;
      onCompare(
        outcomes.flatMap((outcome) =>
          outcome.status === "fulfilled" ? [outcome.value] : [],
        ),
      );
      setComparisonNotice(
        outcomes.some((outcome) => outcome.status === "rejected")
          ? "일부 슬롯의 비교를 계산하지 못했습니다. 슬롯을 불러와 다시 시도하세요."
          : "",
      );
    });
    return () => controller.abort();
  }, [slots, reference, onCompare]);
  function write(value?: Saved) {
    try {
      const next = readSlots(reference);
      if (value) next[selected] = value;
      else delete next[selected];
      if (Object.keys(next).length)
        localStorage.setItem(key, JSON.stringify(next));
      else localStorage.removeItem(key);
      setSlots(next);
      onSave(selected, !!value);
      setNotice(
        `슬롯 ${selected}${value ? "에 적용한 가정을 저장했습니다." : "를 비웠습니다."}`,
      );
    } catch {
      setNotice("브라우저 저장소에 쓸 수 없습니다.");
    }
  }
  const slot = slots[selected];
  return (
    <section className="card care-slots" aria-label="가상 사례 저장 슬롯">
      <h2>사례 슬롯</h2>
      <div className="care-slot-buttons" aria-label="슬롯 선택">
        {names.map((name) => (
          <button
            key={name}
            aria-pressed={selected === name}
            aria-current={activeSlot === name ? "true" : undefined}
            disabled={disabled}
            aria-label={`슬롯 ${name} · ${slots[name] ? "저장됨" : "비어 있음"}`}
            onClick={async () => {
              const saved = slots[name];
              setNotice("");
              if (saved && !(await onLoad(name, saved))) return;
              setSelected(name);
            }}
          >
            {name}
            <small>{slots[name] ? "저장됨" : "비어 있음"}</small>
          </button>
        ))}
      </div>
      {actionsTarget &&
        createPortal(
          <section
            className="card care-slot-management"
            aria-label="사례 슬롯 관리"
          >
            <h2>사례 슬롯 관리</h2>
            <p>
              {slot
                ? `${selected} · 전략 ${slot.strategy === "B" ? "B" : "B′"} · ${slot.overrides.child_end_age ?? reference.defaults.child_end_age}세까지`
                : `슬롯 ${selected}가 비어 있어요.`}
            </p>
            <div className="care-slot-actions">
              <button
                disabled={disabled || !current}
                onClick={() => {
                  if (
                    current &&
                    (!slot ||
                      window.confirm(
                        `슬롯 ${selected}의 기존 가정을 덮어쓸까요?`,
                      ))
                  )
                    write(current);
                }}
              >
                현재 적용값 저장
              </button>
              <button
                disabled={disabled || !slot}
                onClick={() => {
                  if (
                    window.confirm(`슬롯 ${selected}의 가상 사례를 삭제할까요?`)
                  )
                    write();
                }}
              >
                비우기
              </button>
            </div>
            {(notice || comparisonNotice) && (
              <p role="status">{notice || comparisonNotice}</p>
            )}
          </section>,
          actionsTarget,
        )}
    </section>
  );
}
