import {
  endContactOrganizationRelationship,
  getContactOrganizationRelationships,
  getContactsSnapshot,
  saveContactSnapshot,
  setContactOrganizationPrimaryFlag,
  upsertContactOrganizationRelationship,
  type Contact,
  type ContactOrganizationRelationship,
  type ContactOrganizationRelationshipDraft,
} from "@/modules/contacts";
import {
  getOrganizationAccountSnapshot,
  getOrganizationAccountsSnapshot,
  replaceOrganizationAccounts,
  saveOrganizationAccountSnapshot,
  type OrganizationAccount,
} from "@/modules/organizations";
import { replaceContacts } from "@/modules/contacts";
import { assertMutationCommandSupported, createMutationMetadata, executeMutationCommand, isMutationCommandUnavailable, type MutationCommandMetadata, type MutationOutcome } from "@/shared/application";
import { isContactConnectedApiRuntime } from "@/modules/contacts/application/composition/contactApplicationServices";

function assertLegacyRelationshipWriteMode(): void {
  if (isContactConnectedApiRuntime()) {
    throw new Error("CONTACT_ORGANIZATION_LEGACY_WRITE_DISABLED_IN_CONNECTED_MODE");
  }
}

export interface UpsertContactOrganizationRelationshipCommand {
  contactId: string;
  relationship: ContactOrganizationRelationshipDraft;
  actorId: string;
  now?: string;
}

export interface EndContactOrganizationRelationshipCommand {
  contactId: string;
  organizationAccountId: string;
  actorId: string;
  reason: string;
  effectiveTo?: string;
}

export interface SetPrimaryOrganizationRepresentativeCommand {
  organizationAccountId: string;
  contactId: string;
  actorId: string;
  now?: string;
}

export interface ContactOrganizationRelationshipResult {
  contact: Contact;
  organization: OrganizationAccount;
  relationship?: ContactOrganizationRelationship;
}

export function upsertContactOrganizationRelationshipWorkflow(
  command: UpsertContactOrganizationRelationshipCommand,
): ContactOrganizationRelationshipResult {
  assertLegacyRelationshipWriteMode();
  const contact = requireContact(command.contactId);
  const organization = requireOrganization(command.relationship.organizationAccountId);
  const contactsBefore = getContactsSnapshot();
  const organizationsBefore = getOrganizationAccountsSnapshot();
  try {
    const updated = upsertContactOrganizationRelationship(contact, command.relationship, {
      actorId: command.actorId,
      now: command.now,
    });
    saveContactSnapshot(updated);
    const linkedOrganization = ensureOrganizationContactRef(organization, contact.id, command.now);
    saveOrganizationAccountSnapshot(linkedOrganization);
    if (command.relationship.isPrimaryRepresentative) {
      return setPrimaryOrganizationRepresentativeWorkflow({
        organizationAccountId: organization.id,
        contactId: contact.id,
        actorId: command.actorId,
        now: command.now,
      });
    }
    if (organization.primaryContactId === contact.id) {
      const clearedOrganization = { ...linkedOrganization, primaryContactId: undefined, updatedAt: command.now ?? new Date().toISOString() };
      saveOrganizationAccountSnapshot(clearedOrganization);
      return {
        contact: saveContactSnapshot(setContactOrganizationPrimaryFlag(updated, organization.id, false, { actorId: command.actorId, now: command.now })),
        organization: clearedOrganization,
        relationship: getContactOrganizationRelationships(updated).find((item) => item.organizationAccountId === organization.id && !item.effectiveTo),
      };
    }
    return {
      contact: updated,
      organization: linkedOrganization,
      relationship: getContactOrganizationRelationships(updated).find((item) => item.organizationAccountId === organization.id && !item.effectiveTo),
    };
  } catch (error) {
    replaceContacts(contactsBefore);
    replaceOrganizationAccounts(organizationsBefore);
    throw error;
  }
}

export function endContactOrganizationRelationshipWorkflow(
  command: EndContactOrganizationRelationshipCommand,
): ContactOrganizationRelationshipResult {
  assertLegacyRelationshipWriteMode();
  const contact = requireContact(command.contactId);
  const organization = requireOrganization(command.organizationAccountId);
  const contactsBefore = getContactsSnapshot();
  const organizationsBefore = getOrganizationAccountsSnapshot();
  try {
    const updatedContact = saveContactSnapshot(endContactOrganizationRelationship(contact, organization.id, {
      actorId: command.actorId,
      reason: command.reason,
      effectiveTo: command.effectiveTo,
    }));
    const updatedOrganization: OrganizationAccount = {
      ...organization,
      contactRefs: organization.contactRefs.filter((ref) => ref.id !== contact.id),
      primaryContactId: organization.primaryContactId === contact.id ? undefined : organization.primaryContactId,
      updatedAt: command.effectiveTo ?? new Date().toISOString(),
    };
    saveOrganizationAccountSnapshot(updatedOrganization);
    return { contact: updatedContact, organization: updatedOrganization };
  } catch (error) {
    replaceContacts(contactsBefore);
    replaceOrganizationAccounts(organizationsBefore);
    throw error;
  }
}

export function setPrimaryOrganizationRepresentativeWorkflow(
  command: SetPrimaryOrganizationRepresentativeCommand,
): ContactOrganizationRelationshipResult {
  assertLegacyRelationshipWriteMode();
  const organization = requireOrganization(command.organizationAccountId);
  const target = requireContact(command.contactId);
  const contactsBefore = getContactsSnapshot();
  const organizationsBefore = getOrganizationAccountsSnapshot();
  const now = command.now ?? new Date().toISOString();
  try {
    let updatedTarget: Contact | undefined;
    for (const contact of contactsBefore) {
      const relationship = getContactOrganizationRelationships(contact).find(
        (item) => item.organizationAccountId === organization.id && !item.effectiveTo,
      );
      if (!relationship) continue;
      const updated = setContactOrganizationPrimaryFlag(contact, organization.id, contact.id === target.id, {
        actorId: command.actorId,
        now,
      });
      const saved = saveContactSnapshot(updated);
      if (contact.id === target.id) updatedTarget = saved;
    }
    if (!updatedTarget) throw new Error("ORGANIZATION_PRIMARY_REPRESENTATIVE_ACTIVE_LINK_REQUIRED");
    const updatedOrganization = saveOrganizationAccountSnapshot({
      ...ensureOrganizationContactRef(organization, target.id, now),
      primaryContactId: target.id,
      updatedAt: now,
    });
    return {
      contact: updatedTarget,
      organization: updatedOrganization,
      relationship: getContactOrganizationRelationships(updatedTarget).find(
        (item) => item.organizationAccountId === organization.id && !item.effectiveTo,
      ),
    };
  } catch (error) {
    replaceContacts(contactsBefore);
    replaceOrganizationAccounts(organizationsBefore);
    throw error;
  }
}


export interface CreateOrganizationWithRepresentativeCommand {
  organization: OrganizationAccount;
  representative: Contact;
  relationship: ContactOrganizationRelationshipDraft;
  actorId: string;
  now?: string;
}

export function createOrganizationWithRepresentativeWorkflow(
  command: CreateOrganizationWithRepresentativeCommand,
): ContactOrganizationRelationshipResult {
  assertLegacyRelationshipWriteMode();
  const contactsBefore = getContactsSnapshot();
  const organizationsBefore = getOrganizationAccountsSnapshot();
  const now = command.now ?? new Date().toISOString();
  if (command.relationship.organizationAccountId !== command.organization.id) {
    throw new Error("ORGANIZATION_RELATIONSHIP_TARGET_MISMATCH");
  }
  if (getOrganizationAccountSnapshot(command.organization.id)) throw new Error(`ORGANIZATION_ALREADY_EXISTS:${command.organization.id}`);
  if (contactsBefore.some((contact) => contact.id === command.representative.id)) throw new Error(`CONTACT_ALREADY_EXISTS:${command.representative.id}`);
  try {
    saveOrganizationAccountSnapshot({
      ...command.organization,
      contactRefs: [],
      primaryContactId: undefined,
      updatedAt: now,
    });
    saveContactSnapshot({
      ...command.representative,
      organizationAccountId: undefined,
      organizationRelationships: [],
      isPrimaryContact: false,
      updatedAt: now,
    });
    return upsertContactOrganizationRelationshipWorkflow({
      contactId: command.representative.id,
      relationship: { ...command.relationship, isPrimaryRepresentative: true },
      actorId: command.actorId,
      now,
    });
  } catch (error) {
    replaceContacts(contactsBefore);
    replaceOrganizationAccounts(organizationsBefore);
    throw error;
  }
}

export interface CreateOrganizationRepresentativeCommand {
  organizationAccountId: string;
  representative: Contact;
  relationship: Omit<ContactOrganizationRelationshipDraft, "organizationAccountId">;
  actorId: string;
  now?: string;
}

export function createOrganizationRepresentativeWorkflow(
  command: CreateOrganizationRepresentativeCommand,
): ContactOrganizationRelationshipResult {
  assertLegacyRelationshipWriteMode();
  const contactsBefore = getContactsSnapshot();
  const organizationsBefore = getOrganizationAccountsSnapshot();
  const now = command.now ?? new Date().toISOString();
  requireOrganization(command.organizationAccountId);
  if (contactsBefore.some((contact) => contact.id === command.representative.id)) throw new Error(`CONTACT_ALREADY_EXISTS:${command.representative.id}`);
  try {
    saveContactSnapshot({
      ...command.representative,
      organizationAccountId: undefined,
      organizationRelationships: [],
      isPrimaryContact: false,
      updatedAt: now,
    });
    return upsertContactOrganizationRelationshipWorkflow({
      contactId: command.representative.id,
      relationship: {
        ...command.relationship,
        organizationAccountId: command.organizationAccountId,
      },
      actorId: command.actorId,
      now,
    });
  } catch (error) {
    replaceContacts(contactsBefore);
    replaceOrganizationAccounts(organizationsBefore);
    throw error;
  }
}

/**
 * True when contact-organization relationship changes cannot run in the active runtime.
 * All three relationship commands are BLOCKED in the canonical registry, so presentation
 * can refuse before starting a mutation the boundary would reject.
 */
export function isContactOrganizationRelationshipUnavailable(): boolean {
  return isContactConnectedApiRuntime()
    || isMutationCommandUnavailable("contact-organization.upsert-relationship");
}

export function upsertContactOrganizationRelationshipCommand(
  command: UpsertContactOrganizationRelationshipCommand,
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<ContactOrganizationRelationshipResult>> {
  assertMutationCommandSupported("contact-organization.upsert-relationship", "Contact-organization relationship save");
  const current = requireContact(command.contactId);
  return executeMutationCommand(
    {
      commandType: "contact-organization.upsert-relationship",
      aggregateType: "contact",
      aggregateId: command.contactId,
      payload: command,
    },
    createMutationMetadata(`contact-organization.upsert:${command.contactId}:${command.relationship.organizationAccountId}`, {
      ...metadata,
      expectedVersion: metadata.expectedVersion ?? toExpectedVersion(current.updatedAt),
      actor: metadata.actor ?? { id: command.actorId },
    }),
    () => upsertContactOrganizationRelationshipWorkflow(command),
  );
}

export function endContactOrganizationRelationshipCommand(
  command: EndContactOrganizationRelationshipCommand,
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<ContactOrganizationRelationshipResult>> {
  assertMutationCommandSupported("contact-organization.end-relationship", "Contact-organization relationship end");
  const current = requireContact(command.contactId);
  return executeMutationCommand(
    {
      commandType: "contact-organization.end-relationship",
      aggregateType: "contact",
      aggregateId: command.contactId,
      payload: command,
    },
    createMutationMetadata(`contact-organization.end:${command.contactId}:${command.organizationAccountId}`, {
      ...metadata,
      expectedVersion: metadata.expectedVersion ?? toExpectedVersion(current.updatedAt),
      actor: metadata.actor ?? { id: command.actorId },
    }),
    () => endContactOrganizationRelationshipWorkflow(command),
  );
}

export function setPrimaryOrganizationRepresentativeCommand(
  command: SetPrimaryOrganizationRepresentativeCommand,
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<ContactOrganizationRelationshipResult>> {
  assertMutationCommandSupported("contact-organization.set-primary-representative", "Primary representative change");
  const current = requireOrganization(command.organizationAccountId);
  return executeMutationCommand(
    {
      commandType: "contact-organization.set-primary-representative",
      aggregateType: "organization",
      aggregateId: command.organizationAccountId,
      payload: command,
    },
    createMutationMetadata(`contact-organization.primary:${command.organizationAccountId}:${command.contactId}`, {
      ...metadata,
      expectedVersion: metadata.expectedVersion ?? toExpectedVersion(current.updatedAt),
      actor: metadata.actor ?? { id: command.actorId },
    }),
    () => setPrimaryOrganizationRepresentativeWorkflow(command),
  );
}

function ensureOrganizationContactRef(
  organization: OrganizationAccount,
  contactId: string,
  now?: string,
): OrganizationAccount {
  if (organization.contactRefs.some((ref) => ref.id === contactId)) return organization;
  return {
    ...organization,
    contactRefs: [...organization.contactRefs, { type: "CONTACT", id: contactId }],
    updatedAt: now ?? new Date().toISOString(),
  };
}

function requireContact(contactId: string): Contact {
  const contact = getContactsSnapshot().find((item) => item.id === contactId);
  if (!contact) throw new Error(`CONTACT_NOT_FOUND:${contactId}`);
  return contact;
}

function requireOrganization(organizationAccountId: string): OrganizationAccount {
  const organization = getOrganizationAccountSnapshot(organizationAccountId);
  if (!organization) throw new Error(`ORGANIZATION_NOT_FOUND:${organizationAccountId}`);
  return organization;
}

function toExpectedVersion(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
