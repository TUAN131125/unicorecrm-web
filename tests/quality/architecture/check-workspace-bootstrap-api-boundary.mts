import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";

const root = repositoryRoot;
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const required = [
  "src/platform/workspace-context/application/WorkspaceBootstrapGateway.ts",
  "src/platform/workspace-context/infrastructure/WorkspaceBootstrapHttpAdapter.ts",
  "src/platform/workspace-context/runtime/connectedWorkspaceContextRuntime.ts",
  "src/platform/api/generated/workspaceBootstrapApi.ts",
  "src/app/router/guards/RequireWorkspaceContext.tsx",
];
for (const file of required) assert.ok(fs.existsSync(path.join(root, file)), `Missing workspace bootstrap boundary: ${file}`);

const spec = JSON.parse(read("docs/api/openapi.json"));
const operations = Object.entries(spec.paths).flatMap(([route, item]: [string, any]) => ["get", "post", "put", "patch", "delete"].flatMap((method) => item[method] ? [{ route, method: method.toUpperCase(), ...item[method] }] : []));
const workspaceOperations = operations.filter((operation: any) => operation.tags?.includes("WorkspaceBootstrap"));
assert.deepEqual(workspaceOperations.map((operation: any) => operation.operationId).sort(), ["getWorkspaceBootstrap", "listMyWorkspaces"]);
for (const operation of workspaceOperations) {
  assert.equal(operation["x-contract-status"], "PRODUCTION_CONTRACT_READY");
  assert.equal(operation["x-workspace-required"], false, `${operation.operationId} must resolve workspace before X-Workspace-Id exists.`);
  assert.equal(operation["x-credentials-policy"], "INCLUDE");
  assert.notDeepEqual(operation.security, [], `${operation.operationId} must require an authenticated identity.`);
}

const ownership = JSON.parse(read("scripts/api/openapi/client-ownership.json"));
const client = ownership.clients.find((candidate: { id: string }) => candidate.id === "workspace-bootstrap");
assert.ok(client);
assert.equal(client.adapterByTag.WorkspaceBootstrap, "src/platform/workspace-context/infrastructure/WorkspaceBootstrapHttpAdapter.ts");

const generated = read("src/platform/api/generated/workspaceBootstrapApi.ts");
for (const id of ["listMyWorkspaces", "getWorkspaceBootstrap"]) assert.match(generated, new RegExp(`operationId: "${id}"`));
assert.match(generated, /workspace: "none"/u);

const bootstrap = read("src/app/bootstrap/applicationBootstrap.ts");
assert.match(bootstrap, /new WorkspaceBootstrapHttpAdapter\(/u);
assert.match(bootstrap, /new WorkspaceBootstrapApiClient\(workspaceHttp\)/u);
assert.match(bootstrap, /new WorkspaceProvisioningApiClient\(workspaceHttp\)/u);
assert.match(bootstrap, /getWorkspaceId: \(\) =>[\s\S]*getActiveWorkspaceId\(\)/u);
const selection = read("src/features/auth/pages/WorkspaceSelectionPage.tsx");
assert.match(selection, /await loadWorkspaceMemberships/u);
assert.match(selection, /await switchWorkspaceContext/u);
assert.match(selection, /resolveCanonicalWorkspaceContext/u);
assert.doesNotMatch(selection, /INITIAL_SETUP/u);
assert.doesNotMatch(selection, /listWorkspaceMembershipsForAccount/u);
const runtime = read("src/platform/workspace-context/runtime/connectedWorkspaceContextRuntime.ts");
assert.match(runtime, /window\.sessionStorage/u);
assert.doesNotMatch(runtime, /localStorage/u);
assert.match(runtime, /assertContextMatchesMembership/u);
const guard = read("src/app/router/guards/RequireWorkspaceContext.tsx");
assert.match(guard, /restoreSelectedWorkspaceContext/u);
assert.match(guard, /switchWorkspaceContext/u);
assert.match(guard, /resolveCanonicalWorkspaceContext/u);
assert.doesNotMatch(guard, /INITIAL_SETUP/u);
const app = read("src/App.tsx");
assert.doesNotMatch(app, /InitialSetupPage/u);
assert.match(app, /path=\{ROUTE_KEYS\.INITIAL_SETUP\}[\s\S]*Navigate to=\{ROUTE_KEYS\.WORKSPACE_SELECTION\}/u);
assert.equal(fs.existsSync(path.join(root, "src/features/workspace-setup/pages/InitialSetupPage.tsx")), false);

const violations: string[] = [];
for (const file of walkAllFiles(path.join(root, "src")).filter((file) => /\.(?:ts|tsx)$/u.test(file))) {
  const relative = path.relative(root, file).replaceAll(path.sep, "/");
  const source = fs.readFileSync(file, "utf8");
  if (!/workspaceBootstrapApi/u.test(source)) continue;
  const allowed = relative === "src/platform/workspace-context/infrastructure/WorkspaceBootstrapHttpAdapter.ts"
    || relative === "src/app/bootstrap/applicationBootstrap.ts"
    || relative === "src/platform/api/generated/index.ts"
    || relative === "src/platform/api/catalog/generatedApiOperationCatalog.ts";
  if (!allowed && relative !== "src/platform/api/generated/workspaceBootstrapApi.ts") violations.push(relative);
}
assert.deepEqual(violations, [], `Generated Workspace Bootstrap client leaked outside infrastructure/composition:\n${violations.join("\n")}`);
console.log(`[workspace-bootstrap-api-boundary] PASS ${workspaceOperations.length} operations and authoritative connected context`);
