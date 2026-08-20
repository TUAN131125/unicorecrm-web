import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildRepositoryInventory } from "../../../scripts/repository-inventory/repositoryInventory.mjs";

const root = repositoryRoot;
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath: string) => fs.existsSync(path.join(root, relativePath));
const inventory = buildRepositoryInventory();

assert.ok(inventory.compatibilityCandidates.length <= 53, `Compatibility candidate count regressed to ${inventory.compatibilityCandidates.length}.`);
assert.ok(inventory.deprecatedComponents.length <= 9, `Deprecated surface count regressed to ${inventory.deprecatedComponents.length}.`);
assert.equal(inventory.circularDependencies.length, 0, "Compatibility cleanup must not introduce dependency cycles.");

const removedMigrationFixture = ["src/migrations/canonical-v1", "legacyCustomerMigration.records.ts"].join("/");
assert.equal(exists(removedMigrationFixture), false, `${removedMigrationFixture} must not return.`);

const routeBoundaries = [
  "src/modules/invoices/account-statement-route.tsx",
  "src/modules/invoices/detail-route.tsx",
  "src/modules/invoices/form-route.tsx",
  "src/modules/invoices/list-route.tsx",
  "src/modules/invoices/receivable-detail-route.tsx",
  "src/modules/invoices/receivables-route.tsx",
  "src/modules/organizations/detail-route.tsx",
  "src/modules/organizations/list-route.tsx",
  "src/modules/payments/detail-route.tsx",
  "src/modules/payments/list-route.tsx",
  "src/modules/returns/detail-route.tsx",
  "src/modules/returns/form-route.tsx",
  "src/modules/returns/list-route.tsx",
  "src/modules/shipping/detail-route.tsx",
  "src/modules/shipping/list-route.tsx",
  "src/modules/tasks/detail-route.tsx",
  "src/modules/tasks/list-route.tsx",
];
for (const routeBoundary of routeBoundaries) {
  assert.doesNotMatch(read(routeBoundary), /\bexport\s*\{[^}]*\bas\b/, `${routeBoundary} must export its canonical page name directly.`);
}

const forbiddenCompatibilitySymbols = [
  "AccountStatementRoutePage",
  "InvoiceDetailRoutePage",
  "InvoiceFormRoutePage",
  "InvoiceListRoutePage",
  "ReceivableDetailRoutePage",
  "ReceivablesRoutePage",
  "OrganizationAccountDetailRoutePage",
  "OrganizationAccountListRoutePage",
  "PaymentDetailRoutePage",
  "PaymentListRoutePage",
  "ReturnDetailRoutePage",
  "ReturnFormRoutePage",
  "ReturnListRoutePage",
  "ShippingBookingDetailRoutePage",
  "ShippingBookingListRoutePage",
  "TaskDetailRoutePage",
  "TaskListRoutePage",
  "getReceivableCollectionActivitiesSnapshot",
  "saveReceivableCollectionActivitySnapshot",
  "updateReceivableCollectionActivityStateSnapshot",
  "migrateLegacyCustomersToRelationships",
  "LegacyDealNormalizationInput",
  "LegacyQuoteNormalizationInput",
  "LEGACY_CUSTOMER_MIGRATION_RECORDS",
];
const sourceFiles = inventory.fileClassifications.filter((entry: { path: string; classification: string }) => entry.classification === "source");
for (const sourceFile of sourceFiles) {
  const source = read(sourceFile.path);
  for (const symbol of forbiddenCompatibilitySymbols) {
    assert.equal(source.includes(symbol), false, `${sourceFile.path} still references retired compatibility symbol ${symbol}.`);
  }
}

const paymentTypes = read("src/modules/payments/domain/model/paymentCollection.types.ts");
assert.match(paymentTypes, /PaymentMethodAvailability = "ACTIVE" \| "HISTORICAL_ONLY"/);
assert.match(paymentTypes, /availability: PaymentMethodAvailability/);
assert.doesNotMatch(paymentTypes, /deprecated\?: boolean/);

const effectiveCatalog = read("src/modules/payments/application/queries/effectivePaymentMethodCatalog.ts");
assert.match(effectiveCatalog, /availability: "HISTORICAL_ONLY"/);
assert.doesNotMatch(effectiveCatalog, /deprecatedLegacy|deprecated:/);


const retirementRecord = read("docs/architecture/compatibility-retirement-stage6.md");
assert.match(retirementRecord, /77 → 53/);
assert.match(retirementRecord, /13 → 9/);
assert.match(retirementRecord, /historical-only method/i);
assert.equal(exists("src/workspaces/studio/control-plane"), false, "Legacy Studio control-plane must remain removed.");

console.log(`Compatibility retirement PASS: ${inventory.compatibilityCandidates.length} candidates, ${inventory.deprecatedComponents.length} deprecated surfaces, 0 cycles.`);
