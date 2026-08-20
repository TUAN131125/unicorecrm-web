import type { PurchaseEvidence } from "@/modules/commercial-evidence";
import { CAPABILITIES, assertRuntimeCapability } from "@/platform/access-control";
import type { RelationshipRef } from "@/platform/identity";
import { anonymizedRecordLabel, assertDestructiveActionAllowed } from "@/shared/application";
import type { Customer, CustomerCareCard, CustomerHealth, CustomerStatus } from "../../domain/model/customer.types";
import {
  assertCustomerInvariant,
  customerTypeForRelationship,
  deriveCustomerStatus,
  isEffectiveCustomerPurchaseEvidence,
} from "../../domain/rules/customerRules";
import type { CustomerRepository } from "../ports/CustomerRepository";

export interface EnsureCustomerFromPurchaseEvidenceInput {
  evidence: PurchaseEvidence;
  workspaceId: string;
  resolveRelationshipExists: (relationshipRef: RelationshipRef) => boolean;
  makeCustomerId: (relationshipRef: RelationshipRef) => string;
  makeCustomerCode: (relationshipRef: RelationshipRef) => string;
  legacyAliases?: string[];
  health?: CustomerHealth;
  segment?: string;
  careOwnerId?: string;
  tags?: string[];
  now?: string;
}

export function ensureCustomerFromPurchaseEvidence(
  repository: CustomerRepository,
  input: EnsureCustomerFromPurchaseEvidenceInput,
): { customer: Customer; created: boolean } | undefined {
  if (!isEffectiveCustomerPurchaseEvidence(input.evidence)) return undefined;
  const relationshipRef = input.evidence.buyerRef;
  if (!input.resolveRelationshipExists(relationshipRef)) return undefined;

  const existing = repository.findByRelationship(input.workspaceId, relationshipRef);
  const occurredAt = input.evidence.occurredAt;
  const now = input.now ?? new Date().toISOString();

  if (existing) {
    const firstPurchaseAt = existing.firstPurchaseAt < occurredAt ? existing.firstPurchaseAt : occurredAt;
    const lastPurchaseAt = existing.lastPurchaseAt > occurredAt ? existing.lastPurchaseAt : occurredAt;
    const status = deriveCustomerStatus({ current: existing.status, latestPurchaseAt: lastPurchaseAt, health: existing.health, now });
    const legacyAliases = [...new Set([...(existing.legacyAliases ?? []), ...(input.legacyAliases ?? [])])];
    const unchanged = existing.firstPurchaseAt === firstPurchaseAt
      && existing.lastPurchaseAt === lastPurchaseAt
      && existing.status === status
      && legacyAliases.length === (existing.legacyAliases ?? []).length
      && legacyAliases.every((alias) => existing.legacyAliases?.includes(alias));

    if (unchanged) return { customer: existing, created: false };

    const updated: Customer = {
      ...existing,
      firstPurchaseAt,
      lastPurchaseAt,
      status,
      legacyAliases,
      createdFromEvidenceId: existing.createdFromEvidenceId ?? input.evidence.evidenceId,
      conversionPolicyVersion: existing.conversionPolicyVersion ?? input.evidence.policyVersion,
      conversionCorrelationId: existing.conversionCorrelationId ?? input.evidence.correlationId,
      sourceSystem: existing.sourceSystem ?? input.evidence.sourceSystem,
      externalCustomerRef: existing.externalCustomerRef ?? input.evidence.externalCustomerRef,
      updatedAt: now,
    };
    assertCustomerInvariant(updated);
    return { customer: repository.save(updated), created: false };
  }

  const customer: Customer = {
    id: input.makeCustomerId(relationshipRef),
    workspaceId: input.workspaceId,
    customerCode: input.makeCustomerCode(relationshipRef),
    type: customerTypeForRelationship(relationshipRef),
    relationshipRef,
    status: "NEW",
    health: input.health ?? "GOOD",
    calculatedHealth: input.health ?? "GOOD",
    onboardingStatus: "PENDING",
    createdFromEvidenceId: input.evidence.evidenceId,
    conversionPolicyVersion: input.evidence.policyVersion,
    conversionCorrelationId: input.evidence.correlationId,
    sourceSystem: input.evidence.sourceSystem,
    externalCustomerRef: input.evidence.externalCustomerRef,
    tier: "STANDARD",
    serviceLevel: "STANDARD",
    careCadenceDays: 30,
    firstPurchaseAt: occurredAt,
    lastPurchaseAt: occurredAt,
    careOwnerId: input.careOwnerId,
    segment: input.segment,
    tags: [...(input.tags ?? [])],
    legacyAliases: [...new Set(input.legacyAliases ?? [])],
    createdAt: now,
    updatedAt: now,
  };
  assertCustomerInvariant(customer);
  return { customer: repository.save(customer), created: true };
}

export function updateCustomerLifecycle(
  repository: CustomerRepository,
  customerId: string,
  patch: Partial<Pick<Customer, "status" | "health" | "careOwnerId" | "segment" | "tags" | "nextCareAt" | "lastCareAt" | "tier" | "serviceLevel" | "careCadenceDays" | "onboardingStatus" | "onboardingCompletedAt">>,
  now = new Date().toISOString(),
): Customer {
  const current = repository.getById(customerId);
  if (!current) throw new Error(`Customer ${customerId} was not found.`);
  if (patch.status === "ARCHIVED") assertRuntimeCapability(CAPABILITIES.CUSTOMERS_ARCHIVE);
  else if (patch.careOwnerId !== undefined && patch.careOwnerId !== current.careOwnerId) assertRuntimeCapability(CAPABILITIES.CUSTOMERS_ASSIGN);
  else assertRuntimeCapability(CAPABILITIES.CUSTOMERS_EDIT);
  if (current.status === "ARCHIVED" && patch.status && patch.status !== "ARCHIVED") throw new Error("Archived Customer cannot be reactivated through the normal lifecycle command.");
  const updated: Customer = {
    ...current,
    ...patch,
    tags: patch.tags ? [...patch.tags] : current.tags,
    calculatedHealth: current.calculatedHealth ?? current.health,
    manualHealthOverride: patch.health !== undefined ? patch.health : current.manualHealthOverride,
    archivedAt: patch.status === "ARCHIVED" ? current.archivedAt ?? now : current.archivedAt,
    updatedAt: now,
  };
  assertCustomerInvariant(updated);
  return repository.save(updated);
}


export function completeCustomerOnboarding(
  repository: CustomerRepository,
  customerId: string,
  input: { actorId: string; completedAt?: string },
): Customer {
  assertRuntimeCapability(CAPABILITIES.CUSTOMERS_EDIT);
  const current = repository.getById(customerId);
  if (!current) throw new Error(`Customer ${customerId} was not found.`);
  if (current.status === "ARCHIVED") throw new Error("Archived Customer cannot complete onboarding.");
  const completedAt = input.completedAt ?? new Date().toISOString();
  const nextStatus: CustomerStatus = current.health === "RISK" ? "AT_RISK" : "ACTIVE";
  const updated: Customer = {
    ...current,
    status: nextStatus,
    onboardingStatus: "COMPLETED",
    onboardingCompletedAt: completedAt,
    updatedAt: completedAt,
  };
  assertCustomerInvariant(updated);
  return repository.save(updated);
}

export function applyCalculatedCustomerHealth(
  repository: CustomerRepository,
  customerId: string,
  calculatedHealth: CustomerHealth,
  now = new Date().toISOString(),
): Customer {
  const current = repository.getById(customerId);
  if (!current) throw new Error(`Customer ${customerId} was not found.`);
  const effectiveHealth = current.manualHealthOverride ?? calculatedHealth;
  const updated: Customer = {
    ...current,
    calculatedHealth,
    health: effectiveHealth,
    status: deriveCustomerStatus({ current: current.status, latestPurchaseAt: current.lastPurchaseAt, health: effectiveHealth, now }),
    updatedAt: now,
  };
  assertCustomerInvariant(updated);
  return repository.save(updated);
}

export interface CustomerRetentionCommandInput {
  reason: string;
  actorId: string;
  actorName: string;
  now?: string;
}

export function archiveCustomer(repository: CustomerRepository, customerId: string, now = new Date().toISOString()): Customer {
  return updateCustomerLifecycle(repository, customerId, { status: "ARCHIVED" }, now);
}

export function archiveCustomerRecord(
  repository: CustomerRepository,
  customerId: string,
  input: CustomerRetentionCommandInput,
): Customer {
  assertDestructiveActionAllowed({
    recordType: "Customer",
    retentionClass: "MASTER",
    action: "ARCHIVE",
    reason: input.reason,
  });
  const archived = archiveCustomer(repository, customerId, input.now ?? new Date().toISOString());
  return repository.save({
    ...archived,
    archiveReason: input.reason.trim(),
  });
}

export function anonymizeCustomer(
  repository: CustomerRepository,
  customerId: string,
  input: CustomerRetentionCommandInput,
): Customer {
  assertRuntimeCapability(CAPABILITIES.CUSTOMERS_ARCHIVE);
  assertDestructiveActionAllowed({
    recordType: "Customer",
    retentionClass: "MASTER",
    action: "ANONYMIZE",
    reason: input.reason,
  });
  const current = repository.getById(customerId);
  if (!current) throw new Error(`Customer ${customerId} was not found.`);
  const now = input.now ?? new Date().toISOString();
  const anonymized: Customer = {
    ...current,
    customerCode: anonymizedRecordLabel("Customer", current.id),
    status: "ARCHIVED",
    health: "WATCH",
    careOwnerId: undefined,
    segment: undefined,
    tags: [],
    nextCareAt: undefined,
    lastCareAt: undefined,
    legacyAliases: [],
    archivedAt: current.archivedAt ?? now,
    archiveReason: current.archiveReason ?? input.reason.trim(),
    anonymizedAt: now,
    anonymizationReason: input.reason.trim(),
    updatedAt: now,
  };
  assertCustomerInvariant(anonymized);
  return repository.save(anonymized);
}

export function saveCustomerCareCard(repository: CustomerRepository, card: CustomerCareCard): CustomerCareCard {
  assertRuntimeCapability(CAPABILITIES.CUSTOMERS_EDIT);
  const customer = repository.getById(card.customerId);
  if (!customer) throw new Error(`Customer ${card.customerId} was not found.`);
  return repository.saveCareCard({ ...card, taskIds: [...new Set(card.taskIds)] });
}

export function updateCustomerStatus(repository: CustomerRepository, customerId: string, status: CustomerStatus, now?: string) {
  return updateCustomerLifecycle(repository, customerId, { status }, now);
}
