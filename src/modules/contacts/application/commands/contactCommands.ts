import type { CRMActivity } from "@/shared/domain";
import type { ContactRepository } from "../ports/ContactRepository";
import type { Contact, ContactStatus } from "../../domain/model/contact.types";
import { updateContact } from "./contactRepositoryCommands";
import { CAPABILITIES, assertRuntimeCommandAccess } from "@/platform/access-control";

export function changeContactStatus(
  repository: ContactRepository,
  contactId: string,
  status: ContactStatus,
  activity?: CRMActivity,
): Contact | undefined {
  return updateContact(repository, contactId, (contact) => ({
    ...contact,
    status,
    updatedAt: new Date().toISOString(),
    ...(activity ? { activities: [activity, ...(contact.activities ?? [])] } : {}),
  }));
}

export function appendActivityToContact(
  repository: ContactRepository,
  contactId: string,
  activity: CRMActivity,
): Contact | undefined {
  return updateContact(repository, contactId, (contact) => ({
    ...contact,
    activities: [activity, ...(contact.activities ?? [])],
    lastInteractionAt: activity.createdAt,
    updatedAt: new Date().toISOString(),
  }));
}

export function reassignContact(
  repository: ContactRepository,
  contactId: string,
  ownerId: string,
  activity?: CRMActivity,
): Contact | undefined {
  const current = repository.getById(contactId);
  assertRuntimeCommandAccess(CAPABILITIES.CONTACTS_ASSIGN, "contacts", current);
  return updateContact(repository, contactId, (contact) => ({
    ...contact,
    ownerId,
    updatedAt: new Date().toISOString(),
    ...(activity ? { activities: [activity, ...(contact.activities ?? [])] } : {}),
  }));
}
