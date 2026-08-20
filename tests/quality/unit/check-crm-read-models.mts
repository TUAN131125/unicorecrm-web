import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getContactsSnapshot } from "../../../src/modules/contacts";
import { getCustomersSnapshot } from "../../../src/modules/customers";
import { getDealsSnapshot } from "../../../src/modules/deals";
import { getLeadsSnapshot } from "../../../src/modules/leads";
import { getOrdersSnapshot } from "../../../src/modules/orders";
import { getProductCatalogSnapshot } from "../../../src/modules/products";
import { getQuotesSnapshot } from "../../../src/modules/quotes";
import { getSupportCasesSnapshot } from "../../../src/modules/support";
import { buildGlobalAiContext } from "../../../src/workspaces/crm/ai-context/application/aiContextBuilder";
import {
  calculateCompletedOrderRevenue,
  calculateLeadConversionRate,
  calculateOpenPipelineValue,
} from "../../../src/workspaces/crm/read-models/analytics/reportReadModel";
import { buildNotificationsFromCRMData } from "../../../src/workspaces/crm/read-models/notifications/notificationReadModel";

const leads = getLeadsSnapshot();
const contacts = getContactsSnapshot();
const customers = getCustomersSnapshot();
const deals = getDealsSnapshot();
const quotes = getQuotesSnapshot();
const orders = getOrdersSnapshot();
const cases = getSupportCasesSnapshot();
const products = getProductCatalogSnapshot();

const notifications = buildNotificationsFromCRMData();
assert.deepEqual(notifications, [], "CRM snapshots must not synthesize notification records.");

assert.ok(Number.isFinite(calculateLeadConversionRate(leads)));
assert.ok(Number.isFinite(calculateCompletedOrderRevenue(orders)));
assert.ok(Number.isFinite(calculateOpenPipelineValue(deals)));

const aiContext = buildGlobalAiContext({
  leads,
  contacts,
  customers,
  deals,
  quotes,
  orders,
  cases,
  products,
});
assert.equal(aiContext.globalContext.leadsCount, leads.length);
assert.equal(aiContext.globalContext.contactsCount, contacts.length);
assert.equal(aiContext.globalContext.customersCount, customers.length);
assert.equal(aiContext.globalContext.dealsCount, deals.length);
assert.equal(aiContext.globalContext.quotesCount, quotes.length);
assert.equal(aiContext.globalContext.casesCount, cases.length);
assert.equal(aiContext.globalContext.productsCount, products.length);

const root = repositoryRoot;
const crmWorkspaceRoutes = fs.readFileSync(path.join(root, "src/app/router/workspaces/crmWorkspaceRoutes.tsx"), "utf8");
for (const routePattern of [
  "<DashboardPage />",
  "<MyWorkPage />",
  "<WorkCalendarPage />",
  "<NotificationsPage />",
  "<ReportsPage />",
]) {
  assert.ok(crmWorkspaceRoutes.includes(routePattern), `CRM workspace routes should use self-sufficient consumer: ${routePattern}`);
}

assert.ok(
  !fs.existsSync(path.join(root, "src/app/router/workspaces/conversationsWorkspaceRoutes.tsx")),
  "AI must not own a product-space route tree.",
);

const shell = fs.readFileSync(path.join(root, "src/app/shell/CrmApplicationShell.tsx"), "utf8");
assert.ok(!shell.includes("useLegacyCrmCompatibility"), "Application shell AI context must not depend on legacy compatibility state.");
assert.ok(shell.includes("useGlobalAiContext"), "Application shell should use the AI context read model.");
assert.ok(shell.includes('productSpace === "crm"'), "AI floating utility must be scoped to CRM only.");

const readConsumerPages = [
  "src/workspaces/crm/presentation/pages/DashboardPage.tsx",
  "src/workspaces/crm/presentation/pages/MyWorkPage.tsx",
  "src/workspaces/crm/presentation/pages/NotificationsPage.tsx",
  "src/workspaces/crm/presentation/pages/ReportsPage.tsx",
];
for (const relative of readConsumerPages) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  assert.ok(!source.includes("useLegacyCrmCompatibility"), `${relative} must read through workspace read models.`);
  assert.ok(!/\blocalStorage\b/.test(stripComments(source)), `${relative} must not access browser storage directly.`);
}

assert.ok(!fs.existsSync(path.join(root, "src/app/compatibility")), "Legacy compatibility provider must be fully removed.");

console.log("CRM read-model checks: OK");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}
