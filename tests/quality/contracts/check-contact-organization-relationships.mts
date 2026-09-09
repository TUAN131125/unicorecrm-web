import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  endContactOrganizationRelationship,
  getActiveContactOrganizationRelationships,
  getContactOrganizationRelationships,
  getPrimaryContactOrganizationRelationship,
  setContactOrganizationPrimaryFlag,
  upsertContactOrganizationRelationship,
} from "@/modules/contacts/domain/model/contactOrganizationRelationships";
import type { Contact } from "@/modules/contacts/domain/model/contact.types";
import { ContactHttpCommandAdapter } from "@/modules/contacts/infrastructure/http/ContactHttpCommandAdapter";
import type { CommercialApiClient, ContactMutationResponse } from "@/platform/api/generated/commercialApi";
import { configureContactApplication, resetContactApplication, type ContactApplicationServices } from "@/modules/contacts/application/composition/contactApplicationServices";
import {
  createOrganizationRepresentativeWorkflow,
  createOrganizationWithRepresentativeWorkflow,
  endContactOrganizationRelationshipWorkflow,
  isContactOrganizationRelationshipUnavailable,
  setPrimaryOrganizationRepresentativeWorkflow,
  upsertContactOrganizationRelationshipWorkflow,
} from "@/workflows/contact-organization-relationship";

const read = (relativePath: string) => fs.readFileSync(path.resolve(relativePath), "utf8");
const now = "2026-07-19T10:00:00.000Z";
const base: Contact = { id: "contact-1", name: "Nguyen An", fullName: "Nguyen An", status: "active", createdAt: "2026-01-01T00:00:00.000Z" };

const first = upsertContactOrganizationRelationship(base, {
  organizationAccountId: "org-1",
  role: "executive",
  roleTitle: "CEO",
  isPrimaryRepresentative: true,
  effectiveFrom: "2026-01-01T00:00:00.000Z",
}, { actorId: "u1", now });
assert.equal(getActiveContactOrganizationRelationships(first, now).length, 1);
assert.equal(first.organizationAccountId, "org-1");
assert.equal(first.roleAtCompany, "CEO");
assert.equal(first.isPrimaryContact, true);

const second = upsertContactOrganizationRelationship(first, {
  organizationAccountId: "org-2",
  role: "advisor",
  roleTitle: "Board Advisor",
  isPrimaryRepresentative: false,
  effectiveFrom: "2026-02-01T00:00:00.000Z",
}, { actorId: "u1", now });
assert.equal(getActiveContactOrganizationRelationships(second, now).length, 2, "A Contact must support multiple active organizations.");
assert.deepEqual(getActiveContactOrganizationRelationships(second, now).map((item) => item.organizationAccountId), ["org-1", "org-2"]);

const primaryOrg2 = setContactOrganizationPrimaryFlag(second, "org-2", true, { actorId: "u1", now });
assert.equal(getPrimaryContactOrganizationRelationship(primaryOrg2, now)?.organizationAccountId, "org-1", "Compatibility projection remains deterministic when the Contact is primary at multiple organizations.");
assert.equal(getContactOrganizationRelationships(primaryOrg2).find((item) => item.organizationAccountId === "org-2")?.isPrimaryRepresentative, true);

const ended = endContactOrganizationRelationship(primaryOrg2, "org-1", { actorId: "u1", reason: "Left the company", effectiveTo: "2026-07-19T09:00:00.000Z" });
assert.equal(getActiveContactOrganizationRelationships(ended, now).length, 1);
assert.equal(ended.organizationAccountId, "org-2", "Legacy organizationAccountId must project the remaining active relationship.");
assert.equal(getContactOrganizationRelationships(ended).length, 2, "Ending a relationship must preserve history.");
assert.throws(() => endContactOrganizationRelationship(ended, "org-2", { actorId: "u1", reason: "" }), /END_REASON_REQUIRED/);

const legacy: Contact = { ...base, organizationAccountId: "legacy-org", roleAtCompany: "Procurement", isPrimaryContact: true };
const legacyRelationships = getContactOrganizationRelationships(legacy);
assert.equal(legacyRelationships.length, 1);
assert.equal(legacyRelationships[0]?.organizationAccountId, "legacy-org");
assert.equal(legacyRelationships[0]?.isPrimaryRepresentative, true);

const contactUi = read("src/modules/contacts/presentation/detail/ContactOrganizationRelationshipsPanel.tsx");
for (const marker of ["effectiveFrom", "isPrimaryAffiliation", "createOrganizationRelationship", "updateOrganizationRelationship", "endOrganizationRelationship"]) assert.ok(contactUi.includes(marker), `Contact relationship UI is missing ${marker}.`);
assert.equal((contactUi.match(/await summary\.refresh\(\)/gu) ?? []).length, 4, "Organization panel must refetch after success and failure so stale-version retry is usable without losing the draft.");
const customerUi = read("src/modules/contacts/presentation/detail/ContactCustomerRelationshipsPanel.tsx");
for (const marker of ["primary_contact", "createCustomerRelationship", "updateCustomerRelationship", "endCustomerRelationship"]) assert.ok(customerUi.includes(marker), `Contact Customer stakeholder UI is missing ${marker}.`);
assert.equal((customerUi.match(/await summary\.refresh\(\)/gu) ?? []).length, 4, "Customer panel must refetch after success and failure so stale-version retry is usable without losing the draft.");
const commandPort = read("src/modules/contacts/application/ports/ContactApiRuntime.ts");
for (const operation of ["createOrganizationRelationship", "updateOrganizationRelationship", "endOrganizationRelationship", "createCustomerRelationship", "updateCustomerRelationship", "endCustomerRelationship"]) assert.ok(commandPort.includes(operation), `Generated-client command boundary is missing ${operation}.`);
const httpAdapter = read("src/modules/contacts/infrastructure/http/ContactHttpCommandAdapter.ts");
for (const operation of ["createContactOrganizationRelationship", "updateContactOrganizationRelationship", "endContactOrganizationRelationship", "createContactCustomerRelationship", "updateContactCustomerRelationship", "endContactCustomerRelationship"]) assert.ok(httpAdapter.includes(operation), `HTTP adapter is missing canonical operation ${operation}.`);
assert.equal(contactUi.includes("replaceOrganizationAccounts"), false, "Connected Contact relationship UI must not dual-write Organization state.");
const organizationUi = read("src/modules/organizations/presentation/detail/OrganizationRepresentativesTab.tsx");
assert.ok(organizationUi.includes("findContactOrganizationRelationship"));
assert.ok(organizationUi.includes("onEndRelationship"));
const editSource = read("src/modules/contacts/presentation/detail/ContactEditModal.tsx");
assert.equal(editSource.includes("applyContactOrganizationRelationshipProjection"), false, "Generic Contact editing must not mutate the first-class relationship ledger.");

const calls: Array<{ operation: string; args: unknown[] }> = [];
const response = (version: number): ContactMutationResponse => ({
  commandId: `command-${version}`, correlationId: "correlation-c6", aggregateId: "contact-1",
  aggregateType: "contact", version, occurredAt: now, outcome: "COMMITTED",
  result: { contact: { id: "contact-1", workspaceId: "workspace-1", fullName: "Authoritative Contact", status: "active", version, createdAt: now, updatedAt: now } },
  warnings: [], emittedEventIds: [], auditEvidenceIds: [],
});
const invoke = (operation: string, version: number, args: unknown[]) => { calls.push({ operation, args }); return Promise.resolve(response(version)); };
const api = {
  createContactOrganizationRelationship: (...args: unknown[]) => invoke("createContactOrganizationRelationship", 11, args),
  updateContactOrganizationRelationship: (...args: unknown[]) => invoke("updateContactOrganizationRelationship", 12, args),
  endContactOrganizationRelationship: (...args: unknown[]) => invoke("endContactOrganizationRelationship", 13, args),
  createContactCustomerRelationship: (...args: unknown[]) => invoke("createContactCustomerRelationship", 14, args),
  updateContactCustomerRelationship: (...args: unknown[]) => invoke("updateContactCustomerRelationship", 15, args),
  endContactCustomerRelationship: (...args: unknown[]) => invoke("endContactCustomerRelationship", 16, args),
} as unknown as CommercialApiClient;
const adapter = new ContactHttpCommandAdapter(api);
assert.equal((await adapter.createOrganizationRelationship({ contactId: "contact-1", organizationId: "org-1", role: "employee", isPrimaryAffiliation: false, expectedVersion: 10 })).resourceVersion, 11);
assert.equal((await adapter.updateOrganizationRelationship({ contactId: "contact-1", relationshipId: "org-rel-1", role: "advisor", expectedVersion: 11 })).resourceVersion, 12);
assert.equal((await adapter.endOrganizationRelationship({ contactId: "contact-1", relationshipId: "org-rel-1", endedReason: "ended", expectedVersion: 12 })).resourceVersion, 13);
assert.equal((await adapter.createCustomerRelationship({ contactId: "contact-1", customerId: "customer-1", role: "support", expectedVersion: 13 })).resourceVersion, 14);
assert.equal((await adapter.updateCustomerRelationship({ contactId: "contact-1", relationshipId: "customer-rel-1", role: "technical", expectedVersion: 14 })).resourceVersion, 15);
assert.equal((await adapter.endCustomerRelationship({ contactId: "contact-1", relationshipId: "customer-rel-1", endedReason: "ended", expectedVersion: 15 })).resourceVersion, 16);
assert.deepEqual(calls.map(({ operation }) => operation), [
  "createContactOrganizationRelationship", "updateContactOrganizationRelationship", "endContactOrganizationRelationship",
  "createContactCustomerRelationship", "updateContactCustomerRelationship", "endContactCustomerRelationship",
]);
assert.deepEqual(calls.map(({ args }) => (args.at(-1) as { expectedVersion?: number }).expectedVersion), [10, 11, 12, 13, 14, 15]);

const legacyWorkflow = read("src/workflows/contact-organization-relationship/index.ts");
assert.ok(legacyWorkflow.includes("assertLegacyRelationshipWriteMode"), "Connected mode must fail closed before any legacy dual-write workflow executes.");
assert.ok(legacyWorkflow.includes("isContactConnectedApiRuntime"), "Legacy workflow guard must bind to the actual Contact runtime mode.");

configureContactApplication({ api: { mode: "connected" } } as unknown as ContactApplicationServices);
try {
  assert.equal(isContactOrganizationRelationshipUnavailable(), true);
  for (const invokeLegacyWrite of [
    () => upsertContactOrganizationRelationshipWorkflow({} as never),
    () => endContactOrganizationRelationshipWorkflow({} as never),
    () => setPrimaryOrganizationRepresentativeWorkflow({} as never),
    () => createOrganizationWithRepresentativeWorkflow({} as never),
    () => createOrganizationRepresentativeWorkflow({} as never),
  ]) assert.throws(invokeLegacyWrite, /CONTACT_ORGANIZATION_LEGACY_WRITE_DISABLED_IN_CONNECTED_MODE/);
} finally {
  resetContactApplication();
}

console.log("Contact–Organization relationships: PASS");
