import type { PurchaseEvidence } from "../model/purchaseEvidence.types";

export function purchaseEvidenceSourceKey(evidence: Pick<PurchaseEvidence, "sourceType" | "sourceId" | "evidenceType">): string {
  return [evidence.sourceType, evidence.sourceId, evidence.evidenceType].join(":");
}

export function validatePurchaseEvidence(evidence: PurchaseEvidence): string[] {
  const errors: string[] = [];

  if (!evidence.evidenceId.trim()) errors.push("evidenceId is required.");
  if (!evidence.workspaceId.trim()) errors.push("workspaceId is required.");
  if (!evidence.buyerRef.id.trim()) errors.push("buyerRef.id is required.");
  if (!evidence.sourceId.trim()) errors.push("sourceId is required.");
  if (!evidence.occurredAt.trim()) errors.push("occurredAt is required.");
  if (!evidence.policyVersion.trim()) errors.push("policyVersion is required.");
  if (!evidence.correlationId.trim()) errors.push("correlationId is required.");

  if (
    evidence.reversalOfEvidenceId &&
    evidence.reversalOfEvidenceId === evidence.evidenceId
  ) {
    errors.push("PurchaseEvidence cannot reverse itself.");
  }

  return errors;
}

export function assertValidPurchaseEvidence(evidence: PurchaseEvidence): void {
  const errors = validatePurchaseEvidence(evidence);
  if (errors.length > 0) throw new Error(errors.join(" "));
}
