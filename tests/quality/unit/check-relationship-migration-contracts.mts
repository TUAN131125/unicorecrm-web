import assert from "node:assert/strict";
import { CONTACT_SEED } from "../../../src/modules/contacts/infrastructure/contact.mock";
import { CUSTOMER_RELATIONSHIP_MIGRATION_RECORDS as MOCK_CUSTOMERS } from "../../../src/migrations/canonical-v1/customerRelationshipMigration.records";
import { migrateCustomerRelationshipRecords } from "../../../src/migrations/canonical-v1";

const contactsBeforeLegacyCustomerMigration = CONTACT_SEED.filter((contact) => contact.id !== "contact_customer_c3");
const firstMigration = migrateCustomerRelationshipRecords(MOCK_CUSTOMERS, contactsBeforeLegacyCustomerMigration);
const secondMigration = migrateCustomerRelationshipRecords(MOCK_CUSTOMERS, contactsBeforeLegacyCustomerMigration);

assert.deepEqual(firstMigration, secondMigration, "Relationship migration must be deterministic");
assert.equal(
  firstMigration.organizationAccounts.length,
  MOCK_CUSTOMERS.filter((customer) => customer.type === "COMPANY").length,
  "Every legacy company identity must migrate to an Organization Account",
);
assert.equal(
  firstMigration.contactsToCreate.length,
  MOCK_CUSTOMERS.filter((customer) => customer.type === "INDIVIDUAL").length,
  "Every unmatched legacy individual identity must migrate to a Contact",
);
assert.equal(
  firstMigration.customerViewProfiles.length,
  MOCK_CUSTOMERS.length,
  "Every legacy Customer record must have a Customer View migration profile",
);
assert.equal(
  CONTACT_SEED.find((contact) => contact.id === "con1")?.organizationAccountId,
  "org_c1",
  "Canonical Contact seed must preserve the Organization relationship migrated from legacy Customer identity.",
);
assert.equal(
  firstMigration.contactOrganizationLinks.some((link) => link.contactId === "con1"),
  false,
  "Migration must not emit a duplicate link for a Contact already attached to its Organization Account.",
);
assert.ok(
  firstMigration.issues.some((issue) => issue.rule === "INDIVIDUAL_CUSTOMER_IDENTITY_AMBIGUOUS"),
  "Conflicting phone-only identity candidates must be reported for review instead of auto-merged",
);
assert.equal(
  firstMigration.customerViewProfiles.find((profile) => profile.legacyCustomerId === "c2")?.customerState,
  "ACTIVE",
  "Migration must not copy legacy churned status directly into projected customerState",
);

console.log("Relationship migration contracts: OK");
