import { assertMutationCommandSupported, createMutationMetadata, executeMutationCommand, isBusinessOperationUnavailable, isMutationCommandUnavailable, type MutationCommandMetadata, type MutationOutcome } from "@/shared/application";
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
function isContactOperationReady(operation: string): boolean {
  return !isBusinessOperationUnavailable(operation);
}
export function isContactCreateAvailable(): boolean {
  return isContactOperationReady(CONTACT_CREATE_OPERATION)
    && (Boolean(getContactApiRuntime().commands) || !isContactConnectedApiRuntime());
}
export function isContactUpdateAvailable(): boolean {
  return isContactOperationReady(CONTACT_UPDATE_OPERATION)
    && (Boolean(getContactApiRuntime().commands) || !isContactConnectedApiRuntime());
}
/** Archive has its own admitted HTTP command, independent of restore and anonymize. */
export function isContactArchiveAvailable(): boolean {
  return isContactOperationReady(CONTACT_ARCHIVE_OPERATION) && (Boolean(getContactApiRuntime().commands) || !isContactConnectedApiRuntime());
}
export function isContactRestoreAvailable(): boolean {
  return !isContactConnectedApiRuntime() && !isMutationCommandUnavailable("contact.restore");
}
export function isContactAnonymizeAvailable(): boolean {
  return !isContactConnectedApiRuntime() && !isMutationCommandUnavailable("contact.anonymize");
}
export function isContactBulkAvailable(): boolean {
  return !isContactConnectedApiRuntime();
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

export {
  createContactOrganizationRelationshipViaApi, updateContactOrganizationRelationshipViaApi, endContactOrganizationRelationshipViaApi,
  createContactCustomerRelationshipViaApi, updateContactCustomerRelationshipViaApi, endContactCustomerRelationshipViaApi,
} from "../application/commands/contactRelationshipCommands";
