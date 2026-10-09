import {
  createAuthoritativeResource,
  runBackendProjection,
  subscribeModuleQueryInvalidation,
  runWorkspaceScopeReset,
  type AuthoritativePage,
  type AuthoritativeResource,
} from "@/shared/application";
import type { ContactRelationshipSummary } from "../ports/ContactApiRuntime";
import type { Contact } from "../../domain/model/contact.types";
import { getContactApiRuntime } from "../composition/contactApplicationServices";
import { getContactsSnapshot, replaceContacts } from "../../public/contacts";
import { getContactReadAuthorityScope, getContactProjectionAuthorityScope, markContactProjectionAuthorityScope } from "./contactReadAuthorityScope";

let collection: AuthoritativeResource<AuthoritativePage<Contact>> | undefined;
let authorityScope: string | undefined;
const details = new Map<string, AuthoritativeResource<Contact>>();
const summaries = new Map<string, AuthoritativeResource<ContactRelationshipSummary>>();
const disposers = new Map<object, () => void>();

function currentScope(): string {
  const scope = getContactReadAuthorityScope();
  if (authorityScope !== undefined && authorityScope !== scope) {
    const previous = [collection, ...details.values(), ...summaries.values()];
    for (const resource of previous) if (resource) { disposers.get(resource)?.(); disposers.delete(resource); }
    collection = undefined;
    details.clear();
    summaries.clear();
    // Render-time factories return empty resources immediately, without notifying
    // mounted subscribers until the current render completes.
    queueMicrotask(() => {
      for (const resource of previous) resource?.reset();
      if (scope === getContactReadAuthorityScope() && getContactProjectionAuthorityScope() !== scope) runWorkspaceScopeReset(() => {
        markContactProjectionAuthorityScope(scope);
        replaceContacts([]);
      });
    });
  }
  authorityScope = scope;
  return scope;
}
function assertCurrent(signal: AbortSignal, scope: string): void {
  signal.throwIfAborted();
  if (scope !== getContactReadAuthorityScope()) throw new DOMException("Contact read authority changed", "AbortError");
}
export function getContactCollectionResource(): AuthoritativeResource<AuthoritativePage<Contact>> {
  currentScope();
  collection ??= createCollectionResource();
  return collection;
}

export function getContactDetailResource(contactId: string): AuthoritativeResource<Contact> {
  currentScope();
  let resource = details.get(contactId);
  if (!resource) {
    resource = createDetailResource(contactId);
    details.set(contactId, resource);
  }
  return resource;
}

export function getContactRelationshipSummaryResource(contactId: string): AuthoritativeResource<ContactRelationshipSummary> {
  currentScope();
  let resource = summaries.get(contactId);
  if (!resource) {
    resource = createSummaryResource(contactId);
    summaries.set(contactId, resource);
  }
  return resource;
}

function createCollectionResource(): AuthoritativeResource<AuthoritativePage<Contact>> {
  const ownerScope = getContactReadAuthorityScope();
  const resource = createAuthoritativeResource(async (signal) => {
    const scope = ownerScope;
    assertCurrent(signal, scope);
    const page = await getContactApiRuntime().queries.list({}, signal);
    assertCurrent(signal, scope);
    runBackendProjection("contacts", () => {
      markContactProjectionAuthorityScope(scope);
      replaceContacts(page.items);
    });
    return page;
  });
  disposers.set(resource, subscribeModuleQueryInvalidation("contacts", async () => { if (resource.getSnapshot().state !== "IDLE") await resource.refresh(); }));
  return resource;
}

function createDetailResource(contactId: string): AuthoritativeResource<Contact> {
  const ownerScope = getContactReadAuthorityScope();
  const resource = createAuthoritativeResource(async (signal) => {
    const scope = ownerScope;
    assertCurrent(signal, scope);
    const contact = await getContactApiRuntime().queries.get(contactId, signal);
    assertCurrent(signal, scope);
    runBackendProjection("contacts", () => upsertContact(contact));
    return contact;
  });
  disposers.set(resource, subscribeModuleQueryInvalidation("contacts", async () => { if (resource.getSnapshot().state !== "IDLE") await resource.refresh(); }));
  return resource;
}

function createSummaryResource(contactId: string): AuthoritativeResource<ContactRelationshipSummary> {
  const ownerScope = getContactReadAuthorityScope();
  const resource = createAuthoritativeResource(async (signal) => {
    const scope = ownerScope;
    assertCurrent(signal, scope);
    const summary = await getContactApiRuntime().queries.getRelationshipSummary(contactId, signal);
    assertCurrent(signal, scope);
    runBackendProjection("contacts", () => upsertContact(summary.contact));
    return summary;
  });
  disposers.set(resource, subscribeModuleQueryInvalidation("contacts", async () => { if (resource.getSnapshot().state !== "IDLE") await resource.refresh(); }));
  return resource;
}

function upsertContact(contact: Contact): void {
  const scope = getContactReadAuthorityScope();
  const current = getContactProjectionAuthorityScope() === scope ? getContactsSnapshot() : [];
  markContactProjectionAuthorityScope(scope);
  replaceContacts(current.some((item) => item.id === contact.id)
    ? current.map((item) => item.id === contact.id ? contact : item)
    : [...current, contact]);
}
