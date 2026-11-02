import { getQuoteApiRuntime } from "../application/composition/quoteApplicationServices";
import { MutationCommandError } from "@/shared/application";
export type { QuoteAcceptanceReadiness } from "../application/read-models/quoteAcceptanceReadiness";
export function readQuoteAcceptanceReadiness(quoteId: string, documentId?: string, signal?: AbortSignal) {
  const runtime = getQuoteApiRuntime();
  if (runtime.mode !== "connected" || !runtime.acceptance) throw new MutationCommandError({ code: "BLOCKED_CONTRACT", category: "INFRASTRUCTURE", message: "Customer acceptance assessment unavailable.", retryable: false });
  return runtime.acceptance.acceptanceReadiness(quoteId, documentId, signal);
}
