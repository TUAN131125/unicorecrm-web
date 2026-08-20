import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const read = (path: string) => readPresentationComposition(join(root, path), "utf8");

const moduleDirectories = readdirSync(join(root, "src/modules"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(root, "src/modules", entry.name, "manifest.ts")))
  .map((entry) => entry.name)
  .sort();
assert.equal(moduleDirectories.length, 15, "Order-to-Cash baseline must expose exactly 15 canonical module manifests including Invoices");
assert.ok(moduleDirectories.includes("customers"), "Customers must remain an official module owner");
assert.ok(read("AGENTS.md").includes("15 registered modules"), "AGENTS.md must reflect the current 15-module baseline");

const orderList = read("src/modules/orders/presentation/pages/OrderListPage.tsx");
const orderPolicy = read("src/modules/orders/presentation/model/orderActionPolicy.ts");
for (const forbidden of ["Temporary invoice draft compiled", "Đã ghi nhận tạo hóa đơn nháp", "payment-risk", "98%", 'id: "invoice"']) {
  assert.ok(!orderList.includes(forbidden), `Order list must not expose unsupported fake action: ${forbidden}`);
  assert.ok(!orderPolicy.includes(forbidden), `Order policy must not expose unsupported fake action: ${forbidden}`);
}

const contactDetail = read("src/modules/contacts/presentation/pages/ContactDetailPage.tsx");
const contactRoute = read("src/modules/contacts/detail-route.tsx");
const contactInvoices = read("src/modules/contacts/presentation/detail/tabs/ContactInvoicesTab.tsx");
for (const forbidden of ["payments.obligations", "displayInvoices", "PaymentRepositorySnapshot"]) {
  assert.ok(!contactDetail.includes(forbidden), `Contact detail must not project legacy schedules as invoices: ${forbidden}`);
}
for (const forbidden of ["getPaymentsSnapshot", "subscribeToPayments"]) {
  assert.ok(!contactRoute.includes(forbidden), `Contact route must not subscribe to Payments only to fabricate invoices: ${forbidden}`);
}
assert.ok(!contactInvoices.includes("InvoiceMocks"), "Contact invoices tab must not render mocked invoice rows");
assert.ok(
  contactInvoices.includes("No authoritative invoice exists for this relationship.")
  && contactInvoices.includes("Invoices are resolved directly from the Invoice module"),
  "Contact invoices tab must state the authoritative Invoice boundary",
);

const globalSearch = read("src/app/search/crmGlobalSearch.ts");
assert.ok(!globalSearch.includes("paymentSnapshot.obligations"), "Global search must not index legacy schedules as receivables");
assert.ok(globalSearch.includes("getReceivablesSnapshot"), "Global search must index authoritative receivables");
assert.ok(!/paymentSnapshot[\s\S]{0,500}typeLabelEn:\s*"Receivable"/.test(globalSearch), "Global search must not label payment schedules as Receivable");

const paymentList = read("src/modules/payments/presentation/pages/PaymentOperationsPage.tsx");
for (const forbidden of ['"RECEIVABLES"', "Công nợ & kế hoạch", "Không có công nợ phù hợp", "Mở hồ sơ công nợ", "payments-receivables"]) {
  assert.ok(!paymentList.includes(forbidden), `Payments workspace must use schedule semantics instead of receivables: ${forbidden}`);
}
for (const required of ['"COLLECTIONS"', '"INTENTS"', '"PAYMENTS"', '"RECONCILIATION"', '"CREDITS"']) {
  assert.ok(paymentList.includes(required), `Payments workspace must preserve canonical operations tab ${required}`);
}
assert.ok(paymentList.includes("snapshot.scheduleLines"), "Payments workspace must read collection milestones from the canonical payment snapshot");

const metrics = read("src/workspaces/crm/order-to-cash/orderToCashMetrics.ts");
for (const forbidden of ["PaymentObligation", "dsoDays", "AgingBucket", "aging:"]) {
  assert.ok(!metrics.includes(forbidden), `Operational metrics must not fabricate accounting metrics: ${forbidden}`);
}
assert.ok(metrics.includes("collectionCycleDays"), "Operational Order collection cycle must remain available");

const paymentPublic = read("src/modules/payments/public/api.ts");
for (const forbidden of ["getLegacyPaymentScheduleSnapshot", "getLegacyPaymentScheduleForOrderSnapshot", "getLegacyPaymentScheduleFromSnapshot", "LegacyPaymentScheduleItem"]) {
  assert.ok(!paymentPublic.includes(forbidden), `Legacy payment schedule helper must not remain in the public API: ${forbidden}`);
}
for (const required of ["getPaymentObligationsSnapshot", "getPaymentObligationsForOrderSnapshot", "getPaymentObligationsForOrder", "PaymentObligation"]) {
  assert.ok(paymentPublic.includes(required), `Canonical Payment obligation API is missing: ${required}`);
}

const sourceFiles = walkAllFiles(join(root, "src"), {
  include: (_filePath, entryName) => /\.(ts|tsx)$/u.test(entryName),
});
for (const absolute of sourceFiles) {
  const rel = relative(root, absolute).replaceAll("\\", "/");
  if (rel.startsWith("src/modules/payments/")) continue;
  const content = readPresentationComposition(absolute, "utf8");
  assert.ok(!content.includes("LegacyPaymentSchedule"), `${rel} must not depend on removed legacy Payment schedule contracts`);
  assert.ok(!content.includes("modules/payments/compatibility"), `${rel} must consume the canonical Payments public boundary`);
}

console.log("Order-to-cash cleanup: PASS — official Customer baseline, canonical Payment obligation boundary, and no fake Invoice/Receivables semantics");
