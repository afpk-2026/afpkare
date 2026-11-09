import React from "react";
export function StepTitle({
  step,
  children,
  id,
}: {
  step: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <h2 className="step-title" id={id}>
      <span className="step-number">{step}</span>
      {children}
    </h2>
  );
}
