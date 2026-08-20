import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";

const root = repositoryRoot;
const requiredFiles = [
  "src/modules/support/application/ports/SupportApiRuntime.ts",
  "src/modules/support/application/vertical-slice/supportAuthoritativeQueries.ts",
  "src/modules/support/infrastructure/http/SupportApiMapper.ts",
  "src/modules/support/infrastructure/http/SupportHttpApiAdapter.ts",
  "src/modules/support/infrastructure/http/createSupportConnectedApiRuntime.ts",
  "src/modules/support/runtime/createSupportDemoApiRuntime.ts",
];
for (const file of requiredFiles) assert.ok(existsSync(join(root, file)), `Missing ${file}`);

const openApi = JSON.parse(read("docs/api/openapi.json")) as any;
const requiredOperations = [
  "listSupportCases",
  "getSupportCase",
  "createSupportCase",
  "replaceSupportCaseProfile",
  "assignSupportCase",
  "transitionSupportCase",
  "addSupportCaseReply",
  "addSupportCaseInternalNote",
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
  assert.equal(operation["x-module-owner"], "support", `${operationId} owner drift`);
}

const adapter = read("src/modules/support/infrastructure/http/SupportHttpApiAdapter.ts");
for (const operationId of requiredOperations) assert.match(adapter, new RegExp(`\\.${operationId}(?:<|\\()|${operationId}`), `Support adapter must own ${operationId}`);

const ownership = JSON.parse(read("scripts/api/openapi/client-ownership.json"));
const commercial = ownership.clients.find((client: { id: string }) => client.id === "commercial");
assert.equal(commercial.adapterByTag.Support, "src/modules/support/infrastructure/http/SupportHttpApiAdapter.ts");
assert.ok(commercial.testGateIds.includes("quality.support-api-boundary"));

for (const file of [
  "src/modules/support/presentation/pages/SupportCaseListPage.tsx",
  "src/modules/support/presentation/pages/SupportCaseDetailPage.tsx",
  "src/modules/support/presentation/pages/SupportCaseFormPage.tsx",
]) {
  const source = read(file);
  assert.doesNotMatch(source, /saveSupportCaseSnapshot|replaceSupportCases|updateSupportCaseCommand/u, `${file} must not use Support snapshot writes`);
  assert.doesNotMatch(source, /@\/platform\/api|fetch\(|axios\./u, `${file} must not call transport/generated API directly`);
}
const form = read("src/modules/support/presentation/pages/SupportCaseFormPage.tsx");
assert.match(form, /createSupportCaseCommand/u, "Support create form must use the async Support API boundary");
assert.match(form, /replaceSupportCaseProfileCommand/u, "Support edit form must use the async Support API boundary");
const composition = read("src/app/composition/connected/connectedCommercialModuleServices.ts");
assert.match(composition, /createSupportConnectedApiRuntime/u, "Connected composition must bind Support API runtime");
const publicApi = read("src/modules/support/public/cases.ts");
assert.match(publicApi, /CONNECTED_COMMAND_REQUIRES_ASYNC_AUTHORITY/u, "Compatibility Support writes must fail closed in connected mode");
const supportApplication = read("src/modules/support/application/vertical-slice/supportAuthoritativeQueries.ts");
assert.doesNotMatch(supportApplication, /HttpModuleDataAuthority|createModuleCollectionResource|getModuleDataAuthority/u, "Support application queries must not use generic module authority");
const generatedCommands = read("src/platform/api/contracts/generatedProductionCommandRegistry.ts");
assert.doesNotMatch(generatedCommands, /"support\.(?:create|update|assign|transition|add-reply|add-internal-note)"/u, "Dedicated Support commands must not enter the generic mutation router");

console.log(`Support API boundary: PASS (${requiredOperations.length} authoritative operations).`);

function read(relative: string): string { return readFileSync(join(root, relative), "utf8"); }
