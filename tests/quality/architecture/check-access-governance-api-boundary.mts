import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";

const root = repositoryRoot;
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const required = [
  "src/platform/access-control/application/AccessGovernanceGateway.ts",
  "src/platform/access-control/application/accessGovernanceBinding.ts",
  "src/platform/access-control/infrastructure/AccessGovernanceHttpAdapter.ts",
  "src/platform/access-control/runtime/accessGovernanceRuntime.ts",
  "src/platform/access-control/react/useAccessGovernance.ts",
  "src/platform/api/generated/accessGovernanceApi.ts",
  "src/workspaces/people-access/runtime/createPeopleAccessDemoRuntime.ts",
  "src/workspaces/people-access/presentation/pages/UsersPermissionsPage.tsx",
];
for (const file of required) assert.ok(fs.existsSync(path.join(root, file)), `Missing access-governance boundary: ${file}`);

const spec = JSON.parse(read("docs/api/openapi.json"));
const operations = Object.entries(spec.paths).flatMap(([route, item]: [string, any]) => ["get", "post", "put", "patch", "delete"].flatMap((method) => item[method] ? [{ route, method: method.toUpperCase(), ...item[method] }] : []));
const accessOperations = operations.filter((operation: any) => operation.tags?.includes("AccessGovernance"));
const expected = [
  "archiveAccessRole",
  "changeWorkspaceMemberStatus",
  "createAccessRole",
  "evaluateEffectiveRecordAccess",
  "getCurrentAuthorizationContext",
  "getWorkspaceAccessDirectory",
  "inviteWorkspaceMember",
  "provisionWorkspaceMember",
  "replaceAccessRole",
  "replaceWorkspaceMemberAccess",
  "resendWorkspaceInvitation",
  "revokeWorkspaceInvitation",
  "rotateManagedMemberPassword",
].sort();
assert.deepEqual(accessOperations.map((operation: any) => operation.operationId).sort(), expected);
for (const operation of accessOperations) {
  assert.equal(operation["x-contract-status"], "PRODUCTION_CONTRACT_READY", `${operation.operationId} is not production-ready.`);
  assert.equal(operation["x-workspace-required"], true, `${operation.operationId} must be workspace-scoped.`);
  assert.equal(operation["x-module-owner"], "platform/access-control");
  assert.ok(operation["x-required-capability"], `${operation.operationId} misses capability ownership.`);
  assert.ok(operation["x-resource-scope"], `${operation.operationId} misses resource scope.`);
  assert.ok(operation["x-data-scope"], `${operation.operationId} misses data scope.`);
  const schema = operation.requestBody?.content?.["application/json"]?.schema?.$ref;
  if (operation.requestBody) assert.ok(schema, `${operation.operationId} must use a named request DTO.`);
  if (!["getCurrentAuthorizationContext", "getWorkspaceAccessDirectory", "evaluateEffectiveRecordAccess"].includes(operation.operationId)) {
    assert.equal(operation["x-idempotency-policy"], "REQUIRED", `${operation.operationId} must be idempotent.`);
  }
}

const ownership = JSON.parse(read("scripts/api/openapi/client-ownership.json"));
const client = ownership.clients.find((candidate: { id: string }) => candidate.id === "access-governance");
assert.ok(client, "Access governance generated-client ownership is missing.");
assert.equal(client.adapterByTag.AccessGovernance, "src/platform/access-control/infrastructure/AccessGovernanceHttpAdapter.ts");

const generated = read("src/platform/api/generated/accessGovernanceApi.ts");
for (const operationId of expected) assert.match(generated, new RegExp(`operationId: "${operationId}"`));
const adapter = read("src/platform/access-control/infrastructure/AccessGovernanceHttpAdapter.ts");
assert.match(adapter, /class AccessGovernanceHttpAdapter/u);
assert.match(adapter, /readonly mode = "connected"/u);
assert.doesNotMatch(adapter, /BrowserStorageAdapter|localStorage|sessionStorage/u);

const composition = read("src/app/composition/applicationComposition.ts");
assert.match(composition, /new AccessGovernanceHttpAdapter\(new AccessGovernanceApiClient/u);
const guard = read("src/app/router/guards/RequireWorkspaceContext.tsx");
assert.match(guard, /loadAccessGovernance\(/u);
assert.match(guard, /loadStudioCoreRuntime\(/u);
const accessRuntime = read("src/platform/access-control/runtime/accessControlRuntime.ts");
assert.match(accessRuntime, /getAuthoritativeEffectiveAccess/u);
assert.match(accessRuntime, /isAccessGovernanceRuntimeConfigured/u);
const recordAdapter = read("src/platform/access-control/infrastructure/HttpEffectiveRecordAccessAuthority.ts");
assert.match(recordAdapter, /evaluateEffectiveRecordAccess/u);
assert.doesNotMatch(recordAdapter, /CONTRACT_OPERATION_BLOCKED/u);

const page = read("src/workspaces/people-access/presentation/pages/UsersPermissionsPage.tsx");
assert.match(page, /useAccessGovernance/u);
assert.match(page, /runtime\.commands\./u);
for (const forbidden of ["getAccessControlSnapshot", "getWorkspacePeopleSnapshot", "listWorkspaceMembershipDirectory", "peopleAccessCommands", "createRoleDefinition", "updateRoleCapabilities"]) {
  assert.doesNotMatch(page, new RegExp(forbidden), `People & Access presentation still owns ${forbidden}.`);
}

const violations: string[] = [];
for (const file of walkAllFiles(path.join(root, "src")).filter((value) => /\.(?:ts|tsx)$/u.test(value))) {
  const relative = path.relative(root, file).replaceAll(path.sep, "/");
  const source = fs.readFileSync(file, "utf8");
  if (!/accessGovernanceApi/u.test(source)) continue;
  const allowed = relative === "src/app/composition/applicationComposition.ts"
    || relative === "src/platform/access-control/infrastructure/AccessGovernanceHttpAdapter.ts"
    || relative === "src/platform/access-control/infrastructure/HttpEffectiveRecordAccessAuthority.ts"
    || relative === "src/platform/api/generated/index.ts"
    || relative === "src/platform/api/catalog/generatedApiOperationCatalog.ts";
  if (!allowed && relative !== "src/platform/api/generated/accessGovernanceApi.ts") violations.push(relative);
}
assert.deepEqual(violations, [], `Generated access-governance client leaked outside infrastructure:\n${violations.join("\n")}`);
console.log(`[access-governance-api-boundary] PASS ${accessOperations.length} operations and authoritative UI/runtime ownership`);
