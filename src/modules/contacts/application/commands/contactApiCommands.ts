import { invalidateModuleQueries, runBackendProjection } from "@/shared/application";
import type { Contact } from "../../domain/model/contact.types";
import { getContactApiRuntime, contactRepository } from "../composition/contactApplicationServices";
import { saveContact } from "./contactRepositoryCommands";

export async function createContactViaApi(input: Contact): Promise<Contact> {
  const created = await requireCommands().create(input);
  await project(created, "contact.create");
  return created;
}

export async function updateContactViaApi(input: Contact): Promise<Contact> {
  const version = requireVersion(input, "updateContact");
  const updated = await requireCommands().update(input.id, input, version);
  await project(updated, "contact.update");
  return updated;
}

export async function archiveContactViaApi(contactId: string): Promise<Contact> {
  const current = contactRepository.getById(contactId);
  if (!current) throw new Error(`CONTACT_NOT_FOUND:${contactId}`);
  const archived = await requireCommands().archive(contactId, requireVersion(current, "archiveContact"));
  runBackendProjection("contacts", () => contactRepository.replace(contactRepository.list().filter((item) => item.id !== contactId)));
  await invalidateModuleQueries({ moduleKeys: ["contacts"], commandType: "contact.archive", aggregateId: contactId, occurredAt: archived.updatedAt ?? new Date().toISOString() });
  return archived;
}

function requireCommands() {
  const commands = getContactApiRuntime().commands;
  if (!commands) throw new Error("CONTACT_COMMANDS_UNAVAILABLE");
  return commands;
}

function requireVersion(contact: Contact, operation: string): number {
  if (!Number.isInteger(contact.resourceVersion) || Number(contact.resourceVersion) < 0) throw new Error(`${operation}:CONTACT_VERSION_REQUIRED`);
  return Number(contact.resourceVersion);
}

async function project(contact: Contact, commandType: string): Promise<void> {
  runBackendProjection("contacts", () => saveContact(contactRepository, contact));
  await invalidateModuleQueries({ moduleKeys: ["contacts"], commandType, aggregateId: contact.id, occurredAt: contact.updatedAt ?? new Date().toISOString() });
}
