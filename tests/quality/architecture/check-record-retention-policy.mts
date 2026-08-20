import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  LocalMutationAuthority,
  RetentionPolicyError,
  assertDestructiveActionAllowed,
  createMutationMetadata,
} from "@/shared/application";
import { anonymizeContact } from "@/modules/contacts/application/commands/contactRepositoryCommands";
import { InMemoryContactRepository } from "@/modules/contacts/infrastructure/InMemoryContactRepository";
import type { AppEventBus } from "@/platform/events";

const root = repositoryRoot;
const read = (relativePath: string): string => fs.readFileSync(path.join(root, relativePath), "utf8");

const noOpEvents: AppEventBus = {
  publish: () => undefined,
  subscribe: () => () => undefined,
};

const piiTokens = [
  "private@example.test",
  "+84987654321",
  "Private street",
  "Secret department",
  "Sensitive note",
  "consent-evidence-pii",
];
const contactRepository = new InMemoryContactRepository([{
  id: "contact-anonymize-contract",
  workspaceId: "ws-default",
  name: "Private Person",
  fullName: "Private Person",
  email: piiTokens[0],
  mobilePhone: piiTokens[1],
  addressDetails: { line1: piiTokens[2] },
  department: piiTokens[3],
  notes: piiTokens[4],
  organizationRelationships: [{
    id: "relationship-retained",
    organizationAccountId: "organization-retained",
    role: "employee",
    roleTitle: "Private role title",
    department: piiTokens[3],
    isPrimaryRepresentative: true,
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "private-creator",
  }],
  consent: {
    current: { EMAIL: "GRANTED" },
    ledger: [{
      id: "consent-ledger-retained",
      channel: "EMAIL",
      decision: "GRANTED",
      source: "private-form-source",
      evidence: piiTokens[5],
      actorId: "private-consent-actor",
      occurredAt: "2026-01-01T00:00:00.000Z",
    }],
    lawfulBasis: "private-lawful-basis",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  activities: [{
    id: "private-activity",
    title: "Private activity",
    description: piiTokens[4],
    author: "Private author",
    type: "note",
    createdAt: "2026-01-01T00:00:00.000Z",
  }],
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
}], noOpEvents);
const anonymizedContact = anonymizeContact(contactRepository, "contact-anonymize-contract", {
  reason: "Verified privacy request",
  actorId: "retention-system",
  now: "2026-07-22T00:00:00.000Z",
});
const anonymizedJson = JSON.stringify(anonymizedContact);
for (const token of piiTokens) assert.equal(anonymizedJson.includes(token), false, `Anonymization leaked ${token}.`);
assert.equal(anonymizedContact.organizationRelationships?.[0]?.organizationAccountId, "organization-retained");
assert.equal(anonymizedContact.consent?.ledger[0]?.source, "REDACTED");
assert.equal(anonymizedContact.activities?.length, 1, "Historical free-text activities must not survive anonymization.");

function expectPolicyError(run: () => void, code: string, blockers: readonly string[] = []): void {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof RetentionPolicyError);
    assert.equal(error.code, code);
    for (const blocker of blockers) assert.ok(error.blockers.includes(blocker), `Expected blocker ${blocker}`);
    return true;
  });
}

expectPolicyError(() => assertDestructiveActionAllowed({
  recordType: "Order",
  retentionClass: "DURABLE",
  action: "HARD_DELETE",
  reason: "cleanup",
  isDraft: true,
  backendAuthorizedHardDelete: true,
}), "HARD_DELETE_FORBIDDEN", ["USE_ARCHIVE_CANCEL_VOID_OR_ANONYMIZE"]);

expectPolicyError(() => assertDestructiveActionAllowed({
  recordType: "Contact",
  retentionClass: "MASTER",
  action: "HARD_DELETE",
  reason: "privacy request",
  isDraft: true,
  backendAuthorizedHardDelete: true,
}), "HARD_DELETE_FORBIDDEN");

expectPolicyError(() => assertDestructiveActionAllowed({
  recordType: "Temporary import row",
  retentionClass: "TRANSIENT",
  action: "HARD_DELETE",
  reason: "discard invalid draft",
  isDraft: true,
  hasReferences: false,
  hasAuditEvidence: false,
  backendAuthorizedHardDelete: false,
}), "HARD_DELETE_NOT_ELIGIBLE", ["BACKEND_AUTHORIZATION_REQUIRED"]);

expectPolicyError(() => assertDestructiveActionAllowed({
  recordType: "Temporary import row",
  retentionClass: "TRANSIENT",
  action: "HARD_DELETE",
  reason: "discard invalid draft",
  isDraft: true,
  hasReferences: true,
  hasAuditEvidence: true,
  backendAuthorizedHardDelete: true,
}), "HARD_DELETE_NOT_ELIGIBLE", ["HAS_REFERENCES", "HAS_AUDIT_EVIDENCE"]);

assert.doesNotThrow(() => assertDestructiveActionAllowed({
  recordType: "Temporary import row",
  retentionClass: "TRANSIENT",
  action: "HARD_DELETE",
  reason: "discard invalid draft",
  isDraft: true,
  hasReferences: false,
  hasAuditEvidence: false,
  backendAuthorizedHardDelete: true,
}));

expectPolicyError(() => assertDestructiveActionAllowed({
  recordType: "Contact",
  retentionClass: "MASTER",
  action: "ARCHIVE",
}), "DESTRUCTIVE_ACTION_REASON_REQUIRED", ["REASON_REQUIRED"]);

const authority = new LocalMutationAuthority();
const archiveOutcome = await authority.execute(
  { commandType: "contact.archive", aggregateType: "contact", aggregateId: "contact-retention", payload: { reason: "policy test" } },
  createMutationMetadata("retention-policy", {
    idempotencyKey: "retention-policy:contact-retention",
    correlationId: "corr_retention_policy",
    actor: { id: "tester", name: "Retention Tester" },
  }),
  () => ({ id: "contact-retention", archivedAt: "2026-07-17T00:00:00.000Z", archiveReason: "policy test" }),
);
assert.equal(archiveOutcome.commandType, "contact.archive");
assert.equal(archiveOutcome.audit.authority, "demo");
assert.ok(archiveOutcome.audit.evidenceIds.length > 0, "Destructive commands must return audit evidence.");
assert.ok(archiveOutcome.emittedEvents.includes("contact.archive.completed"));

const legacyHardDeleteSymbols = [
  "deleteContact",
  "deleteLead",
  "deleteLeads",
  "deleteDeal",
  "deleteDeals",
  "deleteQuote",
  "deleteQuotes",
  "deleteOrder",
  "deleteOrders",
  "deleteTask",
  "removeOrder",
  "removeQuote",
  "removeProducts",
  "canDeleteProduct",
  "assertQuoteCanBeHardDeleted",
];

const businessSourceRoots = [
  "src/modules/contacts",
  "src/modules/customers",
  "src/modules/organizations",
  "src/modules/leads",
  "src/modules/deals",
  "src/modules/quotes",
  "src/modules/orders",
  "src/modules/products",
  "src/modules/invoices",
  "src/modules/payments",
  "src/modules/shipping",
  "src/modules/returns",
  "src/modules/tasks",
  "src/modules/commercial-evidence",
];

function walk(directory: string): string[] {
  return walkAllFiles(directory, { include: (_filePath, entryName) => /\.(ts|tsx)$/u.test(entryName) });
}

for (const sourceRoot of businessSourceRoots) {
  for (const file of walk(path.join(root, sourceRoot))) {
    const relative = path.relative(root, file).replaceAll(path.sep, "/");
    if (relative.includes("/presentation/")) continue;
    const source = fs.readFileSync(file, "utf8");
    for (const symbol of legacyHardDeleteSymbols) {
      assert.equal(
        new RegExp(`\\b${symbol}\\b`).test(source),
        false,
        `${relative} must not restore legacy hard-delete symbol ${symbol}.`,
      );
    }
  }
}

const durableRepositoryPorts = [
  "src/modules/orders/application/ports/OrderRepository.ts",
  "src/modules/invoices/application/ports/InvoiceRepository.ts",
  "src/modules/payments/application/ports/PaymentRepository.ts",
  "src/modules/shipping/application/ports/ShippingRepository.ts",
  "src/modules/returns/application/ports/ReturnRepository.ts",
  "src/modules/quotes/application/ports/QuoteRepository.ts",
  "src/modules/commercial-evidence/application/ports/PurchaseEvidenceRepository.ts",
  "src/modules/tasks/application/ports/TaskActivityRepository.ts",
];
for (const file of durableRepositoryPorts) {
  const source = read(file);
  assert.equal(/\b(delete|remove|hardDelete|purge)\s*\(/.test(source), false, `${file} must not expose durable hard delete.`);
}

const requiredCommandEvidence: Array<[string, readonly string[]]> = [
  ["src/modules/contacts/public/contacts.ts", ["archiveContactCommand", "anonymizeContactCommand", "executeMutationCommand"]],
  ["src/modules/customers/public/api.ts", ["archiveCustomerCommand", "anonymizeCustomerCommand", "executeMutationCommand"]],
  ["src/modules/organizations/public/api.ts", ["archiveOrganizationAccountCommand", "anonymizeOrganizationAccountCommand", "executeMutationCommand"]],
  ["src/modules/leads/public/leads.ts", ["archiveLeadViaApi", "archiveLeadsViaApi", "anonymizeLeadViaApi"]],
  ["src/modules/deals/public/deals.ts", ["archiveDealCommand", "archiveDealsCommand"]],
  ["src/modules/quotes/public/quotes.ts", ["archiveQuoteCommand", "archiveQuotesCommand"]],
  ["src/modules/orders/public/orders.ts", ["archiveOrderCommandBoundary", "archiveOrdersCommandBoundary"]],
  ["src/modules/products/public/catalog.ts", ["archiveProductsCommand", "restoreProductsCommand"]],
  ["src/modules/tasks/public/api.ts", ["archiveTaskCommand"]],
];
for (const [file, markers] of requiredCommandEvidence) {
  const source = read(file);
  for (const marker of markers) assert.ok(source.includes(marker), `${file} is missing retention command ${marker}.`);
}

for (const file of [
  "src/modules/contacts/presentation/hooks/useContactListController.tsx",
  "src/modules/customers/presentation/pages/CustomerListPage.tsx",
  "src/modules/customers/presentation/pages/Customer360Page.tsx",
  "src/modules/leads/presentation/pages/LeadListPage.tsx",
  "src/modules/quotes/presentation/pages/QuoteListPage.tsx",
  "src/modules/orders/presentation/hooks/useOrderListController.tsx",
  "src/modules/products/presentation/hooks/useProductListController.ts",
  "src/modules/products/presentation/pages/ProductDetailPage.tsx",
  "src/modules/tasks/presentation/pages/TaskListPage.tsx",
]) {
  const source = read(file);
  assert.equal(/hard[ -]?delete|xóa cứng|delete permanently|xóa vĩnh viễn/i.test(source), false, `${file} must not expose hard delete to operators.`);
}

const retentionPolicySource = read("src/shared/application/retention/recordRetentionPolicy.ts");
for (const marker of [
  'retentionClass !== "TRANSIENT"',
  'backendAuthorizedHardDelete',
  '"HAS_REFERENCES"',
  '"HAS_AUDIT_EVIDENCE"',
  '"BACKEND_AUTHORIZATION_REQUIRED"',
]) assert.ok(retentionPolicySource.includes(marker), `Retention policy is missing ${marker}.`);

console.log("Record retention and destructive-action policy: PASS");
