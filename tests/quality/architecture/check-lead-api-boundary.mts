import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { createLeadConnectedApiRuntime } from "../../../src/modules/leads/infrastructure/http/createLeadConnectedApiRuntime.ts";
import { createLeadModuleDataAuthorityBridge } from "../../../src/modules/leads/infrastructure/http/LeadModuleDataAuthorityBridge.ts";
import type { HttpClient, HttpRequest } from "../../../src/platform/api/client/HttpClient.ts";
import { isLeadOperationAvailable, LEAD_OPERATION } from "../../../src/modules/leads/application/leadOperationAvailability.ts";
import { InMemoryLeadRepository } from "../../../src/modules/leads/infrastructure/InMemoryLeadRepository.ts";
import { saveLead } from "../../../src/modules/leads/application/commands/leadRepositoryCommands.ts";
import { runBackendProjection } from "../../../src/shared/application/index.ts";
import { BrowserEventBus } from "../../../src/platform/events/index.ts";
import { LeadWorkState } from "../../../src/modules/leads/domain/model/leadLifecycle.canonical.ts";

const root = repositoryRoot;
const requiredFiles = [
  "src/modules/leads/application/ports/LeadApiRuntime.ts",
  "src/modules/leads/application/commands/leadApiCommands.ts",
  "src/modules/leads/application/leadOperationAvailability.ts",
  "src/modules/leads/infrastructure/http/LeadApiMapper.ts",
  "src/modules/leads/infrastructure/http/LeadHttpQueryAdapter.ts",
  "src/modules/leads/infrastructure/http/LeadHttpCommandAdapter.ts",
  "src/modules/leads/infrastructure/http/LeadHttpApiAdapter.ts",
  "src/modules/leads/infrastructure/http/createLeadConnectedApiRuntime.ts",
  "src/modules/leads/infrastructure/http/LeadModuleDataAuthorityBridge.ts",
  "src/modules/leads/runtime/createLeadDemoApiRuntime.ts",
  "src/modules/leads/runtime/createLeadTestApiRuntime.ts",
  "src/modules/leads/presentation/hooks/useLeadServerPagedCollection.ts",
  "src/modules/leads/presentation/hooks/useLeadAuthoritativeResource.ts",
];
for (const relative of requiredFiles) assert.ok(fs.existsSync(path.join(root, relative)), `Missing Lead API boundary artifact: ${relative}`);
assert.equal(fs.existsSync(path.join(root, "src/modules/leads/infrastructure/openapi/leadReadModelMapper.ts")), false);

const leadRoot = path.join(root, "src/modules/leads");
const leadSourceFiles = walkAllFiles(leadRoot).filter((file) => /\.(?:ts|tsx)$/u.test(file));
const forbidden: string[] = [];
for (const file of leadSourceFiles) {
  const relative = toPosix(path.relative(root, file));
  const source = fs.readFileSync(file, "utf8");
  const restricted = /\/modules\/leads\/(?:application|domain|presentation|public)\//u.test(`/${relative}`) || relative === "src/modules/leads/index.ts";
  if (restricted && /@\/platform\/api/u.test(source)) forbidden.push(`${relative}: restricted Lead layer imports platform API.`);
  if (restricted && /HttpModuleDataAuthority|RoutedHttpMutationAuthority|getModuleDataAuthority|useServerPagedModuleCollection|useModuleAuthoritativeResource/u.test(source)) forbidden.push(`${relative}: restricted Lead layer uses generic API authority.`);
}
assert.deepEqual(forbidden, [], `Lead API boundary violations:\n${forbidden.join("\n")}`);

const listPage = read("src/modules/leads/presentation/pages/LeadListPage.tsx");
assert.match(listPage, /useLeadServerPagedCollection/u);
assert.doesNotMatch(listPage, /useServerPagedModuleCollection/u);
const detailController = read("src/modules/leads/presentation/hooks/useLeadDetailController.tsx");
assert.match(detailController, /await leadActions\.replaceProfileFromForm/u);
assert.doesNotMatch(detailController, /RoutedHttpMutationAuthority|fetch\(/u);
const authoritativeQueries = read("src/modules/leads/application/vertical-slice/leadAuthoritativeQueries.ts");
assert.match(authoritativeQueries, /getLeadApiRuntime\(\)\.queries/u);
assert.doesNotMatch(authoritativeQueries, /createModuleCollectionResource|getModuleDataAuthority/u);

const ownership = JSON.parse(read("scripts/api/openapi/client-ownership.json"));
const commercial = ownership.clients.find((client: { id: string }) => client.id === "commercial");
assert.equal(commercial.adapterByTag.Leads, "src/modules/leads/infrastructure/http/LeadHttpApiAdapter.ts");
const generatedCommandRegistry = read("src/platform/api/contracts/generatedProductionCommandRegistry.ts");
assert.doesNotMatch(generatedCommandRegistry, /"lead\.(?:create|update|change-work-state|disqualify|reopen)"/u, "Dedicated Lead commands must not enter the generic mutation router.");
const leadPublicBoundary = read("src/modules/leads/public/leads.ts");
for (const command of [
  "advanceLeadWorkStateBatchViaApi",
  "assignLeadOwnerBatchViaApi",
  "disqualifyLeadBatchViaApi",
  "applyLeadTagBatchViaApi",
  "scheduleLeadFollowUpBatchViaApi",
  "claimLeadFromQueueViaApi",
  "requestLeadExportViaApi",
]) {
  assert.match(leadPublicBoundary, new RegExp(command), `Lead public boundary must export ${command}`);
}
assert.match(leadPublicBoundary, /LEAD_LOCAL_MUTATION_FORBIDDEN/u, "Compatibility snapshot writes must remain fail-closed in connected mode.");

const requests: HttpRequest[] = [];
const baseDocument = {
  id: "lead-1",
  displayName: "Lead One",
  email: "lead@example.test",
  estimatedValue: { amount: "1200000.00", currency: "VND" },
  version: 3,
  createdAt: "2026-07-25T00:00:00.000Z",
  updatedAt: "2026-07-25T00:00:00.000Z",
  leadWorkState: "NEW",
  source: "WEB",
  score: 10,
  ownerId: "user-1",
  interestedProducts: [],
  activityProjection: "NOT_INCLUDED",
};
const client: HttpClient = {
  async request<TResponse, TBody = unknown>(input: HttpRequest<TBody>): Promise<TResponse> {
    requests.push(input as HttpRequest);
    if (input.operationId === "listLeads") return {
      items: [baseDocument],
      pageInfo: { hasNextPage: true, nextCursor: "lead-cursor-2", totalCount: 51 },
    } as TResponse;
    if (input.operationId === "getLead") return baseDocument as TResponse;
    if (input.operationId === "createLead") return mutationResponse(baseDocument, 3, "cmd-create") as TResponse;
    if (input.operationId === "replaceLeadProfile") {
      const replaced = { ...baseDocument, displayName: "Lead Updated", version: 4, updatedAt: "2026-07-25T01:00:00.000Z" };
      return mutationResponse(replaced, 4, "cmd-replace") as TResponse;
    }
    if (input.operationId === "advanceLeadWorkState") {
      const advanced = { ...baseDocument, leadWorkState: "CONTACTING", version: 4, updatedAt: "2026-07-25T02:00:00.000Z" };
      return mutationResponse(advanced, 4, "cmd-advance") as TResponse;
    }
    if (input.operationId === "disqualifyLead") {
      const disqualified = { ...baseDocument, leadWorkState: "CLOSED", qualificationOutcome: "DISQUALIFIED", version: 4, updatedAt: "2026-07-25T03:00:00.000Z" };
      return mutationResponse(disqualified, 4, "cmd-disqualify") as TResponse;
    }
    if (input.operationId === "reopenDisqualifiedLead") {
      const reopened = { ...baseDocument, leadWorkState: "CONTACTING", version: 5, updatedAt: "2026-07-25T04:00:00.000Z" };
      return mutationResponse(reopened, 5, "cmd-reopen") as TResponse;
    }
    if (input.operationId === "archiveLead") {
      const archived = { ...baseDocument, archivedAt: "2026-07-25T05:00:00.000Z", archiveReason: "Duplicate intake", version: 4, updatedAt: "2026-07-25T05:00:00.000Z" };
      return mutationResponse(archived, 4, "cmd-archive") as TResponse;
    }
    if (input.operationId === "archiveLeadBatch") {
      const leads = [
        { ...baseDocument, archivedAt: "2026-07-25T06:00:00.000Z", archiveReason: "Campaign complete", version: 4, updatedAt: "2026-07-25T06:00:00.000Z" },
        { ...baseDocument, id: "lead-2", displayName: "Lead Two", archivedAt: "2026-07-25T06:00:00.000Z", archiveReason: "Campaign complete", version: 8, updatedAt: "2026-07-25T06:00:00.000Z" },
      ];
      return { commandId: "cmd-archive-batch", correlationId: "corr-archive-batch", aggregateId: "lead-batch-1", aggregateType: "LEAD", version: 8, occurredAt: "2026-07-25T06:00:00.000Z", outcome: "COMMITTED", warnings: [], emittedEventIds: ["event-archive-batch"], auditEvidenceIds: ["audit-1", "audit-2"], result: { leads } } as TResponse;
    }
    throw new Error(`Unexpected operation: ${input.operationId}`);
  },
};

const runtime = createLeadConnectedApiRuntime(client);
assert.equal(runtime.mode, "connected");
assert.equal(isLeadOperationAvailable(LEAD_OPERATION.ARCHIVE), true);
assert.equal(isLeadOperationAvailable(LEAD_OPERATION.ARCHIVE_BATCH), true);
for (const unavailable of [LEAD_OPERATION.ASSIGN_OWNER_BATCH, LEAD_OPERATION.IMPORT_BATCH, LEAD_OPERATION.REQUEST_EXPORT]) {
  assert.equal(isLeadOperationAvailable(unavailable), false, `${unavailable} must be hidden independently of permission in connected mode.`);
}
const leadPage = await runtime.queries.list({ limit: 25, search: "Lead One", filters: { workState: "NEW", ownerId: "user-1" } });
assert.equal(leadPage.items[0]?.id, "lead-1");
assert.equal(leadPage.pageInfo.hasNextPage, true);
assert.equal(leadPage.pageInfo.nextCursor, "lead-cursor-2");
assert.equal(leadPage.pageInfo.totalCount, 51);
assert.deepEqual(requests[0]?.query, { cursor: undefined, limit: 25, search: "Lead One", workState: "NEW", ownerId: "user-1" });
assert.equal((await runtime.queries.get("lead-1")).resourceVersion, 3);
await assert.rejects(() => runtime.queries.list({ sortBy: "unsupported" }), (error: unknown) => hasCode(error, "CONNECTED_QUERY_CONTRACT_VIOLATION"));

const minimalProfile = {
  displayName: " Lead One ",
  phone: " 0901234567 ",
};
const profile = {
  displayName: " Lead One ",
  email: " lead@example.test ",
  source: " WEB ",
  ownerId: " user-1 ",
  estimatedValue: { amount: "1200000", currency: "vnd" },
  tags: [" priority ", ""],
  customFields: { segment: "enterprise", seats: 20, approved: true, channels: ["email", "phone"] },
};
const created = await runtime.commands.createLead(minimalProfile, { idempotencyKey: "lead-create-attempt-1" });
assert.equal(created.evidence.authority, "backend");
const createRequest = requests.find((request) => request.operationId === "createLead");
assert.deepEqual(createRequest?.body, {
  displayName: "Lead One",
  phone: "0901234567",
});
assert.equal(createRequest?.idempotencyKey, "lead-create-attempt-1");
assert.equal(createRequest?.retry, "idempotent");

const replaced = await runtime.commands.replaceLeadProfile("lead-1", { ...profile, displayName: "Lead Updated" }, { idempotencyKey: "lead-replace-attempt-1", expectedVersion: 3 });
assert.equal(replaced.lead.resourceVersion, 4);
const replaceRequest = requests.find((request) => request.operationId === "replaceLeadProfile");
assert.equal(replaceRequest?.expectedVersion, 3);
assert.equal(replaceRequest?.idempotencyKey, "lead-replace-attempt-1");
assert.equal(replaceRequest?.method, "PUT");


const advanced = await runtime.commands.advanceLeadWorkState("lead-1", { targetWorkState: "CONTACTING" }, { idempotencyKey: "lead-advance-attempt-1", expectedVersion: 3 });
assert.equal(advanced.lead.leadWorkState, "CONTACTING");
const advanceRequest = requests.find((request) => request.operationId === "advanceLeadWorkState");
assert.deepEqual(advanceRequest?.body, { targetWorkState: "CONTACTING" });
assert.equal(advanceRequest?.expectedVersion, 3);

const disqualified = await runtime.commands.disqualifyLead("lead-1", { reason: "No fit", evidence: "Verified by call" }, { idempotencyKey: "lead-disqualify-attempt-1", expectedVersion: 3 });
assert.equal(disqualified.lead.qualificationOutcome, "DISQUALIFIED");
const disqualifyRequest = requests.find((request) => request.operationId === "disqualifyLead");
assert.deepEqual(disqualifyRequest?.body, { reason: "No fit", evidence: "Verified by call" });

const reopened = await runtime.commands.reopenDisqualifiedLead("lead-1", { idempotencyKey: "lead-reopen-attempt-1", expectedVersion: 4 });
assert.equal(reopened.lead.leadWorkState, "CONTACTING");
const reopenRequest = requests.find((request) => request.operationId === "reopenDisqualifiedLead");
assert.deepEqual(reopenRequest?.body, {});
assert.equal(reopenRequest?.expectedVersion, 4);

const archived = await runtime.commands.archiveLead("lead-1", { reason: " Duplicate intake " }, { idempotencyKey: "lead-archive-attempt-1", expectedVersion: 3 });
assert.equal(archived.lead.archivedAt, "2026-07-25T05:00:00.000Z");
assert.equal(archived.lead.archiveReason, "Duplicate intake");
assert.equal(archived.lead.resourceVersion, 4);
const archiveRequest = requests.find((request) => request.operationId === "archiveLead");
assert.equal(archiveRequest?.method, "POST");
assert.equal(archiveRequest?.path, "/leads/lead-1/archive");
assert.equal(archiveRequest?.expectedVersion, 3);
assert.equal(archiveRequest?.idempotencyKey, "lead-archive-attempt-1");
assert.deepEqual(archiveRequest?.body, { reason: "Duplicate intake" });

const archivedBatch = await runtime.commands.archiveLeadBatch({
  items: [{ leadId: "lead-1", expectedVersion: 3 }, { leadId: "lead-2", expectedVersion: 7 }],
  reason: " Campaign complete ",
}, { idempotencyKey: "lead-archive-batch-attempt-1" });
assert.deepEqual(archivedBatch.leads.map((lead) => lead.id), ["lead-1", "lead-2"]);
const archiveBatchRequest = requests.find((request) => request.operationId === "archiveLeadBatch");
assert.equal(archiveBatchRequest?.path, "/leads/archive-batch");
assert.equal(archiveBatchRequest?.idempotencyKey, "lead-archive-batch-attempt-1");
assert.deepEqual(archiveBatchRequest?.body, {
  reason: "Campaign complete",
  items: [{ leadId: "lead-1", expectedVersion: 3 }, { leadId: "lead-2", expectedVersion: 7 }],
});

const cachedLead = {
  id: "lead-projection",
  name: "Projection Lead",
  title: "",
  companyName: "",
  email: "projection@example.test",
  phone: "0901234567",
  source: "WEB",
  score: 0,
  leadWorkState: LeadWorkState.NEW,
  ownerId: "user-1",
  interestedProducts: [],
  createdAt: "2026-07-25T00:00:00.000Z",
  activities: [],
  resourceVersion: 3,
};
const projectionRepository = new InMemoryLeadRepository([cachedLead], new BrowserEventBus());
const committedDisqualification = {
  ...cachedLead,
  leadWorkState: LeadWorkState.CLOSED,
  qualificationOutcome: "DISQUALIFIED" as const,
  resourceVersion: 4,
};
assert.throws(() => saveLead(projectionRepository, committedDisqualification), /Lead lifecycle changes/u);
runBackendProjection("leads", () => saveLead(projectionRepository, committedDisqualification));
assert.equal(projectionRepository.getById(cachedLead.id)?.qualificationOutcome, "DISQUALIFIED");

await assert.rejects(() => runtime.commands.createLead({ displayName: "No contact" }, { idempotencyKey: "key" }), (error: unknown) => hasCode(error, "CONNECTED_CONTRACT_VIOLATION"));
await runtime.commands.replaceLeadProfile("lead-1", profile, { idempotencyKey: "lead-version-zero", expectedVersion: 0 });
await assert.rejects(() => runtime.commands.replaceLeadProfile("lead-1", profile, { idempotencyKey: "key", expectedVersion: -1 }), (error: unknown) => hasCode(error, "CONNECTED_CONTRACT_VIOLATION"));
await assert.rejects(() => runtime.commands.createLead(profile, { idempotencyKey: "" }), (error: unknown) => hasCode(error, "CONNECTED_CONTRACT_VIOLATION"));

const bridge = createLeadModuleDataAuthorityBridge(runtime);
assert.equal((await bridge.queries.get<{ id: string }>("lead-1")).id, "lead-1");
await assert.rejects(() => bridge.commands.execute({ operation: "create", payload: {} }, { idempotencyKey: "key" }), (error: unknown) => hasCode(error, "LEAD_GENERIC_MUTATION_BOUNDARY_BLOCKED"));
console.log(`Lead API boundary: PASS (${requests.length} HTTP requests; dedicated list/detail/profile/lifecycle ports; generic mutation fail-closed).`);

function mutationResponse(result: typeof baseDocument, version: number, commandId: string) {
  return { commandId, correlationId: `corr-${commandId}`, aggregateId: result.id, aggregateType: "Lead", version, occurredAt: result.updatedAt, outcome: "COMMITTED", warnings: [], emittedEventIds: [`event-${commandId}`], auditEvidenceIds: [`audit-${commandId}`], result };
}
function read(relative: string): string { return fs.readFileSync(path.join(root, relative), "utf8"); }
function hasCode(error: unknown, code: string): boolean { return error instanceof Error && "code" in error && (error as Error & { code?: string }).code === code; }
function toPosix(value: string): string { return value.replaceAll(path.sep, "/"); }
