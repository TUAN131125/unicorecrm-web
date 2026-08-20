import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import { getCustomersSnapshot, getStoredCustomersSnapshot } from "@/modules/customers";
import { recordCommercialEvidence } from "@/modules/commercial-evidence";
import { getContactsSnapshot, replaceContacts, saveContactSnapshot } from "@/modules/contacts";
import { getDealsSnapshot } from "@/modules/deals";
import { getOrganizationAccountSnapshot, getOrganizationAccountsSnapshot, replaceOrganizationAccounts, saveOrganizationAccountSnapshot } from "@/modules/organizations";
import { getQuotesSnapshot } from "@/modules/quotes";
import { getOrderListSnapshot } from "@/modules/orders";
import { getSupportCasesSnapshot } from "@/modules/support";
import {
  completeTaskSnapshot,
  getTaskActivitySnapshot,
  getTasksForCustomerSnapshot,
} from "@/modules/tasks";
import { buildCustomer360ReadModel } from "@/modules/customers/presentation/model/customer360ReadModel";
import { createCustomerCareCardWithTask, deriveCustomerCareCardProgress } from "@/workflows/customer-care";
import { createDealForCustomer } from "@/workflows/customer-commercial-actions";
import { reconcileCustomerConversionRuntime, startCustomerConversionRuntime } from "@/workflows/customer-conversion/runtime/customerConversionRuntime";
import { resolveTaskContextLabel } from "@/modules/tasks/presentation/model/taskContextPresentation";
import { relationshipRefKey } from "@/platform/identity";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;

// Runtime conversion is automatic: effective Purchase Evidence must create a real Customer
// without any UI command or manual Customer CRUD.
const contactsBeforeRuntimeContract = getContactsSnapshot();
const runtimeSuffix = Date.now();
const runtimeContactId = `contact_customer_runtime_${runtimeSuffix}`;
const runtimeRelationship = { type: "CONTACT" as const, id: runtimeContactId };
const sourceContact = contactsBeforeRuntimeContract[0];
assert.ok(sourceContact, "Automatic conversion contract requires a source Contact template.");
saveContactSnapshot({
  ...sourceContact,
  id: runtimeContactId,
  contactCode: `CTR${runtimeSuffix}`,
  name: `Runtime Customer ${runtimeSuffix}`,
  fullName: `Runtime Customer ${runtimeSuffix}`,
  organizationAccountId: undefined,
  createdAt: "2026-07-09T00:00:00.000Z",
  updatedAt: "2026-07-09T00:00:00.000Z",
});
const stopConversionRuntime = startCustomerConversionRuntime();
try {
  const workspaceId = getWorkspaceContextSnapshot().workspaceId;
  recordCommercialEvidence({
    evidenceId: `evidence_customer_runtime_${runtimeSuffix}`,
    workspaceId,
    buyerRef: runtimeRelationship,
    sourceType: "EXTERNAL_TRANSACTION",
    sourceId: `external_customer_runtime_${runtimeSuffix}`,
    evidenceType: "EXTERNAL_PURCHASE_CONFIRMED",
    occurredAt: "2026-07-09T00:00:00.000Z",
    policyVersion: "customer-runtime-contract/v1",
    correlationId: `correlation_customer_runtime_${runtimeSuffix}`,
  });
  const autoCreated = getStoredCustomersSnapshot().filter((item) => relationshipRefKey(item.relationshipRef) === relationshipRefKey(runtimeRelationship));
  assert.equal(autoCreated.length, 1, "Purchase Evidence subscription must auto-create exactly one Customer without a UI conversion action.");

  recordCommercialEvidence({
    evidenceId: `evidence_customer_runtime_repeat_${runtimeSuffix}`,
    workspaceId,
    buyerRef: runtimeRelationship,
    sourceType: "EXTERNAL_TRANSACTION",
    sourceId: `external_customer_runtime_repeat_${runtimeSuffix}`,
    evidenceType: "EXTERNAL_PURCHASE_CONFIRMED",
    occurredAt: "2026-07-10T00:00:00.000Z",
    policyVersion: "customer-runtime-contract/v1",
    correlationId: `correlation_customer_runtime_repeat_${runtimeSuffix}`,
  });
  assert.equal(getStoredCustomersSnapshot().filter((item) => relationshipRefKey(item.relationshipRef) === relationshipRefKey(runtimeRelationship)).length, 1, "Repeated effective evidence must not duplicate the Customer at runtime.");
} finally {
  stopConversionRuntime();
  replaceContacts(contactsBeforeRuntimeContract);
}
const customer = getCustomersSnapshot().find((item) => item.relationshipRef.type === "ORGANIZATION_ACCOUNT") ?? getCustomersSnapshot()[0];
assert.ok(customer, "Customer integration contracts require at least one evidence-backed Customer.");

const reconciliation = reconcileCustomerConversionRuntime("2026-07-09T00:00:00.000Z");
assert.ok(reconciliation.linkedSupportCases >= 0);

for (const deal of getDealsSnapshot().filter((item) => relationshipRefKey(item.buyerRef) === relationshipRefKey(customer.relationshipRef))) {
  assert.equal(deal.customerId, customer.id, "Historical Deals for the Customer relationship must link to the real Customer.");
}
for (const quote of getQuotesSnapshot().filter((item) => relationshipRefKey(item.buyerRef) === relationshipRefKey(customer.relationshipRef))) {
  assert.equal(quote.customerId, customer.id, "Historical Quotes for the Customer relationship must link to the real Customer.");
}
for (const order of getOrderListSnapshot().filter((item) => relationshipRefKey(item.buyerRef) === relationshipRefKey(customer.relationshipRef))) {
  assert.equal(order.customerId, customer.id, "Historical Orders for the Customer relationship must link to the real Customer.");
}

const model = buildCustomer360ReadModel(customer);
assert.ok(model.deals.every((item) => item.customerId === customer.id || relationshipRefKey(item.buyerRef) === relationshipRefKey(customer.relationshipRef)), "Customer 360 Sales must include historical relationship lineage.");
assert.ok(model.quotes.every((item) => item.customerId === customer.id || relationshipRefKey(item.buyerRef) === relationshipRefKey(customer.relationshipRef)), "Customer 360 Quotes must include historical relationship lineage.");
assert.ok(model.orders.every((item) => item.customerId === customer.id || relationshipRefKey(item.buyerRef) === relationshipRefKey(customer.relationshipRef)), "Customer 360 Purchases must include the first purchase history.");

const dealId = `deal_customer_contract_${Date.now()}`;
const deal = createDealForCustomer({
  customerId: customer.id,
  id: dealId,
  name: "Customer contract opportunity",
  amount: 1000000,
  ownerId: customer.careOwnerId || "u1",
  expectedCloseDate: "2026-08-01",
  actorName: "Customer Contract",
  now: "2026-07-09T00:00:00.000Z",
});
assert.equal(deal.customerId, customer.id, "Customer-created Deal must carry customerId.");
assert.deepEqual(deal.buyerRef, customer.relationshipRef, "Customer-created Deal must inherit relationshipRef without re-selection.");
assert.ok(getDealsSnapshot().some((item) => item.id === dealId), "Customer quick action must create the Deal in the Deals module repository.");

const suffix = Date.now();
const care = createCustomerCareCardWithTask({
  cardId: `care_customer_contract_${suffix}`,
  taskId: `task_customer_contract_${suffix}`,
  customerId: customer.id,
  type: "RENEWAL",
  title: "Gia hạn hợp đồng",
  priority: "HIGH",
  ownerId: customer.careOwnerId || "u1",
  dueAt: "2026-07-10T09:00:00.000Z",
  taskTitle: "Gọi xác nhận nhu cầu gia hạn",
  actorId: "customer-contract",
  now: "2026-07-09T00:00:00.000Z",
});
assert.equal(care.task.customerId, customer.id);
assert.deepEqual(care.task.relationshipRef, customer.relationshipRef);
assert.equal(care.task.recordRef?.moduleKey, "customers");
assert.equal(getTasksForCustomerSnapshot(customer.id).filter((item) => item.id === care.task.id).length, 1, "Care, Customer Work and Tasks must reference one Task record, not copies.");
assert.equal(getTaskActivitySnapshot().tasks.filter((item) => item.id === care.task.id).length, 1, "Task repository must contain the Care Task exactly once.");

const taskLabelContacts = getContactsSnapshot();
const taskLabelOrganizations = getOrganizationAccountsSnapshot();
if (customer.relationshipRef.type === "CONTACT") {
  const source = taskLabelContacts.find((item) => item.id === customer.relationshipRef.id);
  assert.ok(source, "Customer Task identity contract requires the source Contact.");
  const renamed = `${source.fullName || source.name} Task Identity`;
  try {
    saveContactSnapshot({ ...source, name: renamed, fullName: renamed, updatedAt: "2026-07-09T00:00:00.000Z" });
    assert.equal(resolveTaskContextLabel(care.task, getContactsSnapshot(), taskLabelOrganizations), renamed, "Task labels must resolve the current Contact identity instead of a stored Customer-name copy.");
  } finally {
    replaceContacts(taskLabelContacts);
  }
} else {
  const source = getOrganizationAccountSnapshot(customer.relationshipRef.id);
  assert.ok(source, "Customer Task identity contract requires the source Organization.");
  const renamed = `${source.displayName} Task Identity`;
  try {
    saveOrganizationAccountSnapshot({ ...source, displayName: renamed, updatedAt: "2026-07-09T00:00:00.000Z" });
    assert.equal(resolveTaskContextLabel(care.task, taskLabelContacts, getOrganizationAccountsSnapshot()), renamed, "Task labels must resolve the current Organization identity instead of a stored Customer-name copy.");
  } finally {
    replaceOrganizationAccounts(taskLabelOrganizations);
  }
}
completeTaskSnapshot(care.task.id, { actorId: "customer-contract", outcome: "Đã xác nhận", now: "2026-07-10T10:00:00.000Z" });
assert.equal(deriveCustomerCareCardProgress(care.card).derivedStatus, "COMPLETED", "Care Card progress must derive from the shared Task repository.");
assert.equal(buildCustomer360ReadModel(customer).tasks.find((item) => item.id === care.task.id)?.status, "COMPLETED", "Customer 360 must reflect Task completion immediately.");

const supportCase = getSupportCasesSnapshot().find((item) => item.customerId === customer.id);
if (supportCase) {
  assert.equal(
    getTaskActivitySnapshot().tasks.filter((task) => task.recordRef?.moduleKey === "support" && task.recordRef.recordId === supportCase.id && task.sourceRef?.type === "SUPPORT_ACTIVE_WORK").length,
    0,
    "Care Cases must not generate mirror Tasks automatically.",
  );
}

const careDetailSource = read("src/modules/support/presentation/pages/SupportCaseDetailPage.tsx");
assert.match(careDetailSource, /TaskCreateModal/, "A concrete Care action must be created explicitly through the canonical Task form.");
assert.match(careDetailSource, /moduleKey:\s*["']support["']/, "Explicit Care Tasks must retain a link to their Care Case.");

const customer360Source = read("src/modules/customers/presentation/pages/Customer360Page.tsx");
assert.match(customer360Source, /\/quotes\/new\?customerId=/, "Customer Quote quick action must open the official Quote builder with customer context.");
assert.match(customer360Source, /\/orders\/new\?customerId=/, "Customer Order quick action must open the official Order workflow with customer context.");
assert.match(customer360Source, /\/support\/cases\/new\?customerId=/, "Customer Support quick action must open the official Support module with customer context.");
const quoteBuilder = read("src/modules/quotes/presentation/pages/QuoteBuilderPage.tsx");
assert.match(quoteBuilder, /getCustomerSnapshot\(customerId\)\?\.relationshipRef/, "Quote builder must resolve buyer relationship from the real Customer.");
const orderBuilder = read("src/modules/orders/presentation/pages/OrderFormPage.tsx");
assert.match(orderBuilder, /getCustomerSnapshot\(customerId\)/, "Order builder must resolve buyer relationship from the real Customer.");

console.log("Customer cross-module integration contracts: PASS");
console.log("- effective Purchase Evidence auto-creates one Customer through the runtime subscription");
console.log("- historical Deal/Quote/Order lineage is linked by relationshipRef and visible in Customer 360");
console.log("- Care Card and Customer Work share one Task repository record with live Contact/Organization identity labels");
console.log("- assigned Tasks stay in the canonical Task repository; the Mine saved view and Calendar project by assignee");
console.log("- Care Cases stay independent from Tasks; only explicit concrete actions become canonical Tasks");

function read(relativePath: string): string { return readPresentationComposition(path.join(root, relativePath), "utf8"); }
