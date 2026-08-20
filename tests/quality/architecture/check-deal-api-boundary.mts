import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";

const root = repositoryRoot;
const requiredFiles = [
  "src/modules/deals/application/ports/DealApiRuntime.ts",
  "src/modules/deals/application/vertical-slice/dealAuthoritativeQueries.ts",
  "src/modules/deals/infrastructure/http/DealApiMapper.ts",
  "src/modules/deals/infrastructure/http/DealHttpApiAdapter.ts",
  "src/modules/deals/infrastructure/http/createDealConnectedApiRuntime.ts",
  "src/modules/deals/runtime/createDealDemoApiRuntime.ts",
];
for (const file of requiredFiles) assert.ok(existsSync(join(root, file)), `Missing ${file}`);

const openApi = JSON.parse(read("docs/api/openapi.json")) as any;
const requiredOperations = [
  "listDeals",
  "getDeal",
  "getDealForecastSummary",
  "createDealCommand",
  "updateDealCommand",
  "changeDealStageCommand",
  "assignDealOwner",
  "updateDealForecast",
  "updateDealNextAction",
  "markDealWonCommand",
  "markDealLostCommand",
  "archiveDealCommand",
  "archiveDealsBatch",
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
  assert.equal(operation["x-module-owner"], "deals", `${operationId} owner drift`);
}

for (const operationId of [
  "createDealCommand",
  "updateDealCommand",
  "changeDealStageCommand",
  "assignDealOwner",
  "updateDealForecast",
  "updateDealNextAction",
  "markDealWonCommand",
  "markDealLostCommand",
  "archiveDealCommand",
  "archiveDealsBatch",
]) {
  const operation = operations.get(operationId);
  assert.equal(operation["x-idempotency-policy"], "REQUIRED", `${operationId} must require idempotency`);
}
for (const operationId of [
  "updateDealCommand",
  "changeDealStageCommand",
  "assignDealOwner",
  "updateDealForecast",
  "updateDealNextAction",
  "markDealWonCommand",
  "markDealLostCommand",
  "archiveDealCommand",
]) {
  const operation = operations.get(operationId);
  assert.equal(operation["x-concurrency-policy"], "IF_MATCH_REQUIRED", `${operationId} must require optimistic concurrency`);
}

const adapter = read("src/modules/deals/infrastructure/http/DealHttpApiAdapter.ts");
for (const operationId of requiredOperations) {
  assert.match(adapter, new RegExp(`\\.${operationId}(?:<|\\()|${operationId}`), `Deal adapter must own ${operationId}`);
}

const ownership = JSON.parse(read("scripts/api/openapi/client-ownership.json"));
const commercial = ownership.clients.find((client: { id: string }) => client.id === "commercial");
assert.equal(commercial.adapterByTag.Deals, "src/modules/deals/infrastructure/http/DealHttpApiAdapter.ts");
assert.ok(commercial.testGateIds.includes("quality.deal-api-boundary"));

const composition = read("src/app/composition/connected/connectedCrmModuleServices.ts");
assert.match(composition, /createDealConnectedApiRuntime/u, "Connected composition must bind the Deal API runtime");
const application = read("src/modules/deals/application/vertical-slice/dealAuthoritativeQueries.ts");
assert.doesNotMatch(application, /HttpModuleDataAuthority|createModuleCollectionResource|getModuleDataAuthority/u, "Deal queries must not use generic module authority");
const publicApi = read("src/modules/deals/public/deals.ts");
assert.match(publicApi, /CONNECTED_COMMAND_REQUIRES_ASYNC_AUTHORITY/u, "Compatibility Deal writes must fail closed in connected mode");
assert.doesNotMatch(publicApi, /getRoutedHttpMutationAuthority|executeGeneratedProductionCommand/u, "Deal commands must not use the generic mutation router");
assert.match(publicApi, /DEAL_EXPORT_BACKEND_REQUIRED/u, "Connected browser export must fail closed until backend export is contracted");
const generatedCommands = read("src/platform/api/contracts/generatedProductionCommandRegistry.ts");
assert.doesNotMatch(generatedCommands, /"deals\.(?:create|update|change-stage|assign|forecast|next-action|mark-won|mark-lost|archive)"/u, "Dedicated Deal commands must not enter the generic mutation router");

const pipelineController = read("src/modules/deals/presentation/hooks/useDealPipelineController.ts");
assert.match(pipelineController, /archiveDealCommand/u, "Pipeline archive must use the typed Deal API command");
assert.match(pipelineController, /closeDealLostCommand/u, "Pipeline loss must use the typed Deal API command");
assert.doesNotMatch(pipelineController, /executeDealRecycleCommand/u, "Deal presentation must not retain frontend-owned recycle orchestration");
assert.doesNotMatch(pipelineController, /setDeals\(prev => prev\.filter/u, "Pipeline archive must not delete the authoritative record locally");
assert.match(pipelineController, /assertDealDemoImportAllowed/u, "Connected Deal import must fail closed until a backend operation exists");

const detailController = read("src/modules/deals/presentation/hooks/useDealDetailController.tsx");
assert.match(detailController, /updateDealCommand/u, "Deal line changes must use the typed profile operation");
assert.match(detailController, /closeDealLostCommand/u, "Deal detail loss must use the typed Deal API command");
assert.match(detailController, /logActivityViaApi/u, "Deal timeline writes must be owned by the Tasks activity API");
assert.doesNotMatch(detailController, /executeDealRecycleCommand/u, "Deal detail must not retain frontend-owned recycle orchestration");

const forecastOperation = operations.get("getDealForecastSummary");
assert.equal(forecastOperation["x-transaction-boundary"], "READ_ONLY_COMPOSED_PROJECTION");
assert.equal(forecastOperation["x-money-policy"], "DECIMAL_STRING_MULTI_CURRENCY_BUCKETS");

console.log(`Deal API boundary: PASS (${requiredOperations.length} authoritative operations).`);

function read(relative: string): string { return readFileSync(join(root, relative), "utf8"); }
