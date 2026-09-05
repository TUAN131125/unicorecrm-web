import assert from "node:assert/strict";
import process from "node:process";
import { createConnectedApiTestHost } from "../../fixtures/connected-host/connectedApiTestHost.mjs";
import { CommercialApiClient, type AdvanceLeadWorkStateRequest, type CreateLeadRequest, type CreateLeadResponse, type DisqualifyLeadRequest, type LeadMutationResponse, type ReplaceLeadProfileRequest, type ReplaceLeadProfileResponse, type ReopenDisqualifiedLeadRequest } from "@/platform/api";
import {
  ApiClientError,
  FetchHttpClient,
  RoutedHttpMutationAuthority,
  createHttpModuleDataAuthorityRegistry,
  DEFAULT_MODULE_AUTHORITY_DEFINITIONS,
} from "@/platform/api";
import {
  getApplicationCompositionStatus,
  initializeApplicationComposition,
} from "@/app/composition";
import { createConnectedApplicationServiceBundle } from "@/app/composition/connectedApplicationServiceBundle";
import { MutationCommandError } from "@/shared/application";
import { CONNECTED_MODULE_QUERY_RESPONSE_MAPPERS } from "@/app/composition/connectedModuleQueryResponseMappers";

const host = createConnectedApiTestHost({ contractMode: "openapi" });
const address = await host.start();
try {
  let token = "connected-fixture-token-alpha";
  let workspaceId = "workspace-alpha";
  let unauthorizedCalls = 0;
  const client = new FetchHttpClient({
    baseUrl: address.baseUrl,
    accessTokenProvider: { getAccessToken: () => token },
    workspaceIdProvider: { getWorkspaceId: () => workspaceId },
    requestIdProvider: { createRequestId: () => `request-${crypto.randomUUID()}` },
    correlationIdProvider: { createCorrelationId: () => `correlation-${crypto.randomUUID()}` },
    retryPolicy: { maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0 },
    onUnauthorized: () => { unauthorizedCalls += 1; },
  });

  await initializeApplicationComposition({ mode: "connected", http: { client } });
  assert.equal(getApplicationCompositionStatus().mode, "connected");
  assert.equal(getApplicationCompositionStatus().moduleDataAuthority, "connected-http");
  const bundle = createConnectedApplicationServiceBundle(client);
  assert.equal(Object.keys(bundle.modules).length, 15);

  const registry = createHttpModuleDataAuthorityRegistry(
    client,
    DEFAULT_MODULE_AUTHORITY_DEFINITIONS,
    CONNECTED_MODULE_QUERY_RESPONSE_MAPPERS,
  );
  const api = new CommercialApiClient(client);
  const alphaPage = await api.listLeads();
  assert.deepEqual(alphaPage.items.map((lead) => lead.displayName), ["OpenAPI Alpha Lead"]);
  const alphaDetail = await api.getLead("openapi-alpha-lead");
  assert.equal(alphaDetail.leadWorkState, "NEW");
  const mappedAlphaPage = await registry.leads.queries.list<{ id: string; name: string; estimatedValue?: { amount: string; currency: string }; resourceVersion?: number }>({ limit: 25 });
  assert.equal(mappedAlphaPage.authority, "backend");
  assert.equal(mappedAlphaPage.items[0]?.name, "OpenAPI Alpha Lead");
  assert.deepEqual(mappedAlphaPage.items[0]?.estimatedValue, { amount: "1000.00", currency: "VND" });
  assert.equal(mappedAlphaPage.items[0]?.resourceVersion, 1);

  workspaceId = "workspace-beta";
  await assertApiError(() => api.listLeads(), { status: 403, code: "WORKSPACE_ACCESS_DENIED" });
  token = "connected-fixture-token-beta";
  const betaPage = await api.listLeads();
  assert.deepEqual(betaPage.items.map((lead) => lead.displayName), ["OpenAPI Beta Lead"]);

  token = "connected-fixture-token-alpha";
  workspaceId = "workspace-alpha";
  const createRequest: CreateLeadRequest = {
    displayName: "Connected Created Lead",
    phone: "0901234567",
  };
  const idempotencyKey = "lead-create-connected-1";
  const created = await api.createLead<CreateLeadResponse>(createRequest, { idempotencyKey });
  assert.equal(created.aggregateId, created.result.id);
  assert.equal(created.result.displayName, createRequest.displayName);
  assert.equal(created.version, 1);
  assert.ok(created.commandId && created.correlationId && created.auditEvidenceIds?.length);

  const replayed = await api.createLead<CreateLeadResponse>(createRequest, { idempotencyKey });
  assert.equal(replayed.commandId, created.commandId);
  assert.equal(replayed.aggregateId, created.aggregateId);
  const createdDetail = await api.getLead(created.aggregateId);
  assert.equal(createdDetail.displayName, createRequest.displayName);

  const replaceRequest: ReplaceLeadProfileRequest = {
    ...createRequest,
    displayName: "Connected Updated Lead",
    ownerId: created.result.ownerId,
    tags: ["phase3", "updated"],
  };
  const replaced = await api.replaceLeadProfile<ReplaceLeadProfileResponse>(created.aggregateId, replaceRequest, {
    idempotencyKey: "lead-replace-connected-1",
    expectedVersion: created.version,
  });
  assert.equal(replaced.aggregateId, created.aggregateId);
  assert.equal(replaced.version, 2);
  assert.equal(replaced.result.displayName, replaceRequest.displayName);
  const replaceReplay = await api.replaceLeadProfile<ReplaceLeadProfileResponse>(created.aggregateId, replaceRequest, {
    idempotencyKey: "lead-replace-connected-1",
    expectedVersion: created.version,
  });
  assert.equal(replaceReplay.commandId, replaced.commandId);
  await assertApiError(
    () => api.replaceLeadProfile(created.aggregateId, { ...replaceRequest, displayName: "Stale replacement" }, { idempotencyKey: "lead-replace-stale", expectedVersion: 1 }),
    { status: 412, code: "RESOURCE_VERSION_CONFLICT" },
  );
  assert.equal((await api.getLead(created.aggregateId)).displayName, replaceRequest.displayName);

  const contacting = await api.advanceLeadWorkState<LeadMutationResponse, AdvanceLeadWorkStateRequest>(
    created.aggregateId,
    { targetWorkState: "CONTACTING" },
    { idempotencyKey: "lead-advance-contacting-1", expectedVersion: replaced.version },
  );
  assert.equal(contacting.result.leadWorkState, "CONTACTING");
  assert.equal(contacting.version, 3);

  const verifying = await api.advanceLeadWorkState<LeadMutationResponse, AdvanceLeadWorkStateRequest>(
    created.aggregateId,
    { targetWorkState: "VERIFYING", verificationProfile: { companyName: "Connected Company", painPoint: "Needs lifecycle API" } },
    { idempotencyKey: "lead-advance-verifying-1", expectedVersion: contacting.version },
  );
  assert.equal(verifying.result.leadWorkState, "VERIFYING");
  assert.equal(verifying.result.companyName, "Connected Company");

  const disqualified = await api.disqualifyLead<LeadMutationResponse, DisqualifyLeadRequest>(
    created.aggregateId,
    { reason: "No current fit", evidence: "Verified during qualification review" },
    { idempotencyKey: "lead-disqualify-connected-1", expectedVersion: verifying.version },
  );
  assert.equal(disqualified.result.leadWorkState, "CLOSED");
  assert.equal(disqualified.result.qualificationOutcome, "DISQUALIFIED");
  const disqualifyReplay = await api.disqualifyLead<LeadMutationResponse, DisqualifyLeadRequest>(
    created.aggregateId,
    { reason: "No current fit", evidence: "Verified during qualification review" },
    { idempotencyKey: "lead-disqualify-connected-1", expectedVersion: verifying.version },
  );
  assert.equal(disqualifyReplay.commandId, disqualified.commandId);

  const reopened = await api.reopenDisqualifiedLead<LeadMutationResponse, ReopenDisqualifiedLeadRequest>(
    created.aggregateId,
    {},
    { idempotencyKey: "lead-reopen-connected-1", expectedVersion: disqualified.version },
  );
  assert.equal(reopened.result.leadWorkState, "CONTACTING");
  assert.equal(reopened.result.qualificationOutcome, undefined);
  await assertApiError(
    () => api.reopenDisqualifiedLead(created.aggregateId, {}, { idempotencyKey: "lead-reopen-stale", expectedVersion: disqualified.version }),
    { status: 412, code: "RESOURCE_VERSION_CONFLICT" },
  );

  await assertApiError(
    () => api.createLead({ ...createRequest, displayName: "Different payload" }, { idempotencyKey }),
    { status: 409, code: "IDEMPOTENCY_KEY_REUSED" },
  );
  await assertApiError(
    () => api.createLead({ ...createRequest, displayName: "" }, { idempotencyKey: "lead-create-invalid" }),
    { code: "CONTRACT_VIOLATION" },
  );

  await assertApiError(
    () => registry.leads.commands.execute({ operation: "update", aggregateId: created.aggregateId, payload: { displayName: "Forbidden generic update" } }, { idempotencyKey: "generic-update" }),
    { code: "CONNECTED_GENERIC_MODULE_MUTATION_BLOCKED" },
  );
  await assertApiError(
    () => new RoutedHttpMutationAuthority(client, registry).execute({ commandType: "lead.update", aggregateType: "Lead", aggregateId: created.aggregateId, payload: { displayName: "Forbidden routed update" } }, { idempotencyKey: "routed-update", expectedVersion: 1 }),
    { code: "CONNECTED_COMMAND_CONTRACT_BLOCKED" },
  );

  token = "expired-connected-fixture-token";
  await assertApiError(() => api.listLeads(), { status: 401, code: "AUTHENTICATION_REQUIRED" });
  assert.equal(unauthorizedCalls, 1);
  token = "connected-fixture-token-alpha";
  assert.equal((await api.listLeads()).items.length, 2);

  const missingWorkspaceClient = new FetchHttpClient({
    baseUrl: address.baseUrl,
    accessTokenProvider: { getAccessToken: () => token },
    workspaceIdProvider: { getWorkspaceId: () => undefined },
  });
  await assertApiError(() => new CommercialApiClient(missingWorkspaceClient).listLeads(), { status: 400, code: "WORKSPACE_CONTEXT_REQUIRED", clientSideStatusMayBeUndefined: true });

  console.log("Connected backend integration: PASS (generated OpenAPI Lead list/detail/profile/lifecycle operations, workspace isolation, idempotency, validation, fail-closed blocked operations, authoritative mutation evidence and workspace fail-closed behavior).");
} finally {
  await host.stop();
}

async function assertApiError(
  operation: () => Promise<unknown>,
  expected: { status?: number; code: string; clientSideStatusMayBeUndefined?: boolean },
): Promise<void> {
  try {
    await operation();
    assert.fail(`Expected API error ${expected.code}.`);
  } catch (error) {
    assert.ok(error instanceof ApiClientError || error instanceof MutationCommandError, `Expected typed API or mutation error, received ${String(error)}.`);
    if (error instanceof ApiClientError && expected.status !== undefined && !(expected.clientSideStatusMayBeUndefined && error.status === undefined)) assert.equal(error.status, expected.status);
    assert.equal(error.code, expected.code);
  }
}
