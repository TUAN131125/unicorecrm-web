import assert from "node:assert/strict";
import { CommercialApiClient, type CreateLeadRequest, type CreateLeadResponse, type ReplaceLeadProfileResponse, type LeadDocument } from "@/platform/api";
import { ApiClientError, FetchHttpClient } from "@/platform/api";

const requiredEnvironment = [
  "UNICORECRM_TEST_API_BASE_URL", "UNICORECRM_TEST_ACCESS_TOKEN", "UNICORECRM_TEST_WORKSPACE_ID",
  "UNICORECRM_TEST_SECONDARY_ACCESS_TOKEN", "UNICORECRM_TEST_SECONDARY_WORKSPACE_ID",
] as const;
const environment = Object.fromEntries(requiredEnvironment.map((name) => [name, process.env[name]?.trim()])) as Record<(typeof requiredEnvironment)[number], string | undefined>;
const missing = requiredEnvironment.filter((name) => !environment[name]);
assert.deepEqual(missing, [], `Missing external backend acceptance environment: ${missing.join(", ")}`);
let accessToken = environment.UNICORECRM_TEST_ACCESS_TOKEN!;
let workspaceId = environment.UNICORECRM_TEST_WORKSPACE_ID!;
let unauthorizedCalls = 0;
const http = new FetchHttpClient({
  baseUrl: environment.UNICORECRM_TEST_API_BASE_URL!,
  accessTokenProvider: { getAccessToken: () => accessToken }, workspaceIdProvider: { getWorkspaceId: () => workspaceId },
  requestIdProvider: { createRequestId: () => `p09-${crypto.randomUUID()}` }, correlationIdProvider: { createCorrelationId: () => `p09-correlation-${crypto.randomUUID()}` },
  retryPolicy: { maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0 }, onUnauthorized: () => { unauthorizedCalls += 1; },
});
const api = new CommercialApiClient(http);
const initialPrimary = await api.listLeads();
assert.ok(Array.isArray(initialPrimary));
workspaceId = environment.UNICORECRM_TEST_SECONDARY_WORKSPACE_ID!;
await assertApiError(() => api.listLeads(), { statuses: [403], codes: ["WORKSPACE_ACCESS_DENIED", "WORKSPACE_MISMATCH", "FORBIDDEN", "AUTHORIZATION_DENIED"] });
accessToken = environment.UNICORECRM_TEST_SECONDARY_ACCESS_TOKEN!;
assert.ok(Array.isArray(await api.listLeads()));
accessToken = environment.UNICORECRM_TEST_ACCESS_TOKEN!; workspaceId = environment.UNICORECRM_TEST_WORKSPACE_ID!;
const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const request: CreateLeadRequest = { displayName: `Phase 3 Connected Lead ${suffix}`, email: `phase3-${suffix}@example.test`, source: "ACCEPTANCE", ownerId: "acceptance-user", estimatedValue: { amount: "1000.00", currency: "VND" } };
const idempotencyKey = `p09-lead-${crypto.randomUUID()}`;
const created = await api.createLead<CreateLeadResponse>(request, { idempotencyKey });
assertMutationOutcome(created); assertLeadDocument(created.result); assert.equal(created.result.displayName, request.displayName);
const replayed = await api.createLead<CreateLeadResponse>(request, { idempotencyKey });
assert.equal(replayed.aggregateId, created.aggregateId); assert.equal(replayed.commandId, created.commandId);
const detail = await api.getLead(created.aggregateId); assertLeadDocument(detail); assert.equal(detail.id, created.aggregateId);
const replaced = await api.replaceLeadProfile<ReplaceLeadProfileResponse>(created.aggregateId, { ...request, displayName: `${request.displayName} updated` }, { idempotencyKey: `phase3-replace-${crypto.randomUUID()}`, expectedVersion: created.version });
assertMutationOutcome(replaced); assert.equal(replaced.version, created.version + 1); assert.equal(replaced.result.displayName, `${request.displayName} updated`);
await assertApiError(() => api.createLead({ ...request, displayName: `${request.displayName} changed` }, { idempotencyKey }), { statuses: [409], codes: ["IDEMPOTENCY_KEY_REUSED", "IDEMPOTENCY_CONFLICT"] });
await assertApiError(() => api.createLead({ ...request, displayName: "" }, { idempotencyKey: `p09-invalid-${crypto.randomUUID()}` }), { statuses: [-1], codes: ["CONTRACT_VIOLATION"] });
accessToken = `invalid-p09-${crypto.randomUUID()}`;
await assertApiError(() => api.listLeads(), { statuses: [401], codes: ["AUTHENTICATION_REQUIRED", "UNAUTHORIZED", "INVALID_TOKEN"] });
assert.equal(unauthorizedCalls, 1);
// Data durability across database restart is not asserted by this contract acceptance gate.
console.log("Real backend contract acceptance: PASS (generated OpenAPI Lead list/detail/create/profile replacement, auth, workspace isolation, request-contract validation and idempotency). Optimistic concurrency is covered by operation-specific provider packs.");
function assertMutationOutcome(value: CreateLeadResponse | ReplaceLeadProfileResponse){for(const field of ["commandId","correlationId","aggregateId","aggregateType","occurredAt"] as const)assert.equal(typeof value[field],"string");assert.ok(value.version>=1);assert.ok(["COMMITTED","REPLAYED"].includes(value.outcome));assert.equal(value.result.id,value.aggregateId);}
function assertLeadDocument(value: LeadDocument){assert.equal(typeof value.id,"string");assert.equal(typeof value.displayName,"string");assert.ok(["NEW","CONTACTED","QUALIFIED","CLOSED"].includes(value.leadWorkState));assert.equal(typeof value.estimatedValue?.amount,"string");}
async function assertApiError(operation:()=>Promise<unknown>,expected:{statuses:number[];codes:string[]}){try{await operation();assert.fail(`Expected API error ${expected.codes.join("/")}.`);}catch(error){assert.ok(error instanceof ApiClientError);assert.ok(expected.statuses.includes(error.status??-1),`Unexpected status ${error.status}`);assert.ok(expected.codes.includes(error.code),`Unexpected code ${error.code}`);}}
