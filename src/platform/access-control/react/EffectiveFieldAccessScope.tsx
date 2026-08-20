import React from "react";
import type { FieldAccess } from "../domain/accessControl.types";
import { useEffectiveRecordAccessDecision } from "./EffectiveRecordAccessBoundary";

export interface EffectiveFieldAccessScopeProps {
  fieldKey: string;
  children: React.ReactNode;
  className?: string;
  maskedFallback?: React.ReactNode;
}

export const EffectiveFieldAccessScope: React.FC<EffectiveFieldAccessScopeProps> = ({
  fieldKey,
  children,
  className = "contents",
  maskedFallback,
}) => {
  const access = useEffectiveRecordAccessDecision();
  const mode: FieldAccess = access?.fieldAccess[fieldKey] ?? "READ_WRITE";
  if (mode === "HIDDEN") return null;
  if (mode === "MASKED" && maskedFallback) {
    return <div data-field-key={fieldKey} data-field-access={mode}>{maskedFallback}</div>;
  }
  return (
    <fieldset
      disabled={mode !== "READ_WRITE"}
      data-field-key={fieldKey}
      data-field-access={mode}
      className={className}
    >
      {children}
    </fieldset>
  );
};
