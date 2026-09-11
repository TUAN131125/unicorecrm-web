import type { PurchaseEvidence } from "@/modules/commercial-evidence";
import { relationshipRefKey, type RelationshipRef } from "@/platform/identity";
import type { Customer, CustomerHealth, CustomerStatus, CustomerType } from "../model/customer.types";

export const CUSTOMER_CONVERSION_POLICY_VERSION = "customer-conversion/v1";

export function customerRelationshipKey(workspaceId: string, relationshipRef: RelationshipRef): string {
  return `${workspaceId}:${relationshipRefKey(relationshipRef)}`;
}

export function customerTypeForRelationship(relationshipRef: RelationshipRef): CustomerType {
  return relationshipRef.type === "CONTACT" ? "B2C" : "B2B";
}

export function isEffectiveCustomerPurchaseEvidence(evidence: PurchaseEvidence): boolean {
  return !evidence.reversalOfEvidenceId && (
    evidence.evidenceType === "ORDER_COMPLETED" ||
    evidence.evidenceType === "EXTERNAL_PURCHASE_CONFIRMED" ||
    evidence.evidenceType === "HISTORICAL_PURCHASE_IMPORTED"
  );
}

export function deriveCustomerStatus(input: {
  current?: CustomerStatus;
  latestPurchaseAt: string;
  health?: CustomerHealth;
  now?: string;
}): CustomerStatus {
  if (input.current === "ARCHIVED" || input.current === "DO_NOT_CONTACT") return input.current;
  if (input.health === "RISK") return "AT_RISK";
  const nowMs = new Date(input.now ?? new Date().toISOString()).getTime();
  const latestMs = new Date(input.latestPurchaseAt).getTime();
  if (!Number.isFinite(nowMs) || !Number.isFinite(latestMs)) return input.current ?? "NEW";
  const ageDays = (nowMs - latestMs) / 86_400_000;
  if (ageDays > 730) return "CHURNED";
  if (ageDays > 365) return "INACTIVE";
  return input.current === "NEW" ? "NEW" : "ACTIVE";
}

export function assertCustomerInvariant(customer: Customer): void {
  const errors: string[] = [];
  if (!customer.id.trim()) errors.push("Customer id is required.");
  if (!customer.workspaceId.trim()) errors.push("Customer workspaceId is required.");
  if (!customer.customerCode.trim()) errors.push("Customer code is required.");
  if (!customer.relationshipRef.id.trim()) errors.push("Customer relationshipRef.id is required.");
  if (customer.type !== customerTypeForRelationship(customer.relationshipRef)) errors.push("Customer type must match relationshipRef type.");
  if ((customer.firstPurchaseAt === null) !== (customer.lastPurchaseAt === null)) errors.push("Customer purchase timestamps must both be present or both be null.");
  if (customer.firstPurchaseAt !== null && (!customer.firstPurchaseAt.trim() || !customer.lastPurchaseAt?.trim())) errors.push("Customer purchase timestamps cannot be blank.");
  if (errors.length) throw new Error(errors.join(" "));
}
