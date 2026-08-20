import { recordCommercialEvidence, type PurchaseEvidenceType } from "@/modules/commercial-evidence";
import { getContactSnapshot } from "@/modules/contacts";
import { findCustomerByRelationshipRefSnapshot, type Customer } from "@/modules/customers";
import { getOrganizationAccountSnapshot } from "@/modules/organizations";
import { CAPABILITIES, assertRuntimeCapability } from "@/platform/access-control";
import type { RelationshipRef } from "@/platform/identity";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { reconcileCustomerConversionRuntime } from "@/workflows/customer-conversion";

export interface OnboardExistingCustomerCommand {
  relationshipRef: RelationshipRef;
  evidenceType: Extract<PurchaseEvidenceType, "EXTERNAL_PURCHASE_CONFIRMED" | "HISTORICAL_PURCHASE_IMPORTED">;
  occurredAt: string;
  sourceId: string;
  sourceSystem: string;
  externalCustomerRef?: string;
  amount?: number;
  currency?: string;
  productSummary?: string;
  documentRef?: string;
  note?: string;
  actorId: string;
  correlationId?: string;
}

export interface OnboardExistingCustomerResult {
  customer: Customer;
  alreadyExisted: boolean;
  evidenceId: string;
}

export function onboardExistingCustomerWorkflow(command: OnboardExistingCustomerCommand): OnboardExistingCustomerResult {
  assertRuntimeCapability(CAPABILITIES.CUSTOMERS_ONBOARD_EXISTING);
  assertRelationshipExists(command.relationshipRef);
  if (!command.sourceId.trim()) throw new Error("CUSTOMER_ONBOARDING_SOURCE_ID_REQUIRED");
  if (!command.sourceSystem.trim()) throw new Error("CUSTOMER_ONBOARDING_SOURCE_SYSTEM_REQUIRED");
  if (!command.occurredAt.trim() || Number.isNaN(Date.parse(command.occurredAt))) throw new Error("CUSTOMER_ONBOARDING_PURCHASE_DATE_INVALID");
  if (command.amount !== undefined && (!Number.isFinite(command.amount) || command.amount < 0)) throw new Error("CUSTOMER_ONBOARDING_AMOUNT_INVALID");

  const workspaceId = getWorkspaceContextSnapshot().workspaceId;
  const existing = findCustomerByRelationshipRefSnapshot(command.relationshipRef, workspaceId);
  const evidenceId = `purchase_evidence_${crypto.randomUUID()}`;
  const correlationId = command.correlationId?.trim() || `customer-onboarding:${workspaceId}:${command.relationshipRef.type}:${command.relationshipRef.id}:${command.sourceId.trim()}`;
  const evidence = recordCommercialEvidence({
    evidenceId,
    workspaceId,
    buyerRef: command.relationshipRef,
    sourceType: "EXTERNAL_TRANSACTION",
    sourceId: command.sourceId.trim(),
    evidenceType: command.evidenceType,
    occurredAt: new Date(command.occurredAt).toISOString(),
    policyVersion: "customer-onboarding/v1",
    correlationId,
    amount: command.amount,
    currency: command.currency?.trim() || undefined,
    productSummary: command.productSummary?.trim() || undefined,
    documentRef: command.documentRef?.trim() || undefined,
    note: command.note?.trim() || undefined,
    confirmedBy: command.actorId,
    sourceSystem: command.sourceSystem.trim(),
    externalCustomerRef: command.externalCustomerRef?.trim() || undefined,
  });
  reconcileCustomerConversionRuntime();
  const customer = findCustomerByRelationshipRefSnapshot(command.relationshipRef, workspaceId);
  if (!customer) throw new Error("CUSTOMER_ONBOARDING_PROJECTION_FAILED");
  return { customer, alreadyExisted: Boolean(existing), evidenceId: evidence.evidenceId };
}

function assertRelationshipExists(ref: RelationshipRef): void {
  const exists = ref.type === "CONTACT"
    ? Boolean(getContactSnapshot(ref.id))
    : Boolean(getOrganizationAccountSnapshot(ref.id));
  if (!exists) throw new Error(`CUSTOMER_ONBOARDING_RELATIONSHIP_NOT_FOUND:${ref.type}:${ref.id}`);
}
