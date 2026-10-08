import assert from "node:assert/strict";
import { ApplicationError } from "../../../src/shared/domain/applicationError";
import { LeadKanbanWindows, leadKanbanColumns } from "../../../src/modules/leads/application/queries/leadKanbanWindows";
import { CommercialApiClient } from "../../../src/platform/api/generated/commercialApi";
import { LeadHttpKanbanQueryAdapter } from "../../../src/modules/leads/infrastructure/http/LeadHttpKanbanQueryAdapter";
import type { Lead } from "../../../src/modules/leads/domain/model/lead.types";
import type { LeadListQuery, LeadKanbanColumn } from "../../../src/modules/leads/application/ports/LeadApiRuntime";
import type { AuthoritativePage } from "../../../src/shared/application";
import type { HttpClient, HttpRequest } from "../../../src/platform/api/client";

const lead = (id: string): Lead => ({ id, name: id, title: "", companyName: "", email: "", phone: "", source: "WEB", score: 0,
  leadWorkState: "NEW", interestedProducts: [], activities: [], createdAt: "2026-10-06T00:00:00Z" });
const page = (ids: string[], cursor?: string): AuthoritativePage<Lead> => ({ items: ids.map(lead),
  pageInfo: { hasNextPage: Boolean(cursor), totalCount: 120, ...(cursor ? { nextCursor: cursor } : {}) },
  loadedAt: "2026-10-06T00:00:00Z", authority: "backend" });
assert.deepEqual(leadKanbanColumns("all"), ["NEW", "CONTACTING", "VERIFYING", "POSITIVE_OUTCOME"]);
assert.deepEqual(leadKanbanColumns("nurture"), ["NURTURE"]);

let failMore = true;
const calls: Array<[LeadKanbanColumn, LeadListQuery]> = [];
const store = new LeadKanbanWindows(["NEW", "CONTACTING"], { search: "search" }, async (column, query) => {
  calls.push([column, query]);
  assert.equal(query.limit, 50);
  assert.equal(query.search, "search");
  if (column === "CONTACTING") return page(["other"]);
  if (!query.cursor) return page(["first"], "new-cursor");
  assert.equal(query.cursor, "new-cursor");
  if (failMore) throw new ApplicationError({ code: "NETWORK_ERROR", category: "INFRASTRUCTURE", message: "failed", retryable: true });
  return page(["first", "second"]);
});
await store.refresh();
const contacting = store.snapshot().CONTACTING;
await store.loadMore("NEW");
assert.ok(store.snapshot().NEW?.error);
assert.equal(store.snapshot().NEW?.nextCursor, "new-cursor");
assert.equal(store.snapshot().NEW?.loadedCount, 1);
assert.strictEqual(store.snapshot().CONTACTING, contacting, "loading/error in NEW never replaces CONTACTING");
assert.equal(calls.filter(([column]) => column === "CONTACTING").length, 1);
failMore = false;
await store.retry("NEW");
assert.equal(store.snapshot().NEW?.error, undefined);
assert.equal(store.snapshot().NEW?.loadedCount, 2, "append deduplicates existing ids");
assert.deepEqual(store.snapshot().NEW?.items.map(item => item.id), ["first", "second"]);
await store.refresh();
assert.equal(store.snapshot().NEW?.loadedCount, 1, "refresh replaces earlier windows");

let resolveOld: (page: AuthoritativePage<Lead>) => void = () => { throw new Error("missing deferred request"); };
let generation = 0;
const racing = new LeadKanbanWindows(["NEW"], {}, () => {
  generation++;
  if (generation === 1) return new Promise(resolve => { resolveOld = resolve; });
  return Promise.resolve(page(["fresh"]));
});
const oldRequest = racing.refresh();
await racing.refresh();
resolveOld(page(["stale"]));
await oldRequest;
assert.equal(racing.snapshot().NEW?.items[0]?.id, "fresh", "late aborted response cannot replace latest generation");
const cancelRequest = new LeadKanbanWindows(["NEW"], {}, () => new Promise(resolve => { resolveOld = resolve; }));
const pending = cancelRequest.refresh();
cancelRequest.cancel();
resolveOld(page(["foreign-workspace"]));
await pending;
assert.equal(cancelRequest.snapshot().NEW?.loadedCount, 0, "scope disposal rejects late response");

let forbidden = false;
const denied = new LeadKanbanWindows(["NEW"], {}, async () => {
  if (forbidden) throw new ApplicationError({ code: "ACCESS_DENIED", category: "AUTHORIZATION", status: 403, message: "denied" });
  return page(["private"]);
});
await denied.refresh(); forbidden = true; await denied.refresh();
assert.equal(denied.snapshot().NEW?.loadedCount, 0, "authorization failure evicts retained cards");

const requests: HttpRequest[] = [];
let response: unknown = { items: [], pageInfo: { hasNextPage: false, totalCount: 0 } };
const http: HttpClient = { async request<T>(request: HttpRequest): Promise<T> { requests.push(request); return response as T; } };
const adapter = new LeadHttpKanbanQueryAdapter(new CommercialApiClient(http));
const transportSignal = new AbortController().signal;
await adapter.column("NEW", { limit: 50, filters: { ownerId: "member_a" } }, transportSignal);
assert.equal(requests[0]?.path, "/leads/kanban/NEW");
assert.equal(requests[0]?.operationId, "listLeadKanbanColumn");
assert.equal(requests[0]?.contractAuthority, undefined, "Uses canonical OpenAPI validation, never a semantic extension");
assert.equal(requests[0]?.query?.ownerId, "member_a");
assert.strictEqual(requests[0]?.signal, transportSignal, "Cancellation reaches the generated HTTP request");
response = { items: [], pageInfo: { hasNextPage: true, totalCount: 3 } };
await assert.rejects(adapter.column("NEW"));
await assert.rejects(adapter.column("NEW", { filters: { unsupported: "value" } }));
console.log("Lead Kanban independent-window, race, authorization-eviction and HTTP-boundary checks PASS");
