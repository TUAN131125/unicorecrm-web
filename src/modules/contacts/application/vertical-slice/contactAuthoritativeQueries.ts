import {
  createAuthoritativeResource,
  runBackendProjection,
  subscribeModuleQueryInvalidation,
  type AuthoritativePage,
  type AuthoritativeResource,
} from "@/shared/application";
import type { ContactRelationshipSummary } from "../ports/ContactApiRuntime";
import type { Contact } from "../../domain/model/contact.types";
import { getContactApiRuntime } from "../composition/contactApplicationServices";
import { getContactsSnapshot, replaceContacts } from "../../public/contacts";

const collection = createCollectionResource();
const details = new Map<string, AuthoritativeResource<Contact>>();
const summaries = new Map<string, AuthoritativeResource<ContactRelationshipSummary>>();

export function getContactCollectionResource(): AuthoritativeResource<AuthoritativePage<Contact>> { return collection; }

export function getContactDetailResource(contactId: string): AuthoritativeResource<Contact> {
  let resource = details.get(contactId);
  if (!resource) {
    resource = createDetailResource(contactId);
    details.set(contactId, resource);
  }
  return resource;
}

export function getContactRelationshipSummaryResource(contactId: string): AuthoritativeResource<ContactRelationshipSummary> {
  let resource = summaries.get(contactId);
  if (!resource) {
    resource = createSummaryResource(contactId);
    summaries.set(contactId, resource);
  }
  return resource;
}

function createCollectionResource(): AuthoritativeResource<AuthoritativePage<Contact>> {
  const resource = createAuthoritativeResource(async (signal) => {
    const page = await getContactApiRuntime().queries.list({}, signal);
    runBackendProjection("contacts", () => replaceContacts(page.items));
    return page;
  });
  subscribeModuleQueryInvalidation("contacts", async () => { if (resource.getSnapshot().state !== "IDLE") await resource.refresh(); });
  return resource;
}

function createDetailResource(contactId: string): AuthoritativeResource<Contact> {
  const resource = createAuthoritativeResource(async (signal) => {
    const contact = await getContactApiRuntime().queries.get(contactId, signal);
    runBackendProjection("contacts", () => upsertContact(contact));
    return contact;
  });
  subscribeModuleQueryInvalidation("contacts", async () => { if (resource.getSnapshot().state !== "IDLE") await resource.refresh(); });
  return resource;
}

function createSummaryResource(contactId: string): AuthoritativeResource<ContactRelationshipSummary> {
  const resource = createAuthoritativeResource(async (signal) => {
    const summary = await getContactApiRuntime().queries.getRelationshipSummary(contactId, signal);
    runBackendProjection("contacts", () => upsertContact(summary.contact));
    return summary;
  });
  subscribeModuleQueryInvalidation("contacts", async () => { if (resource.getSnapshot().state !== "IDLE") await resource.refresh(); });
  return resource;
}

function upsertContact(contact: Contact): void {
  const current = getContactsSnapshot();
  replaceContacts(current.some((item) => item.id === contact.id)
    ? current.map((item) => item.id === contact.id ? contact : item)
    : [...current, contact]);
}
