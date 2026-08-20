import assert from "node:assert/strict";
import fs from "node:fs";

const openapi = JSON.parse(fs.readFileSync("docs/api/openapi.json", "utf8"));
const commands = JSON.parse(fs.readFileSync("docs/backend-readiness/command-registry.json", "utf8")).commands;
const workflows = JSON.parse(fs.readFileSync("docs/backend-readiness/workflow-ownership.json", "utf8")).workflows;

const requiredOperations = [
  "archiveLead",
  "archiveLeadBatch",
  "anonymizeLead",
  "recordLeadConsent",
  "mergeLeadDuplicates",
  "confirmLeadDuplicatesDistinct",
  "assignLeadOwner",
  "importLeadBatch",
  "handoverLeadWithTasks",
  "advanceLeadWorkStateBatch",
  "assignLeadOwnerBatch",
  "disqualifyLeadBatch",
  "applyLeadTagBatch",
  "scheduleLeadFollowUpBatch",
  "claimLeadFromQueue",
  "requestLeadExport",
];
const operationById = new Map<string, Record<string, unknown>>();
for (const pathItem of Object.values(openapi.paths) as Array<Record<string, unknown>>) {
  for (const operation of Object.values(pathItem) as Array<Record<string, unknown>>) {
    if (typeof operation?.operationId === "string") operationById.set(operation.operationId, operation);
  }
}
for (const operationId of requiredOperations) {
  const operation = operationById.get(operationId);
  assert.ok(operation, `Missing Lead completion operation ${operationId}`);
  assert.equal(operation?.["x-contract-status"], "PRODUCTION_CONTRACT_READY", `${operationId} must be production-ready`);
  assert.equal(operation?.["x-idempotency-policy"], "REQUIRED", `${operationId} must require idempotency`);
  assert.ok(Array.isArray(operation?.["x-error-codes"]), `${operationId} must declare stable errors`);
}
assert.equal(operationById.get("qualifyLead")?.["x-contract-status"], "BLOCKED", "Retired generic qualification must remain blocked");

const commandByOperation = new Map<string, Record<string, unknown>>(commands.filter((command: Record<string, unknown>) => command.openApiOperationId).map((command: Record<string, unknown>) => [String(command.openApiOperationId), command]));
for (const operationId of requiredOperations) {
  assert.equal(commandByOperation.get(operationId)?.status, "PRODUCTION_CONTRACT_READY", `${operationId} must have a ready command-registry owner`);
}
assert.equal(commands.find((command: Record<string, unknown>) => command.commandType === "lead.close-with-outcome")?.status, "DEPRECATED");
assert.equal(commands.find((command: Record<string, unknown>) => command.commandType === "lead.start-verification")?.status, "DEPRECATED");

const handoverWorkflow = workflows.find((workflow: Record<string, unknown>) => workflow.name === "lead-handover");
assert.equal(handoverWorkflow?.ownershipDecision, "SINGLE_BACKEND_TRANSACTION");
assert.equal(handoverWorkflow?.connectedFrontendCoordinatorAllowed, false);
const identityWorkflow = workflows.find((workflow: Record<string, unknown>) => workflow.name === "lead-identity-resolution");
assert.equal(identityWorkflow?.ownershipDecision, "SINGLE_BACKEND_TRANSACTION");
assert.equal(identityWorkflow?.connectedFrontendCoordinatorAllowed, false);
const followUpWorkflow = workflows.find((workflow: Record<string, unknown>) => workflow.name === "lead-follow-up");
assert.equal(followUpWorkflow?.ownershipDecision, "SINGLE_BACKEND_TRANSACTION");
assert.equal(followUpWorkflow?.connectedFrontendCoordinatorAllowed, false);
const queueClaimWorkflow = workflows.find((workflow: Record<string, unknown>) => workflow.name === "lead-queue-claim");
assert.equal(queueClaimWorkflow?.ownershipDecision, "SINGLE_BACKEND_TRANSACTION");
assert.equal(queueClaimWorkflow?.connectedFrontendCoordinatorAllowed, false);

const adapter = fs.readFileSync("src/modules/leads/infrastructure/http/LeadHttpCommandAdapter.ts", "utf8");
for (const method of requiredOperations) assert.match(adapter, new RegExp(`async ${method}\\(`), `Lead adapter must own ${method}`);
assert.doesNotMatch(adapter, /Date\.now\(|new Date\(/u, "Connected Lead adapter must not fabricate server time or IDs");

const actionHook = fs.readFileSync("src/modules/leads/presentation/hooks/useLeadActions.ts", "utf8");
assert.doesNotMatch(actionHook, /(?:updateLeadSnapshot|updateManyLeadsSnapshot|reassignLeadSnapshot|appendLeadActivitySnapshot|importLeadCsvPlanSnapshot|replaceLeadsViaTransformViaApi)/u);
for (const command of ["applyTagMany", "scheduleFollowUpMany", "disqualifyMany", "reassignMany", "claimFromQueue"]) {
  assert.match(actionHook, new RegExp(`${command}:`), `Lead action hook must expose ${command}`);
}
const listPage = fs.readFileSync("src/modules/leads/presentation/pages/LeadListPage.tsx", "utf8");
for (const command of ["scheduleFollowUpMany", "reassignMany", "applyTagMany", "disqualifyMany"]) {
  assert.match(listPage, new RegExp(`leadActions\.${command}`), `Lead list must use authoritative ${command}`);
}
assert.doesNotMatch(listPage, /Promise\.all\([^)]*(?:replaceLead|assignLeadOwner|disqualifyLead)/u, "Lead bulk actions must not coordinate partial commits in presentation");
const queuePage = fs.readFileSync("src/modules/leads/presentation/pages/LeadQueuePage.tsx", "utf8");
assert.match(queuePage, /leadActions\.claimFromQueue/u);
const importExport = fs.readFileSync("src/modules/leads/presentation/hooks/useLeadImportExport.ts", "utf8");
assert.match(importExport, /requestLeadExportViaApi/u);
assert.doesNotMatch(importExport, /JSON\.stringify|toCsv|exportLeadsSnapshot/u, "Connected export must consume an authoritative backend artifact");
const controller = fs.readFileSync("src/modules/leads/presentation/hooks/useLeadDetailController.tsx", "utf8");
assert.doesNotMatch(controller, /(?:createTaskSnapshot|reassignTaskSnapshot|completeTaskSnapshot)/u);
assert.match(controller, /handoverLeadWithTasksViaApi|leadActions\.handover/u);

const publicApi = fs.readFileSync("src/modules/leads/public/leads.ts", "utf8");
assert.match(publicApi, /function assertLocalLeadMutationAllowed[\s\S]*LEAD_LOCAL_MUTATION_FORBIDDEN/u);
for (const localMutation of ["updateLeadSnapshot", "updateManyLeadsSnapshot", "appendLeadActivitySnapshot", "reassignLeadSnapshot", "importLeadCsvPlanSnapshot", "closeLeadSnapshot", "exportLeadsSnapshot"]) {
  const start = publicApi.indexOf(`export function ${localMutation}`);
  assert.ok(start >= 0, `Missing compatibility local function ${localMutation}`);
  assert.match(publicApi.slice(start, start + 400), /assertLocalLeadMutationAllowed/u, `${localMutation} must fail closed in connected mode`);
}

const scenarios = JSON.parse(fs.readFileSync("tests/fixtures/backend-contract/lead-completion/provider-scenarios.json", "utf8"));
assert.ok(scenarios.scenarios.length >= 68, "Lead completion provider pack must cover success, replay and negative cases");
for (const operationId of requiredOperations) {
  assert.ok(scenarios.scenarios.some((scenario: Record<string, unknown>) => scenario.operationId === operationId), `Provider pack must cover ${operationId}`);
}

console.log(`[lead-completion-api-boundary] PASS (${requiredOperations.length} operations; ${scenarios.scenarios.length} provider scenarios)`);
