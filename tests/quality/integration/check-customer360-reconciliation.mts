import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getCustomersSnapshot } from "@/modules/customers";
import { buildCustomer360ReadModel } from "@/modules/customers/presentation/model/customer360ReadModel";
import { getOrderListSnapshot } from "@/modules/orders";
import { createSupportCase } from "@/modules/support/application/commands/supportCaseCommands";
import { relationshipRefKey } from "@/platform/identity";
import { calculateCustomerPopulation, calculateTopCustomers } from "@/workspaces/crm/read-models/analytics/reportReadModel";
import { reconcileCustomerConversionRuntime } from "@/workflows/customer-conversion/runtime/customerConversionRuntime";
import { buildCurrentRelationshipIntegritySummary } from "@/workflows/customer-relationship-integrity";

const root = repositoryRoot;
const customers = getCustomersSnapshot();
const orders = getOrderListSnapshot();
assert.ok(customers.length > 0, "Customer 360 reconciliation requires Customer profiles.");

const population = calculateCustomerPopulation(customers, orders);
const customerKeys = new Set(customers.map((customer) => relationshipRefKey(customer.relationshipRef)));
const transactingKeys = new Set(orders.map((order) => relationshipRefKey(order.buyerRef)).filter((key) => customerKeys.has(key)));
assert.equal(population.total, customers.length, "Report total Customers must use the canonical Customer repository.");
assert.equal(population.b2c + population.b2b, population.total, "B2C and B2B populations must reconcile to total Customers.");
assert.equal(population.withTransactions, transactingKeys.size, "Customer transaction count must use canonical buyer relationships.");
assert.equal(population.withTransactions + population.withoutTransactions, population.total, "Customer transaction segments must reconcile to total Customers.");

const topCustomers = calculateTopCustomers(customers, orders);
assert.ok(topCustomers.every((entry) => customers.some((customer) => customer.id === entry.customerId)), "Top-customer rows must resolve to canonical Customer profiles.");

for (const customer of customers) {
  const model = buildCustomer360ReadModel(customer);
  const relationshipKey = relationshipRefKey(customer.relationshipRef);
  assert.notEqual(model.integrity.status, "BLOCKED", `Customer ${customer.id} must not have blocking integrity errors.`);
  assert.ok(model.deals.every((record) => relationshipRefKey(record.buyerRef) === relationshipKey), `Customer ${customer.id} Deal history must use one canonical relationship.`);
  assert.ok(model.quotes.every((record) => relationshipRefKey(record.buyerRef) === relationshipKey), `Customer ${customer.id} Quote history must use one canonical relationship.`);
  assert.ok(model.orders.every((record) => relationshipRefKey(record.buyerRef) === relationshipKey), `Customer ${customer.id} Order history must use one canonical relationship.`);

  const orderIds = new Set(model.orders.map((record) => record.id));
  assert.ok(model.paymentObligations.every((record) => orderIds.has(record.orderId)), `Customer ${customer.id} payment obligation entries must trace to Customer Orders.`);
  assert.ok(model.paymentTransactions.every((record) => orderIds.has(record.orderId)), `Customer ${customer.id} transactions must trace to Customer Orders.`);
  assert.ok(model.returns.every((record) => orderIds.has(record.orderId) && relationshipRefKey(record.buyerRef) === relationshipKey), `Customer ${customer.id} Returns must trace to the same buyer and Order chain.`);
  assert.ok(model.supportCases.every((record) => record.relationshipRef && relationshipRefKey(record.relationshipRef) === relationshipKey), `Customer ${customer.id} Support cases must carry the canonical relationship.`);
  assert.ok(model.tasks.every((record) => !record.relationshipRef || relationshipRefKey(record.relationshipRef) === relationshipKey), `Customer ${customer.id} Tasks must not cross relationship boundaries.`);
  assert.ok(model.activities.every((record) => !record.relationshipRef || relationshipRefKey(record.relationshipRef) === relationshipKey), `Customer ${customer.id} Activities must not cross relationship boundaries.`);

  const timelineIds = new Set(model.timeline.map((entry) => entry.id));
  assert.equal(timelineIds.size, model.timeline.length, `Customer ${customer.id} timeline must not duplicate event IDs.`);
  assert.ok(model.leads.every((lead) => model.timeline.some((entry) => entry.recordRef?.moduleKey === "leads" && entry.recordRef.recordId === lead.id)), `Customer ${customer.id} Lead lineage must remain visible in the timeline.`);
}

const firstReconciliation = reconcileCustomerConversionRuntime("2026-07-12T00:00:00.000Z");
const secondReconciliation = reconcileCustomerConversionRuntime("2026-07-12T00:00:00.000Z");
assert.deepEqual(secondReconciliation, {
  createdCustomerIds: [],
  linkedDeals: 0,
  linkedQuotes: 0,
  linkedOrders: 0,
  linkedSupportCases: 0,
  linkedTasks: 0,
  linkedActivities: 0,
}, "Customer relationship reconciliation must be idempotent after canonical links are established.");
assert.ok(firstReconciliation.createdCustomerIds.length >= 0, "Initial reconciliation result must remain measurable.");

const sampleCustomer = customers[0];
assert.throws(() => createSupportCase([], {
  title: "Missing relationship",
  description: "Contract probe",
  priority: "medium",
  category: "request",
  source: "manual",
  customerId: sampleCustomer.id,
  customerName: sampleCustomer.customerCode,
  relationshipRef: undefined as never,
}), /canonical customer relationship/, "Support creation must reject a missing canonical relationship.");
const supportCase = createSupportCase([], {
  title: "Canonical relationship",
  description: "Contract probe",
  priority: "medium",
  category: "request",
  source: "manual",
  customerId: sampleCustomer.id,
  customerName: sampleCustomer.customerCode,
  relationshipRef: sampleCustomer.relationshipRef,
}, new Date("2026-07-12T00:00:00.000Z"));
const sampleRelationshipRef = sampleCustomer.relationshipRef;
const supportRelationshipRef = supportCase.relationshipRef;
assert.ok(sampleRelationshipRef, "Sample Customer must retain a canonical relationship reference.");
assert.ok(supportRelationshipRef, "Support Case must retain the canonical relationship reference.");
assert.equal(relationshipRefKey(supportRelationshipRef), relationshipRefKey(sampleRelationshipRef));

const liveIntegrity = buildCurrentRelationshipIntegritySummary();
assert.equal(liveIntegrity.errorCount, 0, "Customer 360 reconciliation must finish with zero blocking relationship errors.");

const reportsSource = fs.readFileSync(path.join(root, "src/workspaces/crm/presentation/pages/ReportsPage.tsx"), "utf8");
assert.match(reportsSource, /calculateCustomerPopulation/, "Reports must consume canonical Customer population metrics.");
assert.match(reportsSource, /withTransactions/, "Reports must distinguish Customers with transactions.");
assert.match(reportsSource, /withoutTransactions/, "Reports must distinguish Customers without transactions.");

console.log(`Customer 360 reconciliation: PASS — ${customers.length} customers, ${orders.length} orders, ${topCustomers.length} ranked customers, live errors=${liveIntegrity.errorCount}.`);
