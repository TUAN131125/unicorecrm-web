import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { PurchaseEvidence } from "@/modules/commercial-evidence";
import { ensureCustomerFromPurchaseEvidence } from "@/modules/customers/application/commands/customerCommands";
import { InMemoryCustomerRepository } from "@/modules/customers/infrastructure/InMemoryCustomerRepository";
import { CUSTOMER_VIEW_MIGRATION_PROFILES } from "@/modules/customers/infrastructure/customerMigration.seed";
import { CUSTOMER_MODULE_MANIFEST } from "@/modules/customers/manifest";
import { getCustomersSnapshot, findCustomerByRelationshipRefSnapshot } from "@/modules/customers";
import { projectCustomerForPresentation } from "@/modules/customers/presentation/model/customerPresentation";
import { getContactSnapshot, replaceContacts, saveContactSnapshot, getContactsSnapshot } from "@/modules/contacts";
import { getOrganizationAccountSnapshot, getOrganizationAccountsSnapshot, replaceOrganizationAccounts, saveOrganizationAccountSnapshot } from "@/modules/organizations";
import { CAPABILITIES } from "@/platform/access-control/domain/capabilityCatalog";
import { createDefaultAccessControlSnapshot } from "@/platform/access-control/runtime/accessControlSeed";
import { migrateStoredAccessControlSnapshot } from "@/platform/access-control/runtime/accessControlMigration";
import { ModuleRegistry } from "@/platform/module-registry/ModuleRegistry";

const root = repositoryRoot;
const workspaceId = "ws_customer_contract";
const repository = new InMemoryCustomerRepository();
const contactRef = { type: "CONTACT" as const, id: "contact_001" };
const organizationRef = { type: "ORGANIZATION_ACCOUNT" as const, id: "org_001" };

const ineffectiveEvidence = evidence("e0", contactRef, "ORDER_COMPLETED", "2026-01-01T00:00:00.000Z", "e_original");
assert.equal(ensureCustomerFromPurchaseEvidence(repository, ensureInput(ineffectiveEvidence)), undefined, "Reversal evidence must not create a Customer.");
assert.equal(repository.list().length, 0, "Contact existence without effective purchase evidence must not create a Customer.");

const firstPurchase = evidence("e1", contactRef, "ORDER_COMPLETED", "2026-02-01T00:00:00.000Z");
const first = ensureCustomerFromPurchaseEvidence(repository, ensureInput(firstPurchase));
assert.ok(first?.created, "First effective B2C purchase must create a Customer.");
assert.equal(first.customer.type, "B2C");
assert.deepEqual(first.customer.relationshipRef, contactRef);
assert.equal(repository.list().length, 1);

const secondPurchase = evidence("e2", contactRef, "EXTERNAL_PURCHASE_CONFIRMED", "2026-04-01T00:00:00.000Z");
const second = ensureCustomerFromPurchaseEvidence(repository, ensureInput(secondPurchase));
assert.equal(second?.created, false, "Subsequent purchase evidence must update the existing Customer.");
assert.equal(second?.customer.id, first.customer.id);
assert.equal(second?.customer.firstPurchaseAt, firstPurchase.occurredAt);
assert.equal(second?.customer.lastPurchaseAt, secondPurchase.occurredAt);
assert.equal(repository.list().length, 1, "One relationship may have at most one Customer per workspace.");

const b2b = ensureCustomerFromPurchaseEvidence(repository, ensureInput(evidence("e3", organizationRef, "ORDER_COMPLETED", "2026-03-01T00:00:00.000Z")));
assert.equal(b2b?.customer.type, "B2B");
assert.deepEqual(b2b?.customer.relationshipRef, organizationRef);
assert.equal(repository.list().length, 2);

assert.throws(() => repository.save({ ...first.customer, id: "duplicate_customer" }), /unique/i, "Repository must reject duplicate relationship membership.");
const beforeReversal = repository.list().length;
ensureCustomerFromPurchaseEvidence(repository, ensureInput(evidence("e4", contactRef, "ORDER_COMPLETED", "2026-05-01T00:00:00.000Z", "e2")));
assert.equal(repository.list().length, beforeReversal, "Refund/reversal evidence must not delete an existing Customer.");

const registry = new ModuleRegistry().register(CUSTOMER_MODULE_MANIFEST);
assert.equal(registry.get("customers")?.routes.length, 4, "Customers must be a registered first-class CRM module with four stable routes.");
assert.deepEqual(CUSTOMER_MODULE_MANIFEST.routes.map((route) => route.path), ["/customers", "/customers/:customerId", "/customers/segments", "/customers/health"]);

const runtimeCustomers = getCustomersSnapshot();
for (const profile of CUSTOMER_VIEW_MIGRATION_PROFILES) {
  const customer = findCustomerByRelationshipRefSnapshot(profile.relationshipRef);
  assert.ok(customer, `Migration/backfill must materialize ${profile.legacyCustomerId} as a real Customer.`);
  assert.ok(customer.legacyAliases?.includes(profile.legacyCustomerId), "Legacy deep-link aliases must be preserved.");
}
assert.ok(runtimeCustomers.length >= CUSTOMER_VIEW_MIGRATION_PROFILES.length, "Runtime Customer list must not be limited to a profile flatMap projection.");

const contactCustomer = runtimeCustomers.find((item) => item.relationshipRef.type === "CONTACT");
if (contactCustomer) {
  const contact = getContactSnapshot(contactCustomer.relationshipRef.id);
  assert.ok(contact, "B2C Customer source Contact must exist.");
  const contactsBefore = getContactsSnapshot();
  const renamed = `${contact.fullName || contact.name} Identity Contract`;
  try {
    saveContactSnapshot({ ...contact, name: renamed, fullName: renamed, updatedAt: "2026-07-09T00:00:00.000Z" });
    assert.equal(projectCustomerForPresentation(contactCustomer).displayName, renamed, "Customer identity must resolve live from Contact owner data.");
  } finally {
    replaceContacts(contactsBefore);
  }
}

const organizationCustomer = runtimeCustomers.find((item) => item.relationshipRef.type === "ORGANIZATION_ACCOUNT");
if (organizationCustomer) {
  const organization = getOrganizationAccountSnapshot(organizationCustomer.relationshipRef.id);
  assert.ok(organization, "B2B Customer source Organization must exist.");
  const organizationsBefore = getOrganizationAccountsSnapshot();
  const renamed = `${organization.displayName} Identity Contract`;
  try {
    saveOrganizationAccountSnapshot({ ...organization, displayName: renamed, updatedAt: "2026-07-09T00:00:00.000Z" });
    assert.equal(projectCustomerForPresentation(organizationCustomer).displayName, renamed, "Customer identity must resolve live from Organization owner data.");
  } finally {
    replaceOrganizationAccounts(organizationsBefore);
  }
}

const defaults = createDefaultAccessControlSnapshot("ws_default");
const ownerRole = defaults.roles.find((role) => role.sourceTemplateId === "workspace-administrator");
assert.ok(ownerRole);
const stale = {
  ...defaults,
  schemaVersion: 1,
  roles: [
    { ...ownerRole, capabilities: ownerRole.capabilities.filter((capability) => !String(capability).startsWith("customers.")).concat("customer_view.read" as never) },
    { roleId: "custom", workspaceId: "ws_default", name: "Custom", isActive: true, capabilities: ["customer_view.read" as never] },
  ],
  dataScopes: [{ policyId: "scope_customer_view", workspaceId: "ws_default", roleId: ownerRole.roleId, resourceKey: "customer_view", scope: "WORKSPACE" as const }],
};
const migrated = migrateStoredAccessControlSnapshot(stale, "ws_default");
assert.ok(migrated.roles[0].capabilities.includes(CAPABILITIES.CUSTOMERS_VIEW), "System-role legacy Customer View read permission must migrate to customers.view.");
assert.equal(migrated.roles[0].capabilities.includes(CAPABILITIES.CUSTOMERS_EDIT), false, "System roles must not regain Customer write capabilities that are not backend-admitted.");
assert.deepEqual(migrated.roles.find((role) => role.roleId === "custom")?.capabilities, [CAPABILITIES.CUSTOMERS_VIEW], "Custom roles may migrate legacy read access but must not gain write capabilities.");
assert.ok(migrated.dataScopes.some((scope) => scope.resourceKey === "customers"), "Persisted Customer View data scopes must migrate to customers.");

const sidebar = read("src/app/shell/layout/Sidebar.tsx");
assert.match(sidebar, /path\("leads"\)[\s\S]*path\("contacts"\)[\s\S]*path\("organizations"\)[\s\S]*path\("customers"\)/, "Customers must appear fourth in the CRM customer group.");
assert.match(sidebar, /label\("Hồ sơ khách hàng", "Customer profiles"\)/);

for (const removedPath of [
  "src/workspaces/crm/customer-view",
  "src/compatibility/customer-view-presentation",
  "src/app/router/adapters/customer-view",
  "src/features/customers",
  "src/entities/customer",
]) assert.equal(fs.existsSync(path.join(root, removedPath)), false, `${removedPath} must not remain an active parallel Customer implementation.`);

const contactTypeSource = read("src/modules/contacts/domain/model/contact.types.ts");
const activeContactType = contactTypeSource.match(/export interface Contact \{[\s\S]*?\n\}/u)?.[0] ?? "";
for (const forbidden of ["customerId", "customerName", "legacyCustomerId", "won_to_customer"]) assert.equal(activeContactType.includes(forbidden), false, `Active Contact identity must not own ${forbidden}; Contact-owned stakeholder relationship records remain distinct.`);
const customerPageSource = read("src/modules/customers/presentation/pages/Customer360Page.tsx");
assert.equal(customerPageSource.includes("setCareTasks"), false, "Customer Care must not use local task state.");
assert.doesNotMatch(customerPageSource, /createCustomerCareCardWithTask|careOpen|careDraft/, "Customer 360 must not restore a duplicate Care Plan workflow.");
assert.match(customerPageSource, /support\/cases\/new\?customerId=/, "Customer Care actions must open the canonical Care Case creation flow.");

console.log("Customer module business contracts: PASS");
console.log("- purchase evidence conversion is effective-only, idempotent and unique per relationship");
console.log("- Contact/Organization remain identity owners and runtime backfill preserves legacy aliases");
console.log("- routes, navigation and access-control migration use the official customers module");

function evidence(id: string, buyerRef: PurchaseEvidence["buyerRef"], evidenceType: PurchaseEvidence["evidenceType"], occurredAt: string, reversalOfEvidenceId?: string): PurchaseEvidence {
  return { evidenceId: id, workspaceId, buyerRef, sourceType: evidenceType === "EXTERNAL_PURCHASE_CONFIRMED" ? "EXTERNAL_TRANSACTION" : "ORDER", sourceId: `source_${id}`, evidenceType, occurredAt, policyVersion: "contract", correlationId: `correlation_${id}`, reversalOfEvidenceId };
}
function ensureInput(item: PurchaseEvidence) {
  return { evidence: item, workspaceId, resolveRelationshipExists: () => true, makeCustomerId: (ref: PurchaseEvidence["buyerRef"]) => `customer_${ref.type}_${ref.id}`, makeCustomerCode: (ref: PurchaseEvidence["buyerRef"]) => `KH_${ref.id}`, now: "2026-07-09T00:00:00.000Z" };
}
function read(relativePath: string): string { return fs.readFileSync(path.join(root, relativePath), "utf8"); }
