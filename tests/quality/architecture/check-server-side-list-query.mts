import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_MODULE_AUTHORITY_DEFINITIONS,
  HttpModuleQueryAdapter,
  type HttpClient,
  type HttpRequest,
} from "../../../src/platform/api";

const requests: HttpRequest[] = [];
const client: HttpClient = {
  async request<TResponse>(request: HttpRequest): Promise<TResponse> {
    requests.push(request);
    return {
      items: [{ id: "quote-1" }],
      pageInfo: { hasNextPage: true, nextCursor: "cursor-2", totalCount: 301 },
    } as TResponse;
  },
};

const quoteDefinition = DEFAULT_MODULE_AUTHORITY_DEFINITIONS.find((definition) => definition.key === "quotes");
assert.ok(quoteDefinition, "The generated connected query registry must contain Quotes.");
const adapter = new HttpModuleQueryAdapter(client, quoteDefinition);
const page = await adapter.list<{ id: string }>({
  limit: 25,
  search: "enterprise",
  sortBy: "updatedAt",
  sortDirection: "desc",
  filters: {
    status: "SENT",
    buyerType: "CONTACT",
    buyerId: "contact-1",
  },
});
assert.equal(requests.length, 1, "A server-driven page must issue exactly one list request.");
assert.equal(requests[0]?.query?.limit, 25);
assert.equal(requests[0]?.query?.search, "enterprise");
assert.equal(requests[0]?.query?.sortBy, "updatedAt");
assert.equal(requests[0]?.query?.sortDirection, "desc");
assert.equal(requests[0]?.query?.status, "SENT");
assert.equal(requests[0]?.query?.buyerType, "CONTACT");
assert.equal(requests[0]?.query?.buyerId, "contact-1");
assert.equal(page.pageInfo.nextCursor, "cursor-2");
assert.equal(page.pageInfo.totalCount, 301);

const orderDefinition = DEFAULT_MODULE_AUTHORITY_DEFINITIONS.find((definition) => definition.key === "orders");
assert.ok(orderDefinition, "The generated connected query registry must contain Orders.");
const orderAdapter = new HttpModuleQueryAdapter(client, orderDefinition);
await orderAdapter.list({
  search: "ORD-001",
  sortBy: "updatedAt",
  sortDirection: "desc",
  filters: { state: "CONFIRMED" },
});
assert.equal(requests[1]?.operationId, "listOrders");
assert.deepEqual(requests[1]?.query, {
  search: "ORD-001",
  sortBy: "updatedAt",
  sortDirection: "desc",
  state: "CONFIRMED",
});

const root = repositoryRoot;
const expected = [
  ["src/shared/operations/useServerPagedCollection.ts", /cursorByPageRef/, /totalCount/, /options\.loadPage/, /limit:\s*pageSize/, /SERVER_PAGE_CURSOR_REQUIRED/],
  ["src/modules/leads/presentation/pages/LeadListPage.tsx", /useLeadServerPagedCollection/, /search:\s*filters\.searchTerm\.trim\(\)/, /workState:/, /ownerId/, /enabled:\s*viewMode\s*===\s*"table"/, /useLeads\(\{\s*loadAuthoritative:\s*viewMode\s*===\s*"kanban"\s*\}\)/],
  ["src/modules/leads/presentation/hooks/useLeadServerPagedCollection.ts", /useServerPagedCollection/, /getLeadApiRuntime\(\)\.queries\.list/],
  ["src/modules/quotes/presentation/pages/QuoteListPage.tsx", /useServerPagedModuleCollection<Quote>/, /key:\s*"quotes"/, /useQuotes\(\{\s*loadAuthoritative:\s*false\s*\}\)/, /sourceDealId:\s*filterDeal/, /sortBy:\s*"updatedAt"/],
  ["src/modules/orders/presentation/hooks/useOrderListController.tsx", /useServerPagedModuleCollection<CustomerOrder>/, /key:\s*"orders"/, /enabled:\s*view\s*!==\s*"kanban"/, /useOrders\(\{\s*loadAuthoritative:\s*view\s*===\s*"kanban"\s*\}\)/, /filters:\s*\{\s*state:/],
  ["src/modules/orders/presentation/views/OrderListView.tsx", /serverPagination\.connected/, /pageItems:\s*filteredOrders/],
] as const;
for (const [relativePath, ...patterns] of expected) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  for (const pattern of patterns) assert.match(source, pattern, `${relativePath} is missing ${pattern}.`);
}

const transitionalLoader = fs.readFileSync(path.join(root, "src/shared/application/data-authority/moduleAuthoritativeResource.ts"), "utf8");
assert.match(transitionalLoader, /Transitional collection loader/, "The cursor-complete loader must remain explicitly transitional.");
assert.match(transitionalLoader, /while \(pageCount < maxPages\)/, "Transitional full-projection surfaces must retain bounded cursor completion until their dedicated server query exists.");

console.log("Server-side list query contract OK: Lead, Quote, and Order use whitelisted backend search/filter/pagination; Deal Kanban keeps its dedicated stage-window contract.");
