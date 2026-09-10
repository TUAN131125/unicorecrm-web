import assert from "node:assert/strict";
import { createOrganizationConnectedApiRuntime } from "../../../src/modules/organizations/infrastructure/http/createOrganizationConnectedApiRuntime.ts";
import type { HttpClient, HttpRequest } from "../../../src/platform/api/client/HttpClient.ts";

const requests: HttpRequest[] = [];
const document = {
  id: "organization-1", workspaceId: "workspace-1", displayName: "Alpha", status: "active",
  version: 4, createdAt: "2026-08-01T10:00:00.000Z", updatedAt: "2026-08-01T10:00:00.000Z",
};
const client: HttpClient = {
  async request<TResponse, TBody = unknown>(input: HttpRequest<TBody>): Promise<TResponse> {
    requests.push(input as HttpRequest);
    if (input.operationId === "listOrganizations") return {
      items: [document], pageInfo: { hasNextPage: true, nextCursor: "organization-cursor-2" },
    } as TResponse;
    if (input.operationId === "getOrganization") return document as TResponse;
    if (input.operationId === "getOrganizationOverview") return {
      organization: document, contactIds: [], metrics: { representativeCount: 0 }, linkedRecords: [],
      allowedActions: [], projectionVersion: 4, generatedAt: "2026-08-01T10:00:00.000Z",
    } as TResponse;
    throw new Error(`Unexpected operation: ${input.operationId}`);
  },
};

const runtime = createOrganizationConnectedApiRuntime(client);
const page = await runtime.queries.list({
  cursor: "organization-cursor-1", limit: 25, search: "alpha",
  filters: { status: "active", industry: "Technology", sizeBand: "SMB", ownerId: "member-1" },
});
assert.equal(page.pageInfo.hasNextPage, true);
assert.equal(page.pageInfo.nextCursor, "organization-cursor-2");
assert.equal(page.pageInfo.totalCount, undefined);
assert.deepEqual(requests[0]?.query, {
  cursor: "organization-cursor-1", limit: 25, q: "alpha", status: "active",
  industry: "Technology", sizeBand: "SMB", ownerId: "member-1",
});
await assert.rejects(() => runtime.queries.list({ sortBy: "displayName" }), /ORGANIZATION_QUERY_UNSUPPORTED/);
await assert.rejects(() => runtime.queries.list({ filters: { status: "deleted" } }), /ORGANIZATION_QUERY_STATUS_INVALID/);

console.log("Organization API boundary: PASS — authoritative query fields and PageInfo are preserved.");
