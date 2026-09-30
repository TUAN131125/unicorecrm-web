import assert from "node:assert/strict";
import { createLeadConnectedApiRuntime } from "../../../src/modules/leads/infrastructure/http/createLeadConnectedApiRuntime.ts";
import { mapLeadDocumentToApplication, mapCreateLeadInputToRequest, mapReplaceLeadProfileInputToRequest } from "../../../src/modules/leads/infrastructure/http/LeadApiMapper.ts";
import { isLeadOperationAvailable, LEAD_OPERATION } from "../../../src/modules/leads/application/leadOperationAvailability.ts";
import type { HttpClient, HttpRequest } from "../../../src/platform/api/client/HttpClient.ts";
import type { LeadDocument } from "../../../src/platform/api/generated/commercialApi.ts";

const document: LeadDocument = {
  id: "lead_unassigned", displayName: "Unassigned", ownerId: null, version: 0,
  createdAt: "2026-09-29T00:00:00Z", updatedAt: "2026-09-29T00:00:00Z",
  leadWorkState: "NEW", score: 0, interestedProducts: [], activityProjection: "NOT_INCLUDED",
};
assert.equal(mapLeadDocumentToApplication(document).ownerId, undefined);
assert.equal(mapLeadDocumentToApplication({ ...document, ownerId: "member_sales" }).ownerId, "member_sales");
for (const ownerId of [undefined, "", " ", " queue ", "bad/member", "queue", "unassigned", "system", "sales_queue", 42]) {
  assert.throws(() => mapLeadDocumentToApplication({ ...document, ownerId } as LeadDocument));
}
assert.equal(Object.hasOwn(mapCreateLeadInputToRequest({ displayName: "Sale", email: "sale@example.test", ownerId: "member_other" }), "ownerId"), false);
assert.equal(mapReplaceLeadProfileInputToRequest({ displayName: "Queue" }).ownerId, null);
assert.equal(mapReplaceLeadProfileInputToRequest({ displayName: "Sale", ownerId: "member_sales" }).ownerId, "member_sales");

const requests: HttpRequest[] = [];
const client: HttpClient = {
  async request<TResponse, TBody = unknown>(input: HttpRequest<TBody>): Promise<TResponse> {
    requests.push(input as HttpRequest);
    return (input.operationId === "getLead" ? document : {
      items: [document], pageInfo: { hasNextPage: true, nextCursor: "server_cursor", totalCount: 7 },
    }) as TResponse;
  },
};
const runtime = createLeadConnectedApiRuntime(client);
const page = await runtime.queries.list({ limit: 1, search: "Queue", filters: { assignmentState: "UNASSIGNED" } });
assert.equal(page.items[0].ownerId, undefined);
assert.equal(page.pageInfo.totalCount, 7);
assert.equal(page.pageInfo.nextCursor, "server_cursor");
assert.equal(requests[0].query?.assignmentState, "UNASSIGNED");
assert.equal(requests[0].query?.search, "Queue");
await runtime.queries.list({ cursor: page.pageInfo.nextCursor, filters: { assignmentState: "ASSIGNED", ownerId: "member_sales" } });
assert.equal(requests[1].query?.assignmentState, "ASSIGNED");
assert.equal(requests[1].query?.cursor, "server_cursor");
await runtime.queries.list();
assert.equal(requests[2].query?.assignmentState, undefined);
assert.equal((await runtime.queries.get(document.id)).ownerId, undefined);
const before = requests.length;
await assert.rejects(() => runtime.queries.list({ filters: { assignmentState: "UNASSIGNED", ownerId: "member_sales" } }));
await assert.rejects(() => runtime.queries.list({ filters: { assignmentState: "QUEUE" } }));
assert.equal(requests.length, before);
for (const operation of [LEAD_OPERATION.ASSIGN_OWNER_BATCH, LEAD_OPERATION.HANDOVER_WITH_TASKS]) {
  assert.equal(isLeadOperationAvailable(operation), false);
}
const rejectedCommands = [
  () => runtime.commands.assignLeadOwnerBatch({ ownerId: "member_sales", reason: "test", items: [{ leadId: document.id, expectedVersion: 0 }] }, { idempotencyKey: "assign-batch" }),
  () => runtime.commands.handoverLeadWithTasks(document.id, { nextOwnerId: "member_sales", reason: "test", taskTargets: [] }, { idempotencyKey: "handover", expectedVersion: 0 }),
];
for (const command of rejectedCommands) await assert.rejects(command, { code: "LEAD_CONNECTED_OPERATION_NOT_IMPLEMENTED" });
assert.equal(requests.length, before, "Unavailable mutations must not call HTTP");
console.log("Lead ownership distribution contracts: PASS (nullable mapping, server query, owner preservation, unavailable future mutations)");
