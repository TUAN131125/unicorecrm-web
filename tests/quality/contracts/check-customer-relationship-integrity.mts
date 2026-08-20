import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  auditRelationshipIntegrity,
  type RelationshipIntegrityIssueCode,
  type RelationshipIntegritySnapshot,
} from "@/platform/relationship-integrity";
import { buildCurrentRelationshipIntegritySummary } from "@/workflows/customer-relationship-integrity";

const root = repositoryRoot;
const workspaceId = "ws_contract";

const healthy: RelationshipIntegritySnapshot = {
  workspaceId,
  contacts: [{ id: "contact_1", fullName: "Primary Contact", workEmail: "contact@example.com", mobilePhone: "+84901234567", organizationAccountId: "org_1" }],
  organizations: [{ id: "org_1", workspaceId, displayName: "Example Organization", taxCode: "0101234567", domain: "example.com", contactRefs: [{ id: "contact_1" }], primaryContactId: "contact_1" }],
  customers: [{ id: "customer_1", workspaceId, customerCode: "CUS-001", relationshipRef: { type: "ORGANIZATION_ACCOUNT", id: "org_1" }, legacyAliases: ["legacy_customer_1"] }],
  deals: [{ id: "deal_1", buyerRef: { type: "ORGANIZATION_ACCOUNT", id: "org_1" }, customerId: "customer_1" }],
  quotes: [{ id: "quote_1", buyerRef: { type: "ORGANIZATION_ACCOUNT", id: "org_1" }, customerId: "customer_1", sourceDealId: "deal_1" }],
  orders: [{ id: "order_1", buyerRef: { type: "ORGANIZATION_ACCOUNT", id: "org_1" }, customerId: "customer_1", sourceDealId: "deal_1", sourceQuoteId: "quote_1" }],
  paymentObligations: [{ id: "obligation_1", orderId: "order_1" }],
  paymentTransactions: [{ id: "transaction_1", orderId: "order_1" }],
  shippingBookings: [{ id: "shipping_1", workspaceId, sourceType: "ORDER", sourceId: "order_1" }],
  returns: [{ id: "return_1", workspaceId, orderId: "order_1", buyerRef: { type: "ORGANIZATION_ACCOUNT", id: "org_1" } }],
  supportCases: [{ id: "support_1", customerId: "customer_1", relationshipRef: { type: "ORGANIZATION_ACCOUNT", id: "org_1" }, contactId: "contact_1", relatedOrderId: "order_1" }],
  tasks: [{ id: "task_1", customerId: "customer_1", relationshipRef: { type: "ORGANIZATION_ACCOUNT", id: "org_1" } }],
  activities: [{ id: "activity_1", customerId: "customer_1", relationshipRef: { type: "ORGANIZATION_ACCOUNT", id: "org_1" } }],
};

const healthySummary = auditRelationshipIntegrity(healthy);
assert.equal(healthySummary.errorCount, 0, "A fully connected canonical relationship chain must have no integrity errors.");
assert.equal(healthySummary.warningCount, 0, "A unique canonical relationship chain must have no duplicate warnings.");

function assertIssue(snapshot: RelationshipIntegritySnapshot, code: RelationshipIntegrityIssueCode): void {
  const summary = auditRelationshipIntegrity(snapshot);
  assert.ok(summary.issues.some((entry) => entry.code === code), `Expected integrity issue ${code}.`);
}

assertIssue({ ...healthy, contacts: [{ ...healthy.contacts[0], organizationAccountId: "org_missing" }] }, "ORPHAN_RELATIONSHIP");
assertIssue({ ...healthy, organizations: [{ ...healthy.organizations[0], workspaceId: "ws_other" }] }, "CROSS_WORKSPACE_REFERENCE");
assertIssue({ ...healthy, orders: [{ ...healthy.orders[0], customerId: "customer_missing" }] }, "CUSTOMER_RELATIONSHIP_MISMATCH");
assertIssue({ ...healthy, quotes: [{ ...healthy.quotes[0], sourceDealId: "deal_missing" }] }, "BROKEN_SOURCE_CHAIN");
assertIssue({ ...healthy, contacts: [...healthy.contacts, { id: "contact_2", workEmail: " CONTACT@example.com " }] }, "DUPLICATE_CONTACT_IDENTITY");
assertIssue({ ...healthy, organizations: [...healthy.organizations, { id: "org_2", workspaceId, displayName: "Duplicate", taxCode: "010 123 4567" }] }, "DUPLICATE_ORGANIZATION_IDENTITY");

const liveSummary = buildCurrentRelationshipIntegritySummary();
assert.equal(liveSummary.errorCount, 0, `Current seeded CRM data must have zero blocking relationship errors. Found: ${liveSummary.issues.filter((entry) => entry.severity === "ERROR").map((entry) => `${entry.code}:${entry.recordType}:${entry.recordId}`).join(", ")}`);
assert.equal(liveSummary.issueCount, liveSummary.errorCount + liveSummary.warningCount, "Integrity summary counters must reconcile.");

const requiredSourceContracts: Array<[string, RegExp, string]> = [
  ["src/modules/support/application/commands/supportCaseCommands.ts", /relationshipRef:\s*RelationshipRef/, "Support creation must require a canonical relationship reference."],
  ["src/workflows/customer-commercial-actions/index.ts", /assertCustomerRelationshipContextSnapshot/, "Customer commercial writes must resolve canonical customer context."],
  ["src/workflows/customer-care/index.ts", /assertCustomerRelationshipContextSnapshot/, "Customer care writes must resolve canonical customer context."],
  ["src/workflows/customer-identity/index.ts", /assertCustomerRelationshipContextSnapshot/, "Customer identity writes must resolve canonical customer context."],
  ["src/modules/customers/presentation/detail/CustomerIntegrityIndicator.tsx", /data-guidance-id="customers\.detail\.relationship-integrity"/, "Customer 360 must expose relationship integrity status with a stable guidance target."],
  ["src/modules/customers/presentation/detail/CustomerIntegrityIndicator.tsx", /RowActionPortal/, "Customer integrity details must stay behind an on-demand popover instead of an always-visible warning banner."],
  ["src/modules/customers/presentation/detail/CustomerRecordHeader.tsx", /CustomerIntegrityIndicator/, "Customer record header must own the compact integrity indicator."],
];
for (const [relativePath, pattern, message] of requiredSourceContracts) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  assert.match(source, pattern, message);
}

console.log(`Customer relationship integrity contracts: PASS — ${healthySummary.checkedRecordCount} synthetic records; live errors=${liveSummary.errorCount}, warnings=${liveSummary.warningCount}.`);
