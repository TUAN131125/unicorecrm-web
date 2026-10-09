import { invalidateModuleQueries, runBackendProjection } from "@/shared/application";
import type { Contact } from "../../domain/model/contact.types";
import type { ContactArchiveCommand, ContactCreateCommand, ContactUpdateCommand, ContactCommandOptions } from "../ports/ContactApiRuntime";
import { getContactApiRuntime, contactRepository } from "../composition/contactApplicationServices";
import { saveContact } from "./contactRepositoryCommands";
import { getContactReadAuthorityScope, getContactProjectionAuthorityScope, markContactProjectionAuthorityScope } from "../vertical-slice/contactReadAuthorityScope";

export async function createContactViaApi(input: ContactCreateCommand, options?: ContactCommandOptions): Promise<Contact> {
  const scope = getContactReadAuthorityScope();
  const created = await requireCommands().create(input, options);
  await projectContactApiResult(created, "contact.create", scope);
  return created;
}

export async function updateContactViaApi(input: ContactUpdateCommand, options?: ContactCommandOptions): Promise<Contact> {
  const scope = getContactReadAuthorityScope();
  const updated = await requireCommands().update(input, options);
  await projectContactApiResult(updated, "contact.update", scope);
  return updated;
}

export async function archiveContactViaApi(input: ContactArchiveCommand): Promise<Contact> {
  const scope = getContactReadAuthorityScope();
  const archived = await requireCommands().archive(input);
  await projectContactApiResult(archived, "contact.archive", scope);
  return archived;
}

function requireCommands() {
  const commands = getContactApiRuntime().commands;
  if (!commands) throw new Error("CONTACT_COMMANDS_UNAVAILABLE");
  return commands;
}

export async function projectContactApiResult(contact: Contact, commandType: string, scope: string): Promise<void> {
  if (scope !== getContactReadAuthorityScope()) return;
  runBackendProjection("contacts", () => {
    if (getContactProjectionAuthorityScope() !== scope) contactRepository.replace([]);
    markContactProjectionAuthorityScope(scope);
    saveContact(contactRepository, contact);
  });
  await invalidateModuleQueries({ moduleKeys: ["contacts"], commandType, aggregateId: contact.id, occurredAt: contact.updatedAt ?? new Date().toISOString() });
}
