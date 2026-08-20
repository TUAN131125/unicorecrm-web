import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  configureModuleDataAuthorityRegistry,
  createModuleCollectionResource,
  createModuleDetailResource,
} from "../../../src/shared/application";
import { createHttpModuleDataAuthorityRegistry, type HttpClient, type HttpRequest } from "../../../src/platform/api";
import { CONNECTED_MODULE_QUERY_RESPONSE_MAPPERS } from "../../../src/app/composition/connectedModuleQueryResponseMappers";

const requests: HttpRequest[] = [];
const client: HttpClient = {
  async request<TResponse>(request: HttpRequest): Promise<TResponse> {
    requests.push(request);
    if (request.operationId === "listContacts") return [{ id: "contact-1" }] as TResponse;
    if (request.operationId === "getContact") return { id: "contact-1", version: 7 } as TResponse;
    if (request.operationId === "listDeals") return { items: [{ id: "deal-1", resourceVersion: 4 }], pageInfo: { hasNextPage: false, totalCount: 1 } } as TResponse;
    if (request.operationId === "getDeal") return { id: "deal-1", resourceVersion: 4 } as TResponse;
    if (request.operationId === "listLeads") return { items: [{ id: "lead-1", displayName: "Lead", source: "WEB", score: 80, leadWorkState: "NEW", qualificationOutcome: "PENDING", relationshipRef: { type: "CONTACT", id: "contact-1" }, ownerId: "user-1", interestedProducts: [], activityProjection: "NOT_INCLUDED", estimatedValue: { amount: "1000000.25", currency: "VND" }, tags: [], createdAt: "2026-07-25T00:00:00.000Z", updatedAt: "2026-07-25T00:00:00.000Z", version: 3 }], page: { limit: 50, hasMore: false } } as TResponse;
    throw new Error(`Unexpected API operation ${request.operationId}`);
  },
};
const registry = createHttpModuleDataAuthorityRegistry(client, undefined, CONNECTED_MODULE_QUERY_RESPONSE_MAPPERS);
configureModuleDataAuthorityRegistry(registry);

let projected: Array<{ id: string }> = [];
const collection = createModuleCollectionResource<{ id: string }>("contacts", {
  project(records) { projected = [...records]; },
});
const loaded = await collection.load();
assert.deepEqual(loaded?.items.map((item) => item.id), ["contact-1"]);
assert.deepEqual(projected.map((item) => item.id), ["contact-1"]);
assert.equal(requests[0]?.operationId, "listContacts");
assert.equal(requests[0]?.query && Object.keys(requests[0].query).length, 0);

let projectedDetail: { id: string; version: number } | undefined;
const detail = createModuleDetailResource<{ id: string; version: number }>("contacts", "contact-1", (record) => { projectedDetail = record; });
await detail.load();
assert.equal(projectedDetail?.version, 7);
assert.equal(requests[1]?.operationId, "getContact");
const dealPage = await registry.deals.queries.list<{ id: string; resourceVersion: number }>({ limit: 1, sortBy: "updatedAt", sortDirection: "desc" });
assert.equal(dealPage.items[0]?.resourceVersion, 4);
assert.equal(requests[2]?.operationId, "listDeals");
assert.deepEqual(requests[2]?.query, { limit: 1, sortBy: "updatedAt", sortDirection: "desc" });
const dealDetail = await registry.deals.queries.get<{ id: string; resourceVersion: number }>("deal-1");
assert.equal(dealDetail.resourceVersion, 4);
assert.equal(requests[3]?.operationId, "getDeal");
const leadPage = await registry.leads.queries.list<{ id: string; estimatedValue: { amount: string; currency: string }; resourceVersion: number }>();
assert.equal(leadPage.items[0]?.estimatedValue.amount, "1000000.25");
assert.equal(leadPage.items[0]?.resourceVersion, 3);
assert.equal(requests[4]?.operationId, "listLeads");
assert.equal(requests.length, 5, "Only explicit OpenAPI-owned query operations may reach network I/O.");

const root = repositoryRoot;
const expectedSources = [
  ["src/modules/leads/application/vertical-slice/leadAuthoritativeQueries.ts", /getLeadApiRuntime\(\)\.queries/, /createAuthoritativeResource/, /getLeadDetailResource/],
  ["src/modules/deals/application/vertical-slice/dealAuthoritativeQueries.ts", /getDealApiRuntime\(\)\.queries/, /createAuthoritativeResource/, /getDealDetailResource/, /getDealForecastSummaryResource/],
  ["src/modules/quotes/application/vertical-slice/quoteAuthoritativeQueries.ts", /getQuoteApiRuntime\(\)\.queries/, /createAuthoritativeResource/, /getQuoteDetailResource/],
  ["src/modules/orders/application/vertical-slice/orderAuthoritativeQueries.ts", /createModuleCollectionResource<OrderReadModel>\("orders"/, /projectOrderReadModel/, /getOrderDetailResource/],
  ["src/modules/leads/presentation/hooks/useLeads.ts", /useLeadAuthoritativeResource\(getLeadCollectionResource\(\)/, /scopeKey:\s*workspace\.workspaceId/, /onScopeChange:\s*\(\)\s*=>\s*replaceLeads\(\[\]\)/],
  ["src/modules/deals/presentation/hooks/useDeals.ts", /useModuleAuthoritativeResource\(getDealCollectionResource\(\)/, /scopeKey:\s*workspace\.workspaceId/, /replaceDeals\(\[\]\)/],
  ["src/modules/quotes/presentation/hooks/useQuotes.ts", /useModuleAuthoritativeResource\(getQuoteCollectionResource\(\)/, /scopeKey:\s*workspace\.workspaceId/, /replaceQuotes\(\[\]\)/],
  ["src/modules/orders/presentation/hooks/useOrders.ts", /useModuleAuthoritativeResource\(getOrderCollectionResource\(\)/, /scopeKey:\s*workspace\.workspaceId/, /replaceOrders\(\{\}\)/],
  ["src/modules/contacts/application/vertical-slice/contactAuthoritativeQueries.ts", /getContactApiRuntime\(\)\.queries/, /createAuthoritativeResource/, /getContactDetailResource/, /getContactRelationshipSummaryResource/],
  ["src/modules/customers/application/vertical-slice/customerAuthoritativeQueries.ts", /getCustomerApiRuntime\(\)\.queries/, /createAuthoritativeResource/, /getCustomerDetailResource/, /getCustomer360Resource/],
  ["src/modules/organizations/application/vertical-slice/organizationAuthoritativeQueries.ts", /getOrganizationApiRuntime\(\)\.queries/, /createAuthoritativeResource/, /getOrganizationAccountDetailResource/, /getOrganizationOverviewResource/],
  ["src/modules/products/application/vertical-slice/productAuthoritativeQueries.ts", /createModuleCollectionResource<Product>\("products"/, /getProductDetailResource/],
  ["src/modules/returns/application/vertical-slice/returnAuthoritativeQueries.ts", /getReturnApiRuntime\(\)\.queries/, /createAuthoritativeResource/, /getReturnDetailResource/],
  ["src/modules/shipping/application/vertical-slice/shippingAuthoritativeQueries.ts", /getShippingApiRuntime\(\)\.queries/, /createAuthoritativeResource/, /getShippingBookingDetailResource/],
  ["src/modules/support/application/vertical-slice/supportAuthoritativeQueries.ts", /getSupportApiRuntime\(\)\.queries/, /createAuthoritativeResource/, /getSupportCaseDetailResource/],
  ["src/modules/tasks/application/vertical-slice/taskAuthoritativeQueries.ts", /getTaskApiRuntime\(\)\.queries/, /getActivityCollectionResource/, /getTaskDetailResource/],
  ["src/modules/contacts/presentation/hooks/useContacts.ts", /useModuleAuthoritativeResource\(getContactCollectionResource\(\)/, /scopeKey:\s*workspace\.workspaceId/, /replaceContacts\(\[\]\)/],
  ["src/modules/customers/presentation/hooks/useCustomers.ts", /useModuleAuthoritativeResource\(getCustomerCollectionResource\(\)/, /scopeKey:\s*workspace\.workspaceId/],
  ["src/modules/organizations/presentation/hooks/useOrganizationAccounts.ts", /useModuleAuthoritativeResource\(/, /getOrganizationAccountCollectionResource\(\)/, /scopeKey:\s*workspace\.workspaceId/, /replaceOrganizationAccounts\(\[\]\)/],
  ["src/modules/products/presentation/hooks/useProductListController.ts", /useModuleAuthoritativeResource\(getProductCollectionResource\(\)/, /scopeKey:\s*workspace\.workspaceId/],
  ["src/modules/support/presentation/hooks/useSupportCases.ts", /useModuleAuthoritativeResource\(getSupportCaseCollectionResource\(\)/, /scopeKey:\s*workspace\.workspaceId/],
  ["src/modules/returns/presentation/hooks/useReturnsAuthoritative.ts", /useModuleAuthoritativeResource\(getReturnCollectionResource\(\)/],
  ["src/modules/shipping/presentation/hooks/useShippingAuthoritative.ts", /useModuleAuthoritativeResource\(getShippingBookingCollectionResource\(\)/],
  ["src/modules/tasks/presentation/hooks/useTasksAuthoritative.ts", /useModuleAuthoritativeResource\(getTaskCollectionResource\(\)/],
] as const;
for (const [relativePath, ...patterns] of expectedSources) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  for (const pattern of patterns) assert.match(source, pattern, `${relativePath} is missing ${pattern}.`);
}

const authoritativeDetailRoutes = [
  ["src/modules/customers/detail-route.tsx", /getCustomerDetailResource/, /AuthoritativeQueryBoundary/, /scopeKey:\s*workspace\.workspaceId/],
  ["src/modules/organizations/detail-route.tsx", /getOrganizationAccountDetailResource/, /AuthoritativeQueryBoundary/, /replaceOrganizationAccounts\(\[\]\)/],
  ["src/modules/products/detail-route.tsx", /getProductDetailResource/, /AuthoritativeQueryBoundary/, /replaceProductCatalog\(\[\]\)/],
  ["src/modules/returns/detail-route.tsx", /getReturnDetailResource/, /AuthoritativeQueryBoundary/, /replaceReturnsSnapshot/],
  ["src/modules/shipping/detail-route.tsx", /getShippingBookingDetailResource/, /AuthoritativeQueryBoundary/, /replaceShippingSnapshot\(\[\]\)/],
  ["src/modules/support/detail-route.tsx", /getSupportCaseDetailResource/, /AuthoritativeQueryBoundary/, /replaceSupportCases\(\[\]\)/],
  ["src/modules/tasks/detail-route.tsx", /getTaskDetailResource/, /getActivityCollectionResource/, /AuthoritativeQueryBoundary/, /replaceTaskActivitySnapshot/],
] as const;
for (const [relativePath, ...patterns] of authoritativeDetailRoutes) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  for (const pattern of patterns) assert.match(source, pattern, `${relativePath} is missing ${pattern}.`);
}

const presentationFiles = [
  "src/modules/leads/presentation/pages/LeadListPage.tsx",
  "src/modules/leads/presentation/pages/LeadDetailPage.tsx",
  "src/modules/deals/presentation/pages/DealPipelinePage.tsx",
  "src/modules/deals/presentation/pages/DealDetailPage.tsx",
  "src/modules/quotes/presentation/pages/QuoteListPage.tsx",
  "src/modules/quotes/presentation/pages/QuoteDetailPage.tsx",
  "src/modules/orders/presentation/views/OrderListView.tsx",
  "src/modules/orders/presentation/pages/OrderDetailPage.tsx",
  "src/modules/contacts/presentation/pages/ContactListPage.tsx",
  "src/modules/contacts/presentation/pages/ContactDetailPage.tsx",
  "src/modules/customers/presentation/pages/CustomerListPage.tsx",
  "src/modules/organizations/presentation/pages/OrganizationAccountListPage.tsx",
  "src/modules/products/presentation/pages/ProductListPage.tsx",
  "src/modules/returns/presentation/pages/ReturnListPage.tsx",
  "src/modules/shipping/presentation/pages/ShippingBookingListPage.tsx",
  "src/modules/support/presentation/pages/SupportCaseListPage.tsx",
  "src/modules/tasks/presentation/pages/TaskListPage.tsx",
] as const;
for (const relativePath of presentationFiles) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  assert.match(source, /AuthoritativeQuery(?:Notice|Boundary)/, `${relativePath} must surface loading, refresh, stale or error state.`);
}

console.log("Commercial authoritative query runtime OK: dedicated relationship-domain and typed Deal/Quote/Order/Lead projections, unsupported query semantics fail closed, and server-state UX remains wired across modules.");
