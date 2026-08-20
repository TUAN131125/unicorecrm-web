import { getPurchaseEvidenceListSnapshot } from "@/modules/commercial-evidence";
import { getContactsSnapshot } from "@/modules/contacts";
import { getOrganizationAccountsSnapshot } from "@/modules/organizations";
import { BrowserStorageAdapter } from "@/platform/persistence";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { createWorkspaceScopedRepository } from "@/platform/workspace-scope/createWorkspaceScopedRepository";
import { WorkspaceScopedStorageAdapter } from "@/platform/workspace-scope/WorkspaceScopedStorageAdapter";
import { ensureCustomerFromPurchaseEvidence } from "../application/commands/customerCommands";
import type { CustomerRepositorySnapshot } from "../domain/model/customer.types";
import { InMemoryCustomerRepository } from "../infrastructure/InMemoryCustomerRepository";
import { CUSTOMER_VIEW_MIGRATION_PROFILES } from "../infrastructure/customerMigration.seed";

const storage = new BrowserStorageAdapter();

function sourceExists(ref: { type: "CONTACT" | "ORGANIZATION_ACCOUNT"; id: string }): boolean {
  if (ref.type === "CONTACT") return getContactsSnapshot().some((contact) => contact.id === ref.id);
  return getOrganizationAccountsSnapshot().some((account) => account.id === ref.id);
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, "0").slice(0, 7);
}

export function getCustomerMigrationProfileRuntime(ref: { type: "CONTACT" | "ORGANIZATION_ACCOUNT"; id: string }) {
  return CUSTOMER_VIEW_MIGRATION_PROFILES.find((profile) => profile.relationshipRef.type === ref.type && profile.relationshipRef.id === ref.id);
}

export const customerRepository = createWorkspaceScopedRepository({
  resourceKey: "customers",
  createRepository: (workspaceId) => new InMemoryCustomerRepository(
    { customers: [], careCards: [] },
    new WorkspaceScopedStorageAdapter(storage, workspaceId, "customers"),
  ),
});


const initializedWorkspaceIds = new Set<string>();

export function ensureCustomerRepositoryReady(): void {
  const workspaceId = getWorkspaceContextSnapshot().workspaceId;
  if (initializedWorkspaceIds.has(workspaceId)) return;

  initializedWorkspaceIds.add(workspaceId);
  try {
    reconcileCustomerRepositoryFromPurchaseEvidence();
  } catch (error) {
    initializedWorkspaceIds.delete(workspaceId);
    throw error;
  }
}

export function reconcileCustomerRepositoryFromPurchaseEvidence(now = new Date().toISOString()): CustomerRepositorySnapshot {
  const workspaceId = getWorkspaceContextSnapshot().workspaceId;
  const evidence = getPurchaseEvidenceListSnapshot()
    .filter((item) => !item.reversalOfEvidenceId)
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));

  for (const item of evidence) {
    const profile = getCustomerMigrationProfileRuntime(item.buyerRef);
    const ensured = ensureCustomerFromPurchaseEvidence(customerRepository, {
      evidence: item,
      workspaceId,
      resolveRelationshipExists: sourceExists,
      makeCustomerId: (relationshipRef) => profile ? `customer_${profile.legacyCustomerId}` : `customer_${stableHash(`${relationshipRef.type}:${relationshipRef.id}`)}`,
      makeCustomerCode: (relationshipRef) => profile?.legacyCustomerCode ?? `KH${stableHash(`${workspaceId}:${relationshipRef.type}:${relationshipRef.id}`)}`,
      legacyAliases: profile ? [profile.legacyCustomerId, profile.legacyCustomerCode] : [],
      health: profile?.health,
      segment: profile?.segment,
      careOwnerId: relationshipOwner(item.buyerRef),
      tags: relationshipTags(item.buyerRef),
      now,
    });
    if (ensured?.created && !customerRepository.listCareCards().some((card) => card.customerId === ensured.customer.id && card.type === "ONBOARDING" && card.status !== "CANCELLED")) {
      customerRepository.saveCareCard({
        id: `customer_onboarding_${ensured.customer.id}`,
        workspaceId,
        customerId: ensured.customer.id,
        type: "ONBOARDING",
        title: "Complete customer onboarding",
        description: "Verify identity, care owner, service level, consent and first-care plan.",
        status: "OPEN",
        priority: "HIGH",
        ownerId: ensured.customer.careOwnerId || "unassigned",
        dueAt: new Date(new Date(now).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        taskIds: [],
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return customerRepository.snapshot();
}

function relationshipOwner(ref: { type: "CONTACT" | "ORGANIZATION_ACCOUNT"; id: string }): string | undefined {
  if (ref.type === "CONTACT") return getContactsSnapshot().find((contact) => contact.id === ref.id)?.ownerId;
  return getOrganizationAccountsSnapshot().find((account) => account.id === ref.id)?.ownerId;
}

function relationshipTags(ref: { type: "CONTACT" | "ORGANIZATION_ACCOUNT"; id: string }): string[] {
  if (ref.type === "CONTACT") return [...(getContactsSnapshot().find((contact) => contact.id === ref.id)?.tags ?? [])];
  return [...(getOrganizationAccountsSnapshot().find((account) => account.id === ref.id)?.tags ?? [])];
}
