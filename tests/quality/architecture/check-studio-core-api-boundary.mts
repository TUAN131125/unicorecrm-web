import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";

const root = repositoryRoot;
const requiredFiles = [
  "src/workspaces/studio/application/StudioCoreGateway.ts",
  "src/workspaces/studio/application/studioCore.types.ts",
  "src/workspaces/studio/infrastructure/StudioCoreHttpAdapter.ts",
  "src/workspaces/studio/runtime/studioCoreRuntime.ts",
];
for (const file of requiredFiles) assert.ok(existsSync(join(root, file)), `Missing ${file}`);
const document = JSON.parse(readFileSync(join(root, "docs/api/openapi.json"), "utf8")) as any;
const requiredOperations = [
  "getWorkspaceConfiguration",
  "updateWorkspaceBusinessInformation",
  "updateWorkspaceLocaleRegion",
  "updateWorkspaceBlueprint",
  "updateWorkspaceFeatures",
  "publishWorkspaceConfiguration",
  "listWorkspaceConfigurationAudit",
  "getStudioQuickSetup",
  "openStudioQuickSetup",
  "dismissStudioQuickSetupAutoOpen",
  "completeStudioQuickSetupStep",
  "skipStudioQuickSetupStep",
];
const operations = new Map<string, any>();
for (const item of Object.values(document.paths) as any[]) for (const method of ["get", "post", "put", "patch", "delete"]) {
  const operation = item?.[method];
  if (operation?.operationId) operations.set(operation.operationId, operation);
}
for (const operationId of requiredOperations) {
  const operation = operations.get(operationId);
  assert.ok(operation, `Missing ${operationId}`);
  assert.equal(operation["x-contract-status"], "PRODUCTION_CONTRACT_READY", `${operationId} must be ready`);
  assert.equal(operation["x-module-owner"], "workspaces/studio", `${operationId} owner drift`);
}
const adapter = readFileSync(join(root, "src/workspaces/studio/infrastructure/StudioCoreHttpAdapter.ts"), "utf8");
for (const operationId of requiredOperations) assert.ok(adapter.includes(operationId), `Adapter must own ${operationId}`);
for (const file of [
  "src/workspaces/studio/presentation/views/BusinessInformationView.tsx",
  "src/workspaces/studio/presentation/views/LocaleRegionView.tsx",
  "src/workspaces/studio/presentation/views/FeatureUsageView.tsx",
]) {
  const source = readFileSync(join(root, file), "utf8");
  assert.equal(source.includes("updateWorkspaceOperationalConfiguration("), false, `${file} must not mutate browser operational configuration`);
  assert.equal(source.includes("updateWorkspaceConfig("), false, `${file} must not mutate browser workspace configuration`);
}
console.log(`Studio Core API boundary: PASS (${requiredOperations.length} authoritative operations).`);
