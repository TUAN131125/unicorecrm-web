import assert from "node:assert/strict";
import { CommercialApiClient, type ContactDocument, type ContactList, type ContactListSummary } from "../../../src/platform/api/generated/commercialApi";
import type { HttpClient, HttpRequest } from "../../../src/platform/api/client";
import { ApiClientError } from "../../../src/platform/api/errors";
import type { ModuleListQuery } from "../../../src/shared/application";
import { ContactHttpApiAdapter } from "../../../src/modules/contacts/infrastructure/http/ContactHttpApiAdapter";

const document: ContactDocument = {
  id: "contact-1", workspaceId: "workspace-1", fullName: "Canonical name", displayName: "Visible name",
  status: "active", version: 7, createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-06T00:00:00Z",
  nextFollowUpAt: "2026-10-07T09:00:00Z", workEmail: "visible@example.test", ownerId: "member-1",
};
const requests: HttpRequest[] = [];
let pageResponse: unknown = { items: [document], pageInfo: { hasNextPage: true, nextCursor: "opaque-next", totalCount: 10001 }, followUpAvailable: true } satisfies ContactList;
let summaryResponse: unknown = { totalCount: 10001, statusCounts: { active: 9999, archived: 2 } } satisfies ContactListSummary;
const http: HttpClient = { async request<T>(request: HttpRequest): Promise<T> {
  requests.push(request);
  if (request.operationId === "listContacts") return pageResponse as T;
  if (request.operationId === "getContactListSummary") return summaryResponse as T;
  throw new Error(`Unexpected operation: ${request.operationId}`);
} };
const adapter = new ContactHttpApiAdapter(new CommercialApiClient(http));
const controller = new AbortController();
const query: ModuleListQuery = {
  cursor: "opaque-position", limit: 1, search: "Visible", sortBy: "nameAsc", sortDirection: "asc",
  filters: { status: "active", ownerScope: "my", ownerId: "member-1", source: "web", relationshipLevel: "warm",
    decisionRole: "decision_maker", doNotContact: false, link: "linked", nextFollowUpDate: "2026-10-07", followUp: "today" },
};
const page = await adapter.list(query, controller.signal);
assert.equal(requests.length, 1, "Loading a page must not drain continuation pages or fetch summary.");
assert.equal(page.items.length, 1);
assert.equal(page.items[0]?.name, "Canonical name", "Domain name normalization preserves canonical fullName.");
assert.equal(page.items[0]?.fullName, "Canonical name");
assert.equal(page.items[0]?.resourceVersion, 7);
assert.equal(page.items[0]?.nextFollowUpAt, document.nextFollowUpAt);
assert.deepEqual(page.pageInfo, { hasNextPage: true, nextCursor: "opaque-next", totalCount: 10001 });
assert.equal(page.authority, "backend");
assert.ok(Number.isFinite(Date.parse(page.loadedAt)));
assert.equal(requests[0]?.signal, controller.signal);
assert.equal(requests[0]?.path, "/contacts");
assert.equal(requests[0]?.method, "GET");
assert.deepEqual(requests[0]?.query, { ...query.filters, cursor: "opaque-position", limit: 1, search: "Visible", sort: "nameAsc" });

const summary = await adapter.summary(query, controller.signal);
assert.equal(requests.length, 2, "Summary uses a separate server request.");
assert.equal(requests[1]?.operationId, "getContactListSummary");
assert.equal(requests[1]?.path, "/contacts/summary");
assert.equal(requests[1]?.method, "GET");
assert.equal(requests[1]?.signal, controller.signal);
assert.deepEqual(requests[1]?.query, { ...query.filters, search: "Visible", sort: "nameAsc" });
assert.deepEqual(summary, summaryResponse);
summary.statusCounts.active = 0;
assert.equal((summaryResponse as ContactListSummary).statusCounts.active, 9999, "Returned summary must not share mutable counts with transport data.");

pageResponse = { items: [], pageInfo: { hasNextPage: false, nextCursor: null, totalCount: 0 }, followUpAvailable: true };
const empty = await adapter.list();
assert.deepEqual(empty.items, []);
assert.deepEqual(empty.pageInfo, { hasNextPage: false, nextCursor: undefined, totalCount: 0 });
for (const [sortBy, sortDirection] of [["recentlyUpdated", "desc"], ["nextFollowUp", "asc"]] as const) {
  await adapter.list({ sortBy, sortDirection });
  assert.equal(requests.at(-1)?.query?.sort, sortBy);
}

const contractViolation = (error: unknown) => error instanceof ApiClientError && error.code === "CONNECTED_QUERY_CONTRACT_VIOLATION" && !error.retryable;
const unavailable: ModuleListQuery[] = [
  ...["priority", "teamContacts", "inactiveLongTime", "lastContactedAt", "duplicates", "nearClosing"].map(key => ({ filters: { [key]: "requested" } })),
  { filters: { doNotContact: "false" } }, { filters: { status: true } },
  { sortBy: "lastContacted" }, { sortBy: "createdAt" }, { sortBy: "nameAsc", sortDirection: "desc" },
  { sortBy: "recentlyUpdated", sortDirection: "asc" }, { sortBy: "nextFollowUp", sortDirection: "desc" },
];
for (const invalid of unavailable) {
  const before: number = requests.length;
  await assert.rejects(adapter.list(invalid), contractViolation);
  await assert.rejects(adapter.summary(invalid), contractViolation);
  assert.equal(requests.length, before, "Unsupported query intent must fail before transport, without silently changing semantics.");
}
for (const invalid of [[document], { items: [], pageInfo: { hasNextPage: "false", totalCount: 0 } },
  { items: [], pageInfo: { hasNextPage: false, totalCount: 1.5 } },
  { items: [], pageInfo: { hasNextPage: false, totalCount: -1 } },
  { items: [document], pageInfo: { hasNextPage: true, totalCount: 10 } }]) {
  pageResponse = invalid;
  await assert.rejects(adapter.list(), contractViolation);
}
pageResponse = { items: [document, { ...document, id: "contact-2" }], pageInfo: { hasNextPage: false, totalCount: 2 }, followUpAvailable: true };
await assert.rejects(adapter.list({ limit: 1 }), contractViolation, "An oversized response must not silently become a bounded page.");
for (const invalid of [{ totalCount: -1, statusCounts: {} }, { totalCount: 1.5, statusCounts: {} },
  { totalCount: 3, statusCounts: { active: -1 } }, { totalCount: 3, statusCounts: { active: 0.5 } }]) {
  summaryResponse = invalid;
  await assert.rejects(adapter.summary(), contractViolation);
}
const abortHttp: HttpClient = { request<T>(request: HttpRequest): Promise<T> {
  assert.equal(request.signal, controller.signal);
  return new Promise((_, reject) => request.signal?.addEventListener("abort", () => reject(request.signal?.reason), { once: true }));
} };
const abortAdapter = new ContactHttpApiAdapter(new CommercialApiClient(abortHttp));
const pendingList = abortAdapter.list({}, controller.signal);
const pendingSummary = abortAdapter.summary({}, controller.signal);
const abortedList = assert.rejects(pendingList, error => error === controller.signal.reason);
const abortedSummary = assert.rejects(pendingSummary, error => error === controller.signal.reason);
controller.abort(new DOMException("Cancelled", "AbortError"));
await Promise.all([abortedList, abortedSummary]);
console.log("Contact HTTP query contract: PASS (bounded mapping, server totals, forwarding, abort, separate summary and pre-transport query refusal).");
