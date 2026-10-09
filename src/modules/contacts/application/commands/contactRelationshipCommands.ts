import type { Contact } from "../../domain/model/contact.types";
import { getContactApiRuntime } from "../composition/contactApplicationServices";
import { projectContactApiResult } from "./contactApiCommands";
import { getContactReadAuthorityScope } from "../vertical-slice/contactReadAuthorityScope";
import type {
  ContactCommandOptions,
  CreateContactOrganizationRelationshipCommand, UpdateContactOrganizationRelationshipCommand, EndContactOrganizationRelationshipCommand,
  CreateContactCustomerRelationshipCommand, UpdateContactCustomerRelationshipCommand, EndContactCustomerRelationshipCommand,
} from "../ports/ContactApiRuntime";

function requireCommands() {
  const commands = getContactApiRuntime().commands;
  if (!commands) throw new Error("CONTACT_RELATIONSHIP_COMMAND_UNAVAILABLE");
  return commands;
}

export async function createContactOrganizationRelationshipViaApi(input: CreateContactOrganizationRelationshipCommand, options?: ContactCommandOptions): Promise<Contact> {
  const scope = getContactReadAuthorityScope();
  const contact = await requireCommands().createOrganizationRelationship(input, options);
  await projectContactApiResult(contact, "contact.relationship.organization.create", scope);
  return contact;
}

export async function updateContactOrganizationRelationshipViaApi(input: UpdateContactOrganizationRelationshipCommand, options?: ContactCommandOptions): Promise<Contact> {
  const scope = getContactReadAuthorityScope();
  const contact = await requireCommands().updateOrganizationRelationship(input, options);
  await projectContactApiResult(contact, "contact.relationship.organization.update", scope);
  return contact;
}

export async function endContactOrganizationRelationshipViaApi(input: EndContactOrganizationRelationshipCommand, options?: ContactCommandOptions): Promise<Contact> {
  const scope = getContactReadAuthorityScope();
  const contact = await requireCommands().endOrganizationRelationship(input, options);
  await projectContactApiResult(contact, "contact.relationship.organization.end", scope);
  return contact;
}

export async function createContactCustomerRelationshipViaApi(input: CreateContactCustomerRelationshipCommand, options?: ContactCommandOptions): Promise<Contact> {
  const scope = getContactReadAuthorityScope();
  const contact = await requireCommands().createCustomerRelationship(input, options);
  await projectContactApiResult(contact, "contact.relationship.customer.create", scope);
  return contact;
}

export async function updateContactCustomerRelationshipViaApi(input: UpdateContactCustomerRelationshipCommand, options?: ContactCommandOptions): Promise<Contact> {
  const scope = getContactReadAuthorityScope();
  const contact = await requireCommands().updateCustomerRelationship(input, options);
  await projectContactApiResult(contact, "contact.relationship.customer.update", scope);
  return contact;
}

export async function endContactCustomerRelationshipViaApi(input: EndContactCustomerRelationshipCommand, options?: ContactCommandOptions): Promise<Contact> {
  const scope = getContactReadAuthorityScope();
  const contact = await requireCommands().endCustomerRelationship(input, options);
  await projectContactApiResult(contact, "contact.relationship.customer.end", scope);
  return contact;
}
