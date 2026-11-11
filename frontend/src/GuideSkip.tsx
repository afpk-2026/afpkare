import React from "react";
import { createPortal } from "react-dom";

export function GuideSkip({
  disabled = false,
  onSkip,
}: {
  disabled?: boolean;
  onSkip: () => void;
}) {
  return createPortal(
    <button
      type="button"
      className="guide-skip"
      disabled={disabled}
      onClick={onSkip}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !disabled) onSkip();
      }}
    >
      건너뛰기
    </button>,
    document.body,
  );
}
