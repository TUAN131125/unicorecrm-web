import type { RelationshipRef } from "@/platform/identity";
import type { CreateCustomerRequest, UpdateCustomerRequest } from "@/platform/api/generated/commercialApi";
import { assertMutationCommandSupported, createMutationMetadata, executeMutationCommand, isMutationCommandUnavailable, runBackendProjection, type MutationCommandMetadata, type MutationOutcome } from "@/shared/application";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { anonymizeCustomer, applyCalculatedCustomerHealth, archiveCustomer, archiveCustomerRecord, completeCustomerOnboarding, saveCustomerCareCard, updateCustomerLifecycle } from "../application/commands/customerCommands";
import { findCustomerByRelationshipRef, getCustomer, getCustomerCareCards, queryCustomers } from "../application/queries/customerQueries";
import { resolveCustomerRelationshipContext, assertCustomerRelationshipContext, type CustomerRelationshipContext } from "../application/queries/customerRelationshipContext";
import { auditCustomerRelationshipDataQuality as auditCustomerRelationshipDataQualityQuery, type CustomerRelationshipDataQualitySummary, type RelationshipDataQualityIssue } from "../application/queries/customerRelationshipDataQuality";
import type { Customer, CustomerCareCard, CustomerHealth, CustomerStatus, CustomerType } from "../domain/model/customer.types";
import { customerRepository, ensureCustomerRepositoryReady, getCustomerApiRuntime, getCustomerMigrationProfileRuntime, reconcileCustomerRepositoryFromPurchaseEvidence } from "../application/composition/customerApplicationServices";

export type {
  Customer,
  CustomerCareCard,
  CustomerCareCardPriority,
  CustomerCareCardStatus,
  CustomerCareCardType,
  CustomerHealth,
  CustomerOnboardingStatus,
  CustomerTier,
  CustomerServiceLevel,
  CustomerRepositorySnapshot,
  CustomerStatus,
  CustomerType,
} from "../domain/model/customer.types";
export type { CustomerRepository } from "../application/ports/CustomerRepository";

export type { CustomerRelationshipContext } from "../application/queries/customerRelationshipContext";
export { customerRelationshipKey, customerTypeForRelationship, isEffectiveCustomerPurchaseEvidence } from "../domain/rules/customerRules";

function ensureBackfill(): void {
  ensureCustomerRepositoryReady();
}

export function getStoredCustomersSnapshot(): Customer[] { return customerRepository.list(); }
export function replaceCustomerSnapshot(snapshot: import("../domain/model/customer.types").CustomerRepositorySnapshot): void { customerRepository.replace(snapshot); }
export function saveCustomerSnapshot(customer: Customer): Customer { return customerRepository.save(customer); }
export function getCustomersSnapshot(): Customer[] { ensureBackfill(); return customerRepository.list(); }
export function getCustomerSnapshot(customerIdOrAlias: string): Customer | undefined { ensureBackfill(); return getCustomer(customerRepository, customerIdOrAlias); }
export function resolveCustomerRelationshipContextSnapshot(customerIdOrAlias: string): CustomerRelationshipContext | undefined { ensureBackfill(); return resolveCustomerRelationshipContext(customerRepository, customerIdOrAlias); }
export function assertCustomerRelationshipContextSnapshot(customerIdOrAlias: string): CustomerRelationshipContext { ensureBackfill(); return assertCustomerRelationshipContext(customerRepository, customerIdOrAlias); }
export function findCustomerByRelationshipRefSnapshot(relationshipRef: RelationshipRef, workspaceId = getWorkspaceContextSnapshot().workspaceId): Customer | undefined {
  ensureBackfill();
  return findCustomerByRelationshipRef(customerRepository, workspaceId, relationshipRef);
}
export function queryCustomersSnapshot(input?: Parameters<typeof queryCustomers>[1]): Customer[] { ensureBackfill(); return queryCustomers(customerRepository, input); }
export function subscribeToCustomers(listener: (customers: Customer[]) => void): () => void {
  ensureBackfill();
  return customerRepository.subscribe((snapshot) => listener(snapshot.customers));
}
export function refreshCustomersFromPurchaseEvidence(): Customer[] { return reconcileCustomerRepositoryFromPurchaseEvidence().customers; }
export function updateCustomerLifecycleSnapshot(customerId: string, patch: Partial<Pick<Customer, "status" | "health" | "careOwnerId" | "segment" | "tags" | "nextCareAt" | "lastCareAt" | "tier" | "serviceLevel" | "careCadenceDays" | "onboardingStatus" | "onboardingCompletedAt">>): Customer {
  return updateCustomerLifecycle(customerRepository, customerId, patch);
}
export function archiveCustomerSnapshot(customerId: string): Customer { return archiveCustomer(customerRepository, customerId); }
export function completeCustomerOnboardingSnapshot(customerId: string, actorId: string, completedAt?: string): Customer { return completeCustomerOnboarding(customerRepository, customerId, { actorId, completedAt }); }
export function applyCalculatedCustomerHealthSnapshot(customerId: string, health: CustomerHealth, now?: string): Customer { return applyCalculatedCustomerHealth(customerRepository, customerId, health, now); }

export type CustomerRetentionMutationMetadata = Partial<MutationCommandMetadata>;

function projectAuthoritativeCustomer(customer: Customer): Customer {
  runBackendProjection("customers", () => customerRepository.save(customer));
  return customer;
}

function customerCommandOptions(prefix: string, metadata: CustomerRetentionMutationMetadata = {}) {
  const resolved = createMutationMetadata(prefix, metadata);
  return {
    idempotencyKey: resolved.idempotencyKey,
    expectedVersion: typeof resolved.expectedVersion === "number" ? resolved.expectedVersion : undefined,
    signal: resolved.signal,
  };
}

export async function createCustomerCommand(
  input: CreateCustomerRequest,
  metadata: CustomerRetentionMutationMetadata = {},
): Promise<Customer> {
  const customer = await getCustomerApiRuntime().commands.create(input, customerCommandOptions(`customer.create:${input.relationshipRef.type}:${input.relationshipRef.id}`, metadata));
  return projectAuthoritativeCustomer(customer);
}

export async function updateCustomerCommand(
  customerId: string,
  input: UpdateCustomerRequest,
  metadata: CustomerRetentionMutationMetadata = {},
): Promise<Customer> {
  const current = getCustomerSnapshot(customerId);
  const expectedVersion = metadata.expectedVersion ?? current?.resourceVersion;
  if (typeof expectedVersion !== "number") throw new Error("CUSTOMER_RESOURCE_VERSION_REQUIRED");
  const customer = await getCustomerApiRuntime().commands.update(customerId, input, customerCommandOptions(`customer.update:${customerId}`, { ...metadata, expectedVersion }));
  return projectAuthoritativeCustomer(customer);
}

export async function archiveCustomerProductionCommand(
  customerId: string,
  metadata: CustomerRetentionMutationMetadata = {},
): Promise<Customer> {
  const current = getCustomerSnapshot(customerId);
  const expectedVersion = metadata.expectedVersion ?? current?.resourceVersion;
  if (typeof expectedVersion !== "number") throw new Error("CUSTOMER_RESOURCE_VERSION_REQUIRED");
  const customer = await getCustomerApiRuntime().commands.archive(customerId, customerCommandOptions(`customer.archive:${customerId}`, { ...metadata, expectedVersion }));
  return projectAuthoritativeCustomer(customer);
}

/**
 * True when Customer retention cannot run in the active runtime: `customer.archive` and
 * `customer.anonymize` are BLOCKED in the canonical registry.
 */
export function isCustomerRetentionUnavailable(): boolean {
  return isMutationCommandUnavailable("customer.archive");
}

export function archiveCustomerCommand(
  customerId: string,
  input: Parameters<typeof archiveCustomerRecord>[2],
  metadata: CustomerRetentionMutationMetadata = {},
): Promise<MutationOutcome<Customer>> {
  assertMutationCommandSupported("customer.archive", "Customer archive");
  const current = getCustomerSnapshot(customerId);
  return executeMutationCommand(
    { commandType: "customer.archive", aggregateType: "customer", aggregateId: customerId, payload: input },
    createMutationMetadata(`customer.archive:${customerId}`, {
      ...metadata,
      expectedVersion: metadata.expectedVersion ?? (current?.updatedAt ? Date.parse(current.updatedAt) : undefined),
      actor: metadata.actor ?? { id: input.actorId, name: input.actorName },
    }),
    () => archiveCustomerRecord(customerRepository, customerId, input),
  );
}

export function anonymizeCustomerCommand(
  customerId: string,
  input: Parameters<typeof anonymizeCustomer>[2],
  metadata: CustomerRetentionMutationMetadata = {},
): Promise<MutationOutcome<Customer>> {
  assertMutationCommandSupported("customer.anonymize", "Customer anonymization");
  const current = getCustomerSnapshot(customerId);
  return executeMutationCommand(
    { commandType: "customer.anonymize", aggregateType: "customer", aggregateId: customerId, payload: input },
    createMutationMetadata(`customer.anonymize:${customerId}`, {
      ...metadata,
      expectedVersion: metadata.expectedVersion ?? (current?.updatedAt ? Date.parse(current.updatedAt) : undefined),
      actor: metadata.actor ?? { id: input.actorId, name: input.actorName },
    }),
    () => anonymizeCustomer(customerRepository, customerId, input),
  );
}
export function getCustomerCareCardsSnapshot(customerId: string): CustomerCareCard[] { ensureBackfill(); return getCustomerCareCards(customerRepository, customerId); }
export function saveCustomerCareCardSnapshot(card: CustomerCareCard): CustomerCareCard { return saveCustomerCareCard(customerRepository, card); }
export function getAllCustomerCareCardsSnapshot(): CustomerCareCard[] { return customerRepository.listCareCards(); }
export function subscribeToCustomerRepository(listener: Parameters<typeof customerRepository.subscribe>[0]) { ensureBackfill(); return customerRepository.subscribe(listener); }

export const getCustomerMigrationProfileSnapshot = getCustomerMigrationProfileRuntime;

export function auditCustomerRelationshipDataQuality(input?: {
  customers?: readonly Customer[];
  contacts?: Parameters<typeof auditCustomerRelationshipDataQualityQuery>[0]["contacts"];
  organizations?: Parameters<typeof auditCustomerRelationshipDataQualityQuery>[0]["organizations"];
  now?: string;
}): CustomerRelationshipDataQualitySummary {
  ensureBackfill();
  return auditCustomerRelationshipDataQualityQuery({
    ...input,
    customers: input?.customers ?? customerRepository.list(),
  });
}
export type { CustomerRelationshipDataQualitySummary, RelationshipDataQualityIssue };
