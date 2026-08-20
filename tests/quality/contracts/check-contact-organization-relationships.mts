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

const workflowSource = read("src/workflows/contact-organization-relationship/index.ts");
for (const marker of [
  "upsertContactOrganizationRelationshipCommand",
  "endContactOrganizationRelationshipCommand",
  "setPrimaryOrganizationRepresentativeCommand",
  "replaceContacts(contactsBefore)",
  "replaceOrganizationAccounts(organizationsBefore)",
]) assert.ok(workflowSource.includes(marker), `Contact–Organization workflow is missing ${marker}.`);
assert.equal(workflowSource.includes("filter((contact) => contact.id !=="), false, "Relationship management must not hard-delete Contact records.");

const routeSource = read("src/platform/api/runtime/RoutedHttpMutationAuthority.ts");
const decisionLedger = read("docs/backend-readiness/unresolved-decisions.json");
for (const command of [
  "contact-organization.upsert-relationship",
  "contact-organization.end-relationship",
  "contact-organization.set-primary-representative",
]) {
  assert.equal(
    routeSource.includes(command),
    false,
    `Connected mutation routing must fail closed for ${command} until its OpenAPI contract is production-ready.`,
  );
  assert.ok(decisionLedger.includes(`"${command}"`), `The blocked decision ledger is missing ${command}.`);
}

const contactUi = read("src/modules/contacts/presentation/detail/ContactOrganizationRelationshipsPanel.tsx");
for (const marker of ["effectiveFrom", "isPrimaryRepresentative", "endContactOrganizationRelationshipCommand", "upsertContactOrganizationRelationshipCommand"]) assert.ok(contactUi.includes(marker), `Contact relationship UI is missing ${marker}.`);
const organizationUi = read("src/modules/organizations/presentation/detail/OrganizationRepresentativesTab.tsx");
assert.ok(organizationUi.includes("findContactOrganizationRelationship"));
assert.ok(organizationUi.includes("onEndRelationship"));
const editSource = read("src/modules/contacts/presentation/detail/ContactEditModal.tsx");
assert.ok(editSource.includes("applyContactOrganizationRelationshipProjection"), "Generic Contact editing must preserve canonical organization memberships.");

console.log("Contact–Organization relationships: PASS");
