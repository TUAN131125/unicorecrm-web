import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import type { DealPipelineDocument, DealPipelineStageDocument } from "@/platform/api/generated/crmConfigurationApi";
import type { DealReadModel } from "@/platform/api/generated/commercialApi";

// Install the browser fixture before application imports capture their storage ports.
const dom = new JSDOM('<!doctype html><html><body><div id="pipeline-hook-root"></div></body></html>', { url: "http://localhost" });
const globals = ["window", "document", "navigator", "localStorage", "HTMLElement", "SVGElement", "Element", "Node", "Event", "CustomEvent", "EventTarget", "MutationObserver"] as const;
const descriptors = new Map<string, PropertyDescriptor | undefined>(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
descriptors.set("IS_REACT_ACT_ENVIRONMENT", Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT"));
for (const key of globals) Object.defineProperty(globalThis, key, { value: key === "window" ? dom.window : dom.window[key], configurable: true });
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
const { CrmConfigurationApiClient } = await import("@/platform/api/generated/crmConfigurationApi");
const { FetchHttpClient } = await import("@/platform/api/client/FetchHttpClient");
const { ApiClientError } = await import("@/platform/api/errors/ApiClientError");
const { DealPipelineHttpAdapter } = await import("@/modules/deals/infrastructure/http/DealPipelineHttpAdapter");
const { mapDealReadModel } = await import("@/modules/deals/infrastructure/http/DealApiMapper");
const { getNextStage, getStageLabel } = await import("@/modules/deals/domain/rules/dealStages");
const { dealPipelinePresentation, dealStageChoices } = await import("@/modules/deals/presentation/views/dealDetailPresentation");
const { getDealPipelineHealth } = await import("@/modules/deals/domain/rules/dealPipelineHealth");
const { validateDealProgressiveProfile } = await import("@/modules/deals/domain/rules/dealProgressiveProfile");

const timestamp = "2026-10-23T10:00:00Z";
const longLabel = "Solution review with the regional decision makers and commercial stakeholders";
function stage(input: Pick<DealPipelineStageDocument, "id" | "code" | "order"> & Partial<DealPipelineStageDocument>): DealPipelineStageDocument {
  return {
    labelVi: input.code, labelEn: input.code, category: "OPEN", defaultProbability: 43,
    color: "teal", isActive: true, isSystem: false, forecastFloor: "PIPELINE",
    requiresPositiveAmount: false, ...input,
  };
}
const document: DealPipelineDocument = {
  id: "pipeline-consulting", workspaceId: "workspace-alpha", nameVi: "Tư vấn", nameEn: "Consulting",
  description: "Administrator configured pipeline", isActive: true, isDefault: false,
  resourceVersion: 12, createdAt: timestamp, updatedAt: timestamp, updatedBy: "member-admin",
  stages: [
    stage({ id: "stage-unused", code: "DORMANT", order: 3, isActive: false }),
    stage({ id: "stage-new", code: "NEW", order: 5, isActive: false }),
    stage({ id: "stage-assessment", code: "ASSESSMENT", order: 7 }),
    stage({ id: "stage-review", code: "SOLUTION_REVIEW", order: 80, labelEn: longLabel, forecastFloor: "COMMIT", requiresPositiveAmount: true }),
    stage({ id: "stage-won", code: "WON", order: 90, category: "WON", labelEn: "Signed and accepted", color: "green", isSystem: true, defaultProbability: 100 }),
    stage({ id: "stage-lost", code: "LOST", order: 100, category: "LOST", labelEn: "Closed without agreement", color: "red", isSystem: true, defaultProbability: 0 }),
  ],
};

const requests: Array<{ url: string; init: RequestInit; headers: Headers }> = [];
let reply: unknown = { items: [document] };
let status = 200;
const fetchImplementation: typeof fetch = async (input, init = {}) => {
  requests.push({ url: String(input), init, headers: new Headers(init.headers) });
  return new Response(JSON.stringify(reply), { status, headers: { "Content-Type": "application/json" } });
};
const client = new FetchHttpClient({
  baseUrl: "https://crm.example.test/v1",
  accessTokenProvider: { getAccessToken: () => "test-token" },
  workspaceIdProvider: { getWorkspaceId: () => "workspace-alpha" },
  requestIdProvider: { createRequestId: () => "request-pipelines" },
  correlationIdProvider: { createCorrelationId: () => "correlation-pipelines" },
  retryPolicy: { maxAttempts: 1 }, fetchImplementation,
});
const adapter = new DealPipelineHttpAdapter(new CrmConfigurationApiClient(client));
const abort = new AbortController();
const pipelines = await adapter.list(abort.signal);
assert.equal(pipelines.length, 1);
const pipeline = pipelines[0];
assert.ok(pipeline);
const getRequest = requests[0];
assert.ok(getRequest);
assert.equal(getRequest.url, "https://crm.example.test/v1/crm-configuration/pipelines");
assert.equal(getRequest.init.method, "GET");
assert.equal(getRequest.headers.get("X-Workspace-Id"), "workspace-alpha");
assert.equal(getRequest.headers.get("Authorization"), "Bearer test-token");
assert.equal(getRequest.headers.get("X-Request-Id"), "request-pipelines");
assert.equal(getRequest.headers.get("If-Match"), null);
assert.equal(pipeline.workspaceId, "workspace-alpha");
assert.equal(pipeline.version, 12);
// NEW is a legitimate configured code here, not the browser snapshot alias DISCOVERY.
assert.deepEqual(pipeline.stages.map(value => [value.id, value.code, value.order]), document.stages.map(value => [value.id, value.code, value.order]));
assert.equal(pipeline.stages.length, 6, "connected reads must not append canonical defaults");
assert.equal(pipeline.stages.find(value => value.code === "SOLUTION_REVIEW")?.forecastFloor, "COMMIT");
assert.equal(pipeline.stages.find(value => value.code === "SOLUTION_REVIEW")?.requiresPositiveAmount, true);
assert.equal(pipeline.stages.find(value => value.code === "NEW")?.isActive, false);
assert.equal(getStageLabel("WON", pipeline.stages, "en"), "Signed and accepted");
assert.equal(getStageLabel("SOLUTION_REVIEW", pipeline.stages, "en"), longLabel);

const expectedBody = {
  nameVi: "Tư vấn", nameEn: "Consulting", description: "Administrator configured pipeline",
  isActive: true, isDefault: false,
  stages: document.stages.map(value => ({
    id: value.id, code: value.code, labelVi: value.labelVi, labelEn: value.labelEn,
    order: value.order, category: value.category, defaultProbability: value.defaultProbability,
    color: value.color, isActive: value.isActive,
  })),
};
reply = { outcome: "COMMITTED", pipeline: { ...document, id: "pipeline-created", resourceVersion: 1 }, auditEvidenceIds: ["audit-create"] };
status = 201;
const created = await adapter.save({ ...pipeline, id: "local-draft", name: { vi: " Tư vấn ", en: " Consulting " } }, { idempotencyKey: "pipeline-create-key", signal: abort.signal });
assert.equal(created.pipeline.id, "pipeline-created", "creation must project the server assigned identity");
assert.equal(created.pipeline.version, 1);
assert.equal(created.outcome, "COMMITTED");
assert.deepEqual(created.auditEvidenceIds, ["audit-create"]);
const postRequest = requests[1];
assert.ok(postRequest);
assert.equal(postRequest.init.method, "POST");
assert.equal(postRequest.url, "https://crm.example.test/v1/crm-configuration/pipelines");
assert.equal(postRequest.headers.get("Idempotency-Key"), "pipeline-create-key");
assert.equal(postRequest.headers.get("If-Match"), null);
assert.deepEqual(JSON.parse(String(postRequest.init.body)), expectedBody);

reply = { outcome: "REPLAYED", pipeline: { ...document, resourceVersion: 13, nameEn: "Committed consulting" }, auditEvidenceIds: ["audit-update"] };
status = 200;
const updated = await adapter.save(pipeline, { expectedVersion: 12, idempotencyKey: "pipeline-update-key", signal: abort.signal });
assert.equal(updated.pipeline.version, 13);
assert.equal(updated.pipeline.name.en, "Committed consulting", "mutation results must come from the committed server document");
assert.equal(updated.outcome, "REPLAYED");
assert.deepEqual(updated.auditEvidenceIds, ["audit-update"]);
assert.equal(pipeline.version, 12, "saving must not increment the submitted version in place");
const patchRequest = requests[2];
assert.ok(patchRequest);
assert.equal(patchRequest.init.method, "PATCH");
assert.equal(patchRequest.url, "https://crm.example.test/v1/crm-configuration/pipelines/pipeline-consulting");
assert.equal(patchRequest.headers.get("Idempotency-Key"), "pipeline-update-key");
assert.equal(patchRequest.headers.get("If-Match"), '"12"');
assert.deepEqual(JSON.parse(String(patchRequest.init.body)), expectedBody);

// Partial server definitions must fail transport validation, never synthesize missing labels/stages.
reply = { items: [{ ...document, stages: [{ id: "partial", code: "NEW" }] }] };
await assert.rejects(() => adapter.list(), error => error instanceof ApiClientError && error.code === "CONTRACT_VIOLATION");
reply = { type: "about:blank", title: "Version conflict", status: 409, code: "VERSION_CONFLICT", retryable: false, correlationId: "correlation-conflict", currentVersion: 14 };
status = 409;
await assert.rejects(() => adapter.save(pipeline, { expectedVersion: 12, idempotencyKey: "conflict-key" }), error => error instanceof ApiClientError && error.code === "VERSION_CONFLICT" && error.status === 409);
const countBeforeCancelled = requests.length;
abort.abort();
await assert.rejects(() => adapter.list(abort.signal), error => error instanceof ApiClientError && error.code === "REQUEST_CANCELLED");
assert.equal(requests.length, countBeforeCancelled, "cancelled reads must not issue another request");

const dealRecord: DealReadModel = {
  id: "deal-custom", name: "Custom pipeline opportunity", buyerRef: { type: "ORGANIZATION_ACCOUNT", id: "buyer-alpha" },
  pipelineId: document.id, stageCode: "NEW", stageCategory: "OPEN", amount: { amount: "1250000.25", currency: "VND" },
  opportunityScore: "17.5", ownerId: "member-owner", expectedCloseDate: "2026-11-01",
  interestedProductIds: [], lineItems: [], resourceVersion: 28, createdAt: timestamp, updatedAt: timestamp,
  forecastCategory: "COMMIT",
};
const deal = mapDealReadModel(dealRecord);
assert.equal(deal.pipelineId, document.id);
assert.equal(deal.stageCategory, "OPEN");
assert.equal(deal.stage, "NEW", "read mapping must preserve configured codes without legacy alias repair");
assert.equal(deal.resourceVersion, 28, "Deal and pipeline versions are independent");
assert.equal(deal.opportunityScore, 17.5, "stage probability must not replace Opportunity Score");
assert.equal(deal.forecastCategory, "COMMIT");
assert.equal(deal.amountDecimal, "1250000.25");
assert.deepEqual(dealStageChoices(deal, pipeline.stages, true).map(value => value.code), ["ASSESSMENT", "SOLUTION_REVIEW"]);
assert.deepEqual(dealStageChoices({ ...deal, archivedAt: timestamp }, pipeline.stages, true), []);
assert.equal(getNextStage("ASSESSMENT", pipeline.stages), "SOLUTION_REVIEW");
assert.equal(getNextStage("SOLUTION_REVIEW", pipeline.stages), null, "terminal outcomes require explicit lifecycle commands");
const progress = dealPipelinePresentation(deal, pipeline.stages);
assert.deepEqual(progress.stages.map(value => value.code), ["NEW", "ASSESSMENT", "SOLUTION_REVIEW"]);
assert.equal(progress.stages[0]?.current, true, "V5 progress must retain the current inactive stage");
assert.equal(progress.stages[0]?.isActive, false);
assert.equal(progress.stages[2]?.labelEn, longLabel);
assert.equal(progress.stages.some(value => value.visited), false, "earlier position is not stage visit evidence");
const won = mapDealReadModel({ ...dealRecord, stageCode: "WON", stageCategory: "WON" });
assert.equal(won.stageCategory, "WON");
assert.equal(dealPipelinePresentation(won, []).terminal, "won", "outcome remains readable before configuration loads");
assert.deepEqual(dealStageChoices(won, pipeline.stages, true), []);
const noForecast = { ...deal, stage: "NEGOTIATION", opportunityScore: 99, forecastCategory: undefined };
assert.equal(getDealPipelineHealth(noForecast, new Date(timestamp), { deriveMissingForecast: false }).forecastCategory, undefined);
assert.equal(getDealPipelineHealth(noForecast, new Date(timestamp)).forecastCategory, "COMMIT", "demo fallback remains available explicitly");
const policy = { ...pipeline.stages[0], code: "PROPOSAL", requiresPositiveAmount: false };
assert.deepEqual(validateDealProgressiveProfile({ ...deal, amount: 0, forecastCategory: undefined }, "PROPOSAL", "COMPLETE", policy), []);
assert.deepEqual(validateDealProgressiveProfile({ ...deal, amount: 0, forecastCategory: undefined }, "PROPOSAL", "COMPLETE", { ...policy, requiresPositiveAmount: true }), ["amount", "forecastCategory"]);
// Exercise the shared projection resource with a gateway that deliberately ignores cancellation.
// Request retirement must be enforced by the application boundary as well as the transport.
const { signIn, signOut } = await import("@/platform/identity-auth");
const { getWorkspaceContextSnapshot } = await import("@/platform/workspace-context");
const { configureDealApplication, resetDealApplication } = await import("@/modules/deals/application/composition/dealApplicationServices");
const { createDealConnectedApiRuntime } = await import("@/modules/deals/infrastructure/http/createDealConnectedApiRuntime");
const { getDealPipelineResource, resetDealPipelineScope, saveDealPipelineCommand } = await import("@/modules/deals/public/dealPipelines");
const { subscribeModuleQueryInvalidation } = await import("@/shared/application/data-authority/moduleQueryInvalidation");
type Pipeline = typeof pipeline;
const reads: Array<{ signal: AbortSignal | undefined; resolve(value: Pipeline[]): void; reject(error: Error): void }> = [];
let projection: Pipeline[] = [];
let committedPipeline: Pipeline = pipeline;
const mutationCalls: Array<{ version: number | undefined; key: string }> = [];
assert.equal(signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok, true);
configureDealApplication({
  api: createDealConnectedApiRuntime(client),
  pipelines: {
    list: signal => new Promise((resolve, reject) => reads.push({ signal, resolve, reject })),
    save: async (_input, options) => {
      mutationCalls.push({ version: options.expectedVersion, key: options.idempotencyKey });
      return { pipeline: committedPipeline, outcome: "COMMITTED", auditEvidenceIds: ["audit-committed"] };
    },
  },
  repository: { list: () => [], getById: () => undefined, replace: () => [], subscribe: () => () => {} },
  stages: {
    list: () => projection[0]?.stages ?? [], replace: () => {}, reset: () => [], subscribe: () => () => {},
    listPipelines: () => projection,
    replacePipelines: values => { projection = values; return projection; },
  },
  exporter: { exportCsv: () => {} },
});
const resource = getDealPipelineResource();
let invalidations = 0;
const unsubscribe = subscribeModuleQueryInvalidation("deals", () => { invalidations += 1; });
try {
  resetDealPipelineScope();
  const workspaceId = getWorkspaceContextSnapshot().workspaceId;
  const currentPipeline = { ...pipeline, workspaceId, version: 20 };
  const obsoleteLoad = resource.refresh();
  const obsoleteRead = reads.shift();
  assert.ok(obsoleteRead);
  const currentLoad = resource.refresh();
  const currentRead = reads.shift();
  assert.ok(currentRead);
  assert.equal(obsoleteRead.signal?.aborted, true);
  currentRead.resolve([currentPipeline]);
  await currentLoad;
  obsoleteRead.resolve([{ ...currentPipeline, version: 19 }]);
  assert.equal(await obsoleteLoad, undefined);
  assert.equal(resource.getSnapshot().data?.[0]?.version, 20);
  assert.equal(projection[0]?.version, 20, "retired read must not overwrite the committed projection");

  const cancelledLoad = resource.refresh();
  const cancelledRead = reads.shift();
  assert.ok(cancelledRead);
  resource.reset();
  assert.equal(cancelledRead.signal?.aborted, true);
  cancelledRead.resolve([{ ...currentPipeline, version: 21 }]);
  assert.equal(await cancelledLoad, undefined);
  assert.equal(resource.getSnapshot().state, "IDLE");
  assert.equal(projection[0]?.version, 20, "reset must suppress delayed projection writes");

  const wrongWorkspaceLoad = resource.refresh();
  const wrongWorkspaceRead = reads.shift();
  assert.ok(wrongWorkspaceRead);
  wrongWorkspaceRead.resolve([{ ...currentPipeline, workspaceId: "workspace-foreign" }]);
  assert.equal(await wrongWorkspaceLoad, undefined);
  assert.equal(resource.getSnapshot().error?.code, "PIPELINE_WORKSPACE_MISMATCH");
  assert.equal(resource.getSnapshot().data, undefined);
  assert.equal(projection[0]?.workspaceId, workspaceId, "foreign workspace data must not reach projection");

  committedPipeline = { ...currentPipeline, version: 21 };
  const committedSave = saveDealPipelineCommand(currentPipeline, { expectedVersion: 20, idempotencyKey: "public-save-key" });
  // The save gateway resolves in a microtask before the postcommit read begins.
  await Promise.resolve();
  const postcommitRead = reads.shift();
  assert.ok(postcommitRead);
  postcommitRead.reject(new Error("Read temporarily unavailable"));
  const outcome = await committedSave;
  assert.equal(outcome.outcome, "COMMITTED");
  assert.equal(outcome.data?.version, 21);
  assert.deepEqual(outcome.audit.evidenceIds, ["audit-committed"]);
  assert.ok(outcome.warnings?.includes("PIPELINE_REFRESH_REQUIRED"));
  assert.equal(invalidations, 1, "committed configuration must invalidate Deals even when its reload fails");
  assert.deepEqual(mutationCalls, [{ version: 20, key: "public-save-key" }]);

  // Mount the actual Studio controller while the authoritative pipeline read is deferred.
  // A permitted administrator must still wait for a confirmed default before creating a draft.
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { I18nProvider } = await import("@/i18n");
  const { usePipelinesStatusesController } = await import("@/workspaces/studio/presentation/hooks/usePipelinesStatusesController");
  let hook: ReturnType<typeof usePipelinesStatusesController> | undefined;
  const readHook = () => { assert.ok(hook); return hook; };
  function ControllerProbe() { hook = usePipelinesStatusesController(); return null; }
  const element = dom.window.document.getElementById("pipeline-hook-root");
  assert.ok(element);
  const root = createRoot(element);
  resource.reset();
  projection = [];
  try {
    await React.act(async () => { root.render(React.createElement(I18nProvider, null, React.createElement(ControllerProbe))); });
    const initialRead = reads.shift();
    assert.ok(initialRead, "mounted controller must load the pipeline registry");
    assert.equal(readHook().canConfigure, false, "permissions alone do not authorize edits before authoritative readiness");
    assert.equal(readHook().canSave, false);
    await React.act(async () => { readHook().addPipeline(); });
    assert.deepEqual(readHook().draft, [], "programmatic Add must also reject the hydration interval");
    const defaultPipeline = { ...currentPipeline, isDefault: true, active: true };
    await React.act(async () => { initialRead.resolve([defaultPipeline]); await Promise.resolve(); });
    assert.equal(readHook().canConfigure, true);
    assert.equal(readHook().canSave, true);
    assert.equal(readHook().source.filter(value => value.isDefault).length, 1);
    await React.act(async () => { readHook().addPipeline(); });
    assert.equal(readHook().draft.length, 2);
    assert.equal(readHook().selected?.isDefault, false, "connected drafts never promote themselves to default");
    assert.equal(readHook().source.find(value => value.id === defaultPipeline.id)?.isDefault, true);
    assert.equal(readHook().draft.find(value => value.id === defaultPipeline.id)?.isDefault, true);
    assert.equal(mutationCalls.length, 1, "draft creation must not mutate the server");
  } finally {
    await React.act(async () => { root.unmount(); });
    dom.window.close();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
} finally {
  unsubscribe();
  resource.reset();
  resetDealApplication();
  signOut();
}
console.log("PASS Deal pipeline HTTP authority, custom stage presentation, projection races and committed refresh failure");

await import("../../contract/deal-workspace-pipeline-selection.test.mts");
