import { getQuoteApiRuntime } from "../application/composition/quoteApplicationServices";
import { MutationCommandError } from "@/shared/application";
export type { AcceptanceCase, AcceptanceProof, ProofEvidenceType, ProofScanHistoryItem, ProofScanStatus } from "../application/read-models/quoteAcceptanceProof";
export function quoteProofs() {
  const runtime = getQuoteApiRuntime();
  if (runtime.mode !== "connected" || !runtime.proofs) throw new MutationCommandError({ code: "BLOCKED_CONTRACT", category: "INFRASTRUCTURE", message: "Protected proof storage unavailable.", retryable: false });
  return runtime.proofs;
}
