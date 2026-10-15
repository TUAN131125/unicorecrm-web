import React from "react";
import type { DealFormDraft } from "../components/dealFormModel";
import { normalizeApplicationError } from "@/shared/domain";
import { MutationCommandError } from "@/shared/application";
import { getDealSelectionAuthority } from "./useDealSelectionQueries";

/** Retains the exact submitted draft across an ambiguous create acknowledgement. */
export function useDealFormController() {
  const unresolved = React.useRef<DealFormDraft | undefined>(undefined);
  const unresolvedIntent = React.useRef<string | undefined>(undefined);
  const owner = React.useRef(getDealSelectionAuthority());
  const authority = getDealSelectionAuthority();
  if (owner.current !== authority) { unresolved.current = undefined; unresolvedIntent.current = undefined; owner.current = authority; }
  return {
    prepare(draft: DealFormDraft, intentId: string): DealFormDraft {
      if (unresolved.current && JSON.stringify(unresolved.current) !== JSON.stringify(draft))
        throw new MutationCommandError({ code: "DEAL_SAVE_INTENT_PENDING", message: "Retry the original draft to resolve the pending save.", category: "CONFLICT", retryable: false });
      unresolved.current ??= structuredClone(draft);
      unresolvedIntent.current ??= intentId;
      return structuredClone(unresolved.current);
    },
    intentId(fallback: string) { return unresolvedIntent.current ?? fallback; },
    complete() { unresolved.current = undefined; unresolvedIntent.current = undefined; },
    failed(error: unknown) {
      const normalized = normalizeApplicationError(error);
      if (["VALIDATION", "AUTHORIZATION", "NOT_FOUND", "BUSINESS_RULE"].includes(normalized.category)) { unresolved.current = undefined; unresolvedIntent.current = undefined; }
    },
  };
}
