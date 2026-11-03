import React from "react";
import { useEffectiveRecordAccessDecision } from "@/platform/access-control";

/** Explicit field admission; a missing decision never reveals a value. */
export function DealDetailField({ field, children, className = "contents" }: { field: string; children: React.ReactNode; className?: string }) {
  const access = useEffectiveRecordAccessDecision();
  const mode = access?.fieldAccess[field];
  if (!access?.canRead || !mode || mode === "HIDDEN") return null;
  return <div className={className} data-field-key={field} data-field-access={mode}>{mode === "MASKED" ? "—" : children}</div>;
}
