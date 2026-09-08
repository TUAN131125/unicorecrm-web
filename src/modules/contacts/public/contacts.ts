import { assertMutationCommandSupported, createMutationMetadata, executeMutationCommand, isBusinessOperationUnavailable, isMutationCommandUnavailable, type MutationCommandMetadata, type MutationOutcome } from "@/shared/application";
import { OPENAPI_OPERATION_RUNTIME_CONTRACTS } from "@/platform/api/contracts/generatedOpenApiRuntimeContract";
import { CONTACT_ARCHIVE_OPERATION, CONTACT_CREATE_OPERATION, CONTACT_UPDATE_OPERATION } from "../application/ports/ContactApiRuntime";
import type { Contact } from "../domain/model/contact.types";
import { contactPreferences, contactRepository, isContactConnectedApiRuntime } from "../application/composition/contactApplicationServices";
import { getContactApiRuntime } from "../application/composition/contactApplicationServices";
import { archiveContactViaApi, createContactViaApi, updateContactViaApi } from "../application/commands/contactApiCommands";
import {
  anonymizeContact,
  archiveContact,
  restoreContact,
  saveContact,
  updateContactCollection,
  type ContactCollectionUpdater,
} from "../application/commands/contactRepositoryCommands";

/** True when Contact data is served by the backend, where local Contact writes are refused. */
export function isContactConnectedMode(): boolean { return isContactConnectedApiRuntime(); }
function isContactOperationReady(operation: keyof typeof OPENAPI_OPERATION_RUNTIME_CONTRACTS): boolean {
  return OPENAPI_OPERATION_RUNTIME_CONTRACTS[operation].contractStatus === "PRODUCTION_CONTRACT_READY";
}
export function isContactCreateAvailable(): boolean {
  return isContactOperationReady(CONTACT_CREATE_OPERATION)
    && (Boolean(getContactApiRuntime().commands) || !isBusinessOperationUnavailable(CONTACT_CREATE_OPERATION));
}
export function isContactUpdateAvailable(): boolean {
  return isContactOperationReady(CONTACT_UPDATE_OPERATION)
    && (Boolean(getContactApiRuntime().commands) || !isBusinessOperationUnavailable(CONTACT_UPDATE_OPERATION));
}
/**
 * True when Contact retention (archive/restore/anonymize) cannot run in the active runtime.
 * `contact.archive`, `contact.restore` and `contact.anonymize` are BLOCKED in the canonical
 * registry, so presentation can refuse the action up front instead of starting a mutation
 * that the boundary would reject.
 */
export function isContactRetentionUnavailable(): boolean {
  return !isContactOperationReady(CONTACT_ARCHIVE_OPERATION)
    || (!getContactApiRuntime().commands && isMutationCommandUnavailable("contact.archive"));
}

export { createContactViaApi, updateContactViaApi, archiveContactViaApi };

export function getContactsSnapshot(): Contact[] {
  return contactRepository.list();
}

export function getContactSnapshot(contactId: string): Contact | undefined {
  return contactRepository.getById(contactId);
}

export function saveContactSnapshot(contact: Contact): Contact {
  return saveContact(contactRepository, contact);
}

export function replaceContacts(contacts: Contact[]): void {
  contactRepository.replace(contacts);
}

export function updateContacts(updater: ContactCollectionUpdater): Contact[] {
  return updateContactCollection(contactRepository, updater);
}


export type ContactRetentionMutationMetadata = Partial<MutationCommandMetadata>;

export function archiveContactCommand(contactId: string, input: Parameters<typeof archiveContact>[2], metadata: ContactRetentionMutationMetadata = {}): Promise<MutationOutcome<Contact>> {
  assertMutationCommandSupported("contact.archive", "Contact archive");
  const current = getContactSnapshot(contactId);
  return executeMutationCommand(
    { commandType: "contact.archive", aggregateType: "contact", aggregateId: contactId, payload: input },
    createMutationMetadata(`contact.archive:${contactId}`, { ...metadata, expectedVersion: metadata.expectedVersion ?? (current?.updatedAt ? Date.parse(current.updatedAt) : undefined), actor: metadata.actor ?? { id: input.actorId, name: input.actorName } }),
    () => archiveContact(contactRepository, contactId, input),
  );
}

export function restoreContactCommand(contactId: string, input: Parameters<typeof restoreContact>[2], metadata: ContactRetentionMutationMetadata = {}): Promise<MutationOutcome<Contact>> {
  assertMutationCommandSupported("contact.restore", "Contact restore");
  return executeMutationCommand(
    { commandType: "contact.restore", aggregateType: "contact", aggregateId: contactId, payload: input },
    createMutationMetadata(`contact.restore:${contactId}`, { ...metadata, actor: metadata.actor ?? { id: input.actorId, name: input.actorName } }),
    () => restoreContact(contactRepository, contactId, input),
  );
}

export function anonymizeContactCommand(contactId: string, input: Parameters<typeof anonymizeContact>[2], metadata: ContactRetentionMutationMetadata = {}): Promise<MutationOutcome<Contact>> {
  assertMutationCommandSupported("contact.anonymize", "Contact anonymization");
  const current = getContactSnapshot(contactId);
  return executeMutationCommand(
    { commandType: "contact.anonymize", aggregateType: "contact", aggregateId: contactId, payload: input },
    createMutationMetadata(`contact.anonymize:${contactId}`, { ...metadata, expectedVersion: metadata.expectedVersion ?? (current?.updatedAt ? Date.parse(current.updatedAt) : undefined), actor: metadata.actor ?? { id: input.actorId, name: input.actorName } }),
    () => anonymizeContact(contactRepository, contactId, input),
  );
}

export function subscribeToContacts(listener: (contacts: Contact[]) => void): () => void {
  return contactRepository.subscribe(listener);
}

export function getContactPreference<T>(key: string, fallback: T): T {
  return contactPreferences.get(key, fallback);
}

export function setContactPreference<T>(key: string, value: T): void {
  contactPreferences.set(key, value);
}

export function removeContactPreference(key: string): void {
  contactPreferences.remove(key);
}
