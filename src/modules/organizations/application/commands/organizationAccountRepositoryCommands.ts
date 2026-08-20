import type { OrganizationAccountRepository } from "../ports/OrganizationAccountRepository";
import type { OrganizationAccount } from "../../domain/model/organizationAccount.types";
import { CAPABILITIES, assertRuntimeCommandAccess, assertRuntimeCapability } from "@/platform/access-control";
import { anonymizedRecordLabel, assertDestructiveActionAllowed, redactEmailForRetention } from "@/shared/application";

export type OrganizationAccountCollectionUpdater = (
  current: OrganizationAccount[],
) => OrganizationAccount[];

export function updateOrganizationAccountCollection(
  repository: OrganizationAccountRepository,
  updater: OrganizationAccountCollectionUpdater,
): OrganizationAccount[] {
  assertRuntimeCapability(CAPABILITIES.ORGANIZATIONS_UPDATE);
  const next = updater(repository.list());
  repository.replace(next);
  return repository.list();
}

export function saveOrganizationAccount(
  repository: OrganizationAccountRepository,
  account: OrganizationAccount,
): OrganizationAccount {
  const previous = repository.findById(account.id);
  assertRuntimeCommandAccess(previous ? CAPABILITIES.ORGANIZATIONS_UPDATE : CAPABILITIES.ORGANIZATIONS_CREATE, "organizations", previous);
  updateOrganizationAccountCollection(repository, (current) => {
    const index = current.findIndex((item) => item.id === account.id);
    if (index < 0) return [account, ...current];
    return current.map((item) => (item.id === account.id ? account : item));
  });
  return repository.findById(account.id) ?? account;
}

export interface OrganizationRetentionCommandInput {
  reason: string;
  actorId: string;
  actorName?: string;
  now?: string;
}

export function archiveOrganizationAccount(repository: OrganizationAccountRepository, accountId: string, input: OrganizationRetentionCommandInput): OrganizationAccount {
  const target = repository.findById(accountId);
  if (!target) throw new Error(`Organization ${accountId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.ORGANIZATIONS_UPDATE, "organizations", target);
  assertDestructiveActionAllowed({ recordType: "Organization", retentionClass: "MASTER", action: "ARCHIVE", reason: input.reason });
  const now = input.now ?? new Date().toISOString();
  const next: OrganizationAccount = { ...target, status: "archived", archivedAt: now, archiveReason: input.reason.trim(), updatedAt: now };
  updateOrganizationAccountCollection(repository, (current) => current.map((item) => item.id === accountId ? next : item));
  return structuredClone(next);
}

export function restoreOrganizationAccount(repository: OrganizationAccountRepository, accountId: string, input: Omit<OrganizationRetentionCommandInput, "reason"> & { reason?: string }): OrganizationAccount {
  const target = repository.findById(accountId);
  if (!target) throw new Error(`Organization ${accountId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.ORGANIZATIONS_UPDATE, "organizations", target);
  assertDestructiveActionAllowed({ recordType: "Organization", retentionClass: "MASTER", action: "RESTORE", reason: input.reason });
  const now = input.now ?? new Date().toISOString();
  const next: OrganizationAccount = { ...target, status: "active", archivedAt: undefined, archiveReason: undefined, updatedAt: now };
  updateOrganizationAccountCollection(repository, (current) => current.map((item) => item.id === accountId ? next : item));
  return structuredClone(next);
}

export function anonymizeOrganizationAccount(repository: OrganizationAccountRepository, accountId: string, input: OrganizationRetentionCommandInput): OrganizationAccount {
  const target = repository.findById(accountId);
  if (!target) throw new Error(`Organization ${accountId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.ORGANIZATIONS_UPDATE, "organizations", target);
  assertDestructiveActionAllowed({ recordType: "Organization", retentionClass: "MASTER", action: "ANONYMIZE", reason: input.reason });
  const now = input.now ?? new Date().toISOString();
  const label = anonymizedRecordLabel("Organization", target.id);
  const next: OrganizationAccount = {
    ...target,
    displayName: label,
    legalName: undefined,
    taxCode: undefined,
    domain: undefined,
    phone: undefined,
    email: redactEmailForRetention(target.email),
    website: undefined,
    address: undefined,
    notes: undefined,
    status: "archived",
    archivedAt: now,
    archiveReason: "ANONYMIZED",
    anonymizedAt: now,
    anonymizationReason: input.reason.trim(),
    updatedAt: now,
  };
  updateOrganizationAccountCollection(repository, (current) => current.map((item) => item.id === accountId ? next : item));
  return structuredClone(next);
}
