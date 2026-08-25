import { assertMutationCommandSupported, createMutationMetadata, executeMutationCommand, isMutationCommandUnavailable, type MutationCommandMetadata, type MutationOutcome } from "@/shared/application";
import type { Contact } from "../domain/model/contact.types";
import { contactPreferences, contactRepository, isContactConnectedApiRuntime } from "../application/composition/contactApplicationServices";
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
/**
 * True when Contact retention (archive/restore/anonymize) cannot run in the active runtime.
 * `contact.archive`, `contact.restore` and `contact.anonymize` are BLOCKED in the canonical
 * registry, so presentation can refuse the action up front instead of starting a mutation
 * that the boundary would reject.
 */
export function isContactRetentionUnavailable(): boolean {
  return isMutationCommandUnavailable("contact.archive");
}

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
