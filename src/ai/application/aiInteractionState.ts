/**
 * Connected AI UX states. The assistant never silently substitutes demo output
 * for an unavailable connected runtime; it reports an explicit state instead.
 */
import { normalizeApplicationError } from "@/shared/domain";

export type AiInteractionState =
  | "idle"
  | "loading"
  | "streaming"
  | "success"
  | "permission_denied"
  | "approval_required"
  | "context_unavailable"
  | "provider_unavailable"
  | "rate_limited"
  | "execution_failure"
  | "retryable_failure";

export const AI_RETRYABLE_STATES: readonly AiInteractionState[] = [
  "rate_limited",
  "retryable_failure",
];

/** Maps a thrown runtime failure onto a stable UI state, never onto error.message. */
export function resolveAiInteractionState(error: unknown): AiInteractionState {
  const normalized = normalizeApplicationError(error);
  if (normalized.code === "CONTRACT_OPERATION_BLOCKED") return "provider_unavailable";
  if (normalized.code === "AI_CONTEXT_UNAVAILABLE") return "context_unavailable";
  switch (normalized.category) {
    case "AUTHORIZATION":
    case "AUTHENTICATION":
      return "permission_denied";
    case "RATE_LIMIT":
      return "rate_limited";
    case "NETWORK":
    case "INTEGRATION":
    case "INFRASTRUCTURE":
      return "provider_unavailable";
    case "TIMEOUT":
      return "retryable_failure";
    case "NOT_FOUND":
      return "context_unavailable";
    default:
      return normalized.retryable ? "retryable_failure" : "execution_failure";
  }
}

export function isRetryableAiInteractionState(state: AiInteractionState): boolean {
  return AI_RETRYABLE_STATES.includes(state);
}
