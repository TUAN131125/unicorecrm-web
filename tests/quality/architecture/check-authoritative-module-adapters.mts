import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import { assertCompleteModuleDataAuthorityRegistry, MODULE_DATA_AUTHORITY_KEYS } from "../../../src/shared/application";
import { createHttpModuleDataAuthorityRegistry, type HttpClient, type HttpRequest } from "../../../src/platform/api";
import { CONNECTED_MODULE_QUERY_RESPONSE_MAPPERS } from "../../../src/app/composition/connectedModuleQueryResponseMappers";

const requests: HttpRequest[] = [];
const client: HttpClient = { async request<TResponse>(input: HttpRequest): Promise<TResponse> {
  requests.push(input);
  if (input.operationId === "listContacts") return [] as TResponse;
  if (input.operationId === "listLeads") return { items: [{ id: "lead-1", displayName: "Lead", source: "WEB", score: 80, leadWorkState: "NEW", qualificationOutcome: "PENDING", relationshipRef: { type: "CONTACT", id: "contact-1" }, ownerId: "user-1", interestedProducts: [], activityProjection: "NOT_INCLUDED", estimatedValue: { amount: "1000000.25", currency: "VND" }, tags: [], createdAt: "2026-07-25T00:00:00.000Z", updatedAt: "2026-07-25T00:00:00.000Z", version: 3 }], page: { limit: 50, hasMore: false } } as TResponse;
  if (input.operationId === "getOrder") return { id: "order-1", resourceVersion: 9 } as TResponse;
  if (input.operationId === "getInvoice") return { id: "inv-1", version: 2 } as TResponse;
  throw new Error(`Unexpected request ${input.operationId}`);
} };
const registry = createHttpModuleDataAuthorityRegistry(client, undefined, CONNECTED_MODULE_QUERY_RESPONSE_MAPPERS);
assertCompleteModuleDataAuthorityRegistry(registry, "P0 adapter contract test");
assert.equal(Object.keys(registry).length, MODULE_DATA_AUTHORITY_KEYS.length);
for (const key of MODULE_DATA_AUTHORITY_KEYS) {
  assert.equal(registry[key].source, "backend");
  assert.equal(registry[key].key, key);
  assert.equal(registry[key].commands.allowedOperations.size, 0, `${key} generic connected mutations must remain blocked.`);
}
const contacts = await registry.contacts.queries.list<{ id: string }>();
assert.deepEqual(contacts.items, []);
assert.equal(requests[0]?.operationId, "listContacts");
await assert.rejects(registry.contacts.queries.list({ search: "linh" }), /Unsupported query parameters/u);
const leads = await registry.leads.queries.list<{ id: string; estimatedValue: { amount: string; currency: string }; resourceVersion: number }>();
assert.equal(leads.items[0]?.estimatedValue.amount, "1000000.25");
assert.equal(leads.items[0]?.resourceVersion, 3);
assert.equal(requests.at(-1)?.operationId, "listLeads");
const order = await registry.orders.queries.get<{ id: string; resourceVersion: number }>("order-1");
assert.equal(order.resourceVersion, 9);
assert.equal(requests.at(-1)?.operationId, "getOrder");
const invoice = await registry.invoices.queries.get<{ id: string; version: number }>("inv/1");
assert.equal(invoice.version, 2);
assert.equal(requests.at(-1)?.operationId, "getInvoice");
assert.equal(requests.at(-1)?.path, "/invoices/inv%2F1");
await assert.rejects(registry.deals.commands.execute({ operation: "move-stage", aggregateId: "deal-1", payload: {} }, { idempotencyKey: "idem" }), /no direct authority/u);

const composition = fs.readFileSync(path.join(repositoryRoot, "src/app/composition/applicationComposition.ts"), "utf8");
assert.match(composition, /createHttpModuleDataAuthorityRegistry/);
assert.doesNotMatch(composition, /from ["']\.\/demoApplicationServiceBundle["']/u);
assert.match(composition, /mode === "connected"[\s\S]{0,500}createHttpModuleDataAuthorityRegistry/u);
console.log("Authoritative module adapters: PASS (15 explicit query authorities; typed application DTO queries are ready while unsupported parameters and all generic mutations fail closed).")
