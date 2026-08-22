import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";

const root = repositoryRoot;
const requiredFiles = [
  "src/modules/tasks/application/ports/TaskApiRuntime.ts",
  "src/modules/tasks/application/vertical-slice/taskAuthoritativeQueries.ts",
  "src/modules/tasks/infrastructure/http/TaskApiMapper.ts",
  "src/modules/tasks/infrastructure/http/TaskHttpApiAdapter.ts",
  "src/modules/tasks/infrastructure/http/createTaskConnectedApiRuntime.ts",
  "src/modules/tasks/runtime/createTaskDemoApiRuntime.ts",
  "src/modules/tasks/presentation/hooks/useTasksAuthoritative.ts",
];
for (const file of requiredFiles) assert.ok(existsSync(join(root, file)), `Missing ${file}`);

const openApi = JSON.parse(read("docs/api/openapi.json")) as any;
const requiredOperations = [
  "listTasks",
  "getTask",
  "listActivities",
  "createTask",
  "completeTask",
  "cancelTask",
  "assignTask",
  "rescheduleTask",
  "archiveTask",
  "logActivity",
];
const operations = new Map<string, any>();
for (const pathItem of Object.values(openApi.paths) as any[]) {
  for (const method of ["get", "post", "put", "patch", "delete"]) {
    const operation = pathItem?.[method];
    if (operation?.operationId) operations.set(operation.operationId, operation);
  }
}
for (const operationId of requiredOperations) {
  const operation = operations.get(operationId);
  assert.ok(operation, `Missing ${operationId}`);
  assert.equal(operation["x-contract-status"], "PRODUCTION_CONTRACT_READY", `${operationId} must be ready`);
  assert.equal(operation["x-module-owner"], "tasks", `${operationId} owner drift`);
}

const adapter = read("src/modules/tasks/infrastructure/http/TaskHttpApiAdapter.ts");
for (const operationId of requiredOperations) assert.match(adapter, new RegExp(`\\.${operationId}(?:<|\\()|${operationId}`), `Task adapter must own ${operationId}`);

const ownership = JSON.parse(read("scripts/api/openapi/client-ownership.json"));
const commercial = ownership.clients.find((client: { id: string }) => client.id === "commercial");
assert.equal(commercial.adapterByTag.Tasks, "src/modules/tasks/infrastructure/http/TaskHttpApiAdapter.ts");
assert.ok(commercial.testGateIds.includes("quality.task-activity-api-boundary"));

for (const file of [
  "src/modules/tasks/presentation/pages/TaskListPage.tsx",
  "src/modules/tasks/presentation/pages/TaskDetailPage.tsx",
  "src/modules/tasks/presentation/components/TaskCreateModal.tsx",
]) {
  const source = read(file);
  assert.doesNotMatch(source, /(?:create|complete|cancel|reassign|reschedule|logActivity)TaskSnapshot/u, `${file} must not use Task snapshot writes`);
  assert.doesNotMatch(source, /@\/platform\/api|fetch\(|axios\./u, `${file} must not call transport/generated API directly`);
}
const detailRoute = read("src/modules/tasks/detail-route.tsx");
assert.match(detailRoute, /getActivityCollectionResource/u, "Task detail must load related activities from backend");
const listHook = read("src/modules/tasks/presentation/hooks/useTasksAuthoritative.ts");
assert.match(listHook, /getActivityCollectionResource/u, "Task workspace must bootstrap authoritative activities");
const composition = read("src/app/composition/connected/connectedCommercialModuleServices.ts");
assert.match(composition, /createTaskConnectedApiRuntime/u, "Connected composition must bind Task API runtime");
const publicApi = read("src/modules/tasks/public/api.ts");
assert.match(publicApi, /CONNECTED_COMMAND_REQUIRES_ASYNC_AUTHORITY/u, "Compatibility snapshot writes must fail closed in connected mode");
const taskApplication = read("src/modules/tasks/application/vertical-slice/taskAuthoritativeQueries.ts");
assert.doesNotMatch(taskApplication, /HttpModuleDataAuthority|createModuleCollectionResource|getModuleDataAuthority/u, "Task application queries must not use generic module authority");
const workCalendar = read("src/workspaces/crm/presentation/pages/WorkCalendarPage.tsx");
assert.match(workCalendar, /useTasksAuthoritative\(\)/u, "Work Calendar must bootstrap authoritative Tasks and Activities");
const aiChat = read("src/components/ai/AiChatPanel.tsx");
assert.doesNotMatch(aiChat, /createTaskCommand|createTaskSnapshot/u, "AI presentation must not compose Task commands or browser snapshot writes");
assert.match(aiChat, /executeAiAction\(/u, "AI-confirmed Task creation must dispatch through the AI action application service");
assert.match(aiChat, /type: "CREATE_TASK"/u, "AI Task creation must travel as a typed CREATE_TASK intent");
const aiActionService = read("src/ai/application/aiActionApplicationService.ts");
assert.doesNotMatch(aiActionService, /createTaskSnapshot|taskActivityRepository/u, "The AI action service must not reach Task state directly");
const workActivation = read("src/workflows/work-activation/index.ts");
assert.match(workActivation, /export async function activateAiSuggestedTask/u, "work-activation must own the AI Task activation command");
assert.match(workActivation, /return createTaskCommand\(/u, "AI-confirmed Task creation must use the async Task command boundary");
assert.doesNotMatch(workActivation, /export function createAiSuggestedTask/u, "AI Task creation must not keep a synchronous browser snapshot path");
const generatedCommands = read("src/platform/api/contracts/generatedProductionCommandRegistry.ts");
assert.doesNotMatch(generatedCommands, /"task\./u, "Dedicated Task commands must not enter the generic mutation router");

// Connected-reachable UI must never mutate Tasks or Activities through the
// demo-only synchronous snapshot bridge. Those helpers stay exported for the demo
// runtimes and demo-mode branches, but presentation may not reach them.
const TASK_SNAPSHOT_MUTATIONS = [
  "createTaskSnapshot",
  "completeTaskSnapshot",
  "cancelTaskSnapshot",
  "reassignTaskSnapshot",
  "rescheduleTaskSnapshot",
  "logActivitySnapshot",
] as const;
const presentationTaskViolations: string[] = [];
for (const file of walkAllFiles(join(root, "src"))) {
  if (!/[\\/]presentation[\\/].*\.(ts|tsx)$/.test(file)) continue;
  const source = readFileSync(file, "utf8");
  for (const symbol of TASK_SNAPSHOT_MUTATIONS) {
    if (source.includes(symbol)) presentationTaskViolations.push(`${relative(root, file)} -> ${symbol}`);
  }
}
assert.deepEqual(
  presentationTaskViolations,
  [],
  `Presentation must use the async Task/Activity commands:\n${presentationTaskViolations.join("\n")}`,
);

// work-activation must activate the Deal next action through the authoritative command.
assert.match(workActivation, /export async function ensureDealNextActionTask/u, "Deal next-action activation must be an async authoritative command");
assert.doesNotMatch(workActivation, /createTaskSnapshot/u, "Deal next-action activation must not use the demo snapshot bridge");
assert.match(workActivation, /NOT ATOMIC WITH THE DEAL COMMAND/u, "The missing atomic Deal+Task backend workflow must stay documented");

console.log(`Tasks & Activities API boundary: PASS (${requiredOperations.length} authoritative operations).`);

function read(relative: string): string {
  return readFileSync(join(root, relative), "utf8");
}
