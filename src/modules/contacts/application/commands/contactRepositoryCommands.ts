import type { ContactRepository } from "../ports/ContactRepository";
import type { Contact } from "../../domain/model/contact.types";
import { CAPABILITIES, assertRuntimeCommandAccess, assertRuntimeCapability } from "@/platform/access-control";
import { anonymizedRecordLabel, assertDestructiveActionAllowed } from "@/shared/application";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { normalizeContactCanonicalProfile } from "../../domain/model/contactCanonicalProfile";

export type ContactCollectionUpdater = Contact[] | ((current: Contact[]) => Contact[]);

export function updateContactCollection(
  repository: ContactRepository,
  updater: ContactCollectionUpdater,
): Contact[] {
  assertRuntimeCapability(CAPABILITIES.CONTACTS_UPDATE);
  const current = repository.list();
  const next = typeof updater === "function" ? updater(current) : updater;
  const workspaceId = getWorkspaceContextSnapshot().workspaceId;
  repository.replace(next.map((contact) => normalizeContactCanonicalProfile(contact, { workspaceId })));
  return repository.list();
}

export function saveContact(repository: ContactRepository, contact: Contact): Contact {
  const current = repository.list();
  const previous = current.find((item) => item.id === contact.id);
  assertRuntimeCommandAccess(previous ? CAPABILITIES.CONTACTS_UPDATE : CAPABILITIES.CONTACTS_CREATE, "contacts", previous);
  const exists = Boolean(previous);
  const normalized = normalizeContactCanonicalProfile(contact, { workspaceId: getWorkspaceContextSnapshot().workspaceId });
  repository.replace(
    exists
      ? current.map((item) => item.id === normalized.id ? structuredClone(normalized) : item)
      : [structuredClone(normalized), ...current],
  );
  return structuredClone(normalized);
}

export function updateContact(
  repository: ContactRepository,
  contactId: string,
  transform: (contact: Contact) => Contact,
): Contact | undefined {
  let updated: Contact | undefined;
  repository.replace(repository.list().map((contact) => {
    if (contact.id !== contactId) return contact;
    assertRuntimeCommandAccess(CAPABILITIES.CONTACTS_UPDATE, "contacts", contact);
    updated = normalizeContactCanonicalProfile(transform(structuredClone(contact)), { workspaceId: getWorkspaceContextSnapshot().workspaceId });
    return updated;
  }));
  return updated ? structuredClone(updated) : undefined;
}

export function updateManyContacts(
  repository: ContactRepository,
  contactIds: readonly string[],
  transform: (contact: Contact) => Contact,
): number {
  assertRuntimeCapability(CAPABILITIES.CONTACTS_BULK);
  const ids = new Set(contactIds);
  let count = 0;
  repository.replace(repository.list().map((contact) => {
    if (!ids.has(contact.id)) return contact;
    assertRuntimeCommandAccess(CAPABILITIES.CONTACTS_BULK, "contacts", contact);
    count += 1;
    return normalizeContactCanonicalProfile(transform(structuredClone(contact)), { workspaceId: getWorkspaceContextSnapshot().workspaceId });
  }));
  return count;
}

export interface ContactRetentionCommandInput {
  reason: string;
  actorId: string;
  actorName?: string;
  now?: string;
}

function appendRetentionActivity(contact: Contact, input: ContactRetentionCommandInput, title: string, description: string): Contact {
  const now = input.now ?? new Date().toISOString();
  return {
    ...contact,
    activities: [{
      id: `contact-retention-${crypto.randomUUID()}`,
      icon: "Archive",
      title,
      description,
      createdAt: now,
      author: input.actorName || input.actorId,
      type: "system",
    }, ...(contact.activities ?? [])],
    updatedAt: now,
    updatedBy: input.actorId,
  };
}

export function archiveContact(repository: ContactRepository, contactId: string, input: ContactRetentionCommandInput): Contact {
  const target = repository.getById(contactId);
  if (!target) throw new Error(`Contact ${contactId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.CONTACTS_DELETE, "contacts", target);
  assertDestructiveActionAllowed({ recordType: "Contact", retentionClass: "MASTER", action: "ARCHIVE", reason: input.reason });
  const now = input.now ?? new Date().toISOString();
  const archived = appendRetentionActivity(target, input, "CONTACT ARCHIVED", input.reason.trim());
  const next = { ...archived, status: "archived" as const, archivedAt: now, archiveReason: input.reason.trim() };
  repository.replace(repository.list().map((contact) => contact.id === contactId ? next : contact));
  return structuredClone(next);
}

export function restoreContact(repository: ContactRepository, contactId: string, input: Omit<ContactRetentionCommandInput, "reason"> & { reason?: string }): Contact {
  const target = repository.getById(contactId);
  if (!target) throw new Error(`Contact ${contactId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.CONTACTS_UPDATE, "contacts", target);
  assertDestructiveActionAllowed({ recordType: "Contact", retentionClass: "MASTER", action: "RESTORE", reason: input.reason });
  const restored = appendRetentionActivity(target, { ...input, reason: input.reason ?? "Restored from archive." }, "CONTACT RESTORED", input.reason ?? "Restored from archive.");
  const next = { ...restored, status: "active" as const, archivedAt: undefined, archiveReason: undefined };
  repository.replace(repository.list().map((contact) => contact.id === contactId ? next : contact));
  return structuredClone(next);
}

export function anonymizeContact(repository: ContactRepository, contactId: string, input: ContactRetentionCommandInput): Contact {
  const target = repository.getById(contactId);
  if (!target) throw new Error(`Contact ${contactId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.CONTACTS_DELETE, "contacts", target);
  assertDestructiveActionAllowed({ recordType: "Contact", retentionClass: "MASTER", action: "ANONYMIZE", reason: input.reason });
  const now = input.now ?? new Date().toISOString();
  const label = anonymizedRecordLabel("Contact", target.id);
  const retained: Contact = {
    id: target.id,
    workspaceId: target.workspaceId,
    name: label,
    fullName: label,
    organizationAccountId: target.organizationAccountId,
    organizationRelationships: target.organizationRelationships?.map((relationship) => ({
      id: relationship.id,
      organizationAccountId: relationship.organizationAccountId,
      role: relationship.role,
      decisionRole: relationship.decisionRole,
      isPrimaryRepresentative: relationship.isPrimaryRepresentative,
      effectiveFrom: relationship.effectiveFrom,
      effectiveTo: relationship.effectiveTo,
      createdAt: relationship.createdAt,
      updatedAt: relationship.updatedAt,
    })),
    ownerId: target.ownerId,
    teamId: target.teamId,
    leadId: target.leadId,
    relatedOpportunityIds: target.relatedOpportunityIds,
    wonOpportunityId: target.wonOpportunityId,
    convertedFromLeadId: target.convertedFromLeadId,
    createdFrom: target.createdFrom,
    createdAt: target.createdAt,
    createdBy: target.createdBy,
    consent: target.consent ? {
      current: Object.fromEntries(Object.keys(target.consent.current).map((channel) => [channel, "WITHDRAWN"])) as typeof target.consent.current,
      ledger: target.consent.ledger.map((entry) => ({
        id: entry.id,
        channel: entry.channel,
        decision: entry.decision,
        source: "REDACTED",
        occurredAt: entry.occurredAt,
        expiresAt: entry.expiresAt,
      })),
      updatedAt: now,
    } : undefined,
    communicationConsent: false,
    doNotCall: true,
    doNotEmail: true,
    doNotSms: true,
    doNotZalo: true,
    doNotContact: true,
    doNotContactReason: "ANONYMIZED",
    status: "archived",
    archivedAt: now,
    archiveReason: "ANONYMIZED",
    anonymizedAt: now,
    anonymizationReason: "ANONYMIZED",
    activities: [],
  };
  const next = appendRetentionActivity(retained, { ...input, reason: "ANONYMIZED" }, "CONTACT ANONYMIZED", "ANONYMIZED");
  repository.replace(repository.list().map((contact) => contact.id === contactId ? next : contact));
  return structuredClone(next);
}
