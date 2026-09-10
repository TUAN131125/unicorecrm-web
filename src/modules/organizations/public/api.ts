import { assertMutationCommandSupported, createMutationMetadata, executeMutationCommand, type MutationCommandMetadata, type MutationOutcome } from "@/shared/application";
import type { OrganizationAccount } from "../domain/model/organizationAccount.types";
import { isOrganizationConnectedApiRuntime, organizationAccountRepository } from "../application/composition/organizationApplicationServices";
export { createOrganizationViaApi, updateOrganizationViaApi, archiveOrganizationViaApi } from "../application/commands/organizationApiCommands";

/** True when Organization data is served by the backend, where local Organization writes are refused. */
export function isOrganizationConnectedMode(): boolean { return isOrganizationConnectedApiRuntime(); }
import {
  anonymizeOrganizationAccount,
  archiveOrganizationAccount,
  restoreOrganizationAccount,
  saveOrganizationAccount,
  updateOrganizationAccountCollection,
  type OrganizationAccountCollectionUpdater,
} from "../application/commands/organizationAccountRepositoryCommands";

export type { OrganizationAccountRepository } from "../application/ports/OrganizationAccountRepository";
export type { OrganizationAccount, OrganizationAccountStatus, OrganizationRelationshipLevel } from "../domain/model/organizationAccount.types";
export { getOrganizationAccountContactIds } from "../application/queries/organizationAccountQueries";

export function getOrganizationAccountsSnapshot(): OrganizationAccount[] {
  return organizationAccountRepository.list();
}

export function getOrganizationAccountSnapshot(
  accountId: string,
): OrganizationAccount | undefined {
  return organizationAccountRepository.findById(accountId);
}

export function replaceOrganizationAccounts(
  accounts: OrganizationAccount[],
): void {
  organizationAccountRepository.replace(accounts);
}

export function updateOrganizationAccounts(
  updater: OrganizationAccountCollectionUpdater,
): OrganizationAccount[] {
  return updateOrganizationAccountCollection(
    organizationAccountRepository,
    updater,
  );
}

export function saveOrganizationAccountSnapshot(
  account: OrganizationAccount,
): OrganizationAccount {
  return saveOrganizationAccount(organizationAccountRepository, account);
}


export type OrganizationRetentionMutationMetadata = Partial<MutationCommandMetadata>;

export function archiveOrganizationAccountCommand(accountId: string, input: Parameters<typeof archiveOrganizationAccount>[2], metadata: OrganizationRetentionMutationMetadata = {}): Promise<MutationOutcome<OrganizationAccount>> {
  assertMutationCommandSupported("organization.archive", "Organization archive");
  return executeMutationCommand(
    { commandType: "organization.archive", aggregateType: "organization", aggregateId: accountId, payload: input },
    createMutationMetadata(`organization.archive:${accountId}`, { ...metadata, actor: metadata.actor ?? { id: input.actorId, name: input.actorName } }),
    () => archiveOrganizationAccount(organizationAccountRepository, accountId, input),
  );
}

export function restoreOrganizationAccountCommand(accountId: string, input: Parameters<typeof restoreOrganizationAccount>[2], metadata: OrganizationRetentionMutationMetadata = {}): Promise<MutationOutcome<OrganizationAccount>> {
  assertMutationCommandSupported("organization.restore", "Organization restore");
  return executeMutationCommand(
    { commandType: "organization.restore", aggregateType: "organization", aggregateId: accountId, payload: input },
    createMutationMetadata(`organization.restore:${accountId}`, { ...metadata, actor: metadata.actor ?? { id: input.actorId, name: input.actorName } }),
    () => restoreOrganizationAccount(organizationAccountRepository, accountId, input),
  );
}

export function anonymizeOrganizationAccountCommand(accountId: string, input: Parameters<typeof anonymizeOrganizationAccount>[2], metadata: OrganizationRetentionMutationMetadata = {}): Promise<MutationOutcome<OrganizationAccount>> {
  assertMutationCommandSupported("organization.anonymize", "Organization anonymization");
  return executeMutationCommand(
    { commandType: "organization.anonymize", aggregateType: "organization", aggregateId: accountId, payload: input },
    createMutationMetadata(`organization.anonymize:${accountId}`, { ...metadata, actor: metadata.actor ?? { id: input.actorId, name: input.actorName } }),
    () => anonymizeOrganizationAccount(organizationAccountRepository, accountId, input),
  );
}

export function subscribeToOrganizationAccounts(
  listener: (accounts: OrganizationAccount[]) => void,
): () => void {
  return organizationAccountRepository.subscribe(listener);
}
