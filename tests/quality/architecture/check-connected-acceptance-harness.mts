import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import { walkFiles } from "../../../scripts/quality/core/filesystem.mjs";

const read = (relativePath: string) => fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
const fixturePath = "tests/fixtures/connected-host/connectedApiTestHost.mjs";
const integrationPath = "tests/quality/integration/check-connected-backend-integration.mts";
const externalPath = "tests/quality/acceptance/check-real-backend-contract.mts";
const browserConfigPath = "playwright.connected.config.ts";
const browserTestPath = "tests/e2e/connected-backend.spec.ts";
const browserRunnerPath = "tests/tooling/run-connected-playwright.mjs";
const documentationPath = "docs/quality/connected-backend-acceptance.md";

for (const relativePath of [fixturePath, integrationPath, externalPath, browserConfigPath, browserTestPath, browserRunnerPath, documentationPath]) {
  assert.ok(fs.existsSync(path.join(repositoryRoot, relativePath)), `${relativePath} must exist.`);
}
assert.equal(fs.existsSync(path.join(repositoryRoot, "backend")), false, "Patch 7 must not disguise a test fixture as a production backend implementation.");

const fixture = read(fixturePath);
for (const marker of ["node:http", "Authorization", "X-Workspace-Id", "Idempotency-Key", "If-Match", "VALIDATION_FAILED", "WORKSPACE_ACCESS_DENIED", "contractMode === \"openapi\""]) {
  assert.ok(fixture.includes(marker), `Connected test host must exercise ${marker}.`);
}
assert.ok(fixture.includes("createConnectedApiTestHost"));
assert.equal(/(?:aws|github|openai|slack)[_-]?(?:key|token)/iu.test(fixture), false, "Test host fixtures must not resemble provider credentials.");

const integration = read(integrationPath);
for (const marker of ["createConnectedApiTestHost", "FetchHttpClient", "initializeApplicationComposition", "RoutedHttpMutationAuthority", "IDEMPOTENCY_KEY_REUSED", "CONTRACT_VIOLATION", "CONNECTED_COMMAND_CONTRACT_BLOCKED"]) {
  assert.ok(integration.includes(marker), `Local integration evidence must use ${marker}.`);
}

const external = read(externalPath);
for (const marker of ["CommercialApiClient", "UNICORECRM_TEST_API_BASE_URL", "UNICORECRM_TEST_SECONDARY_WORKSPACE_ID", "IDEMPOTENCY", "Optimistic concurrency is covered by operation-specific provider packs"]) {
  assert.ok(external.includes(marker), `External acceptance must cover ${marker}.`);
}
assert.ok(external.includes("Data durability across database restart is not asserted"), "The external contract gate must not overclaim database durability.");

const browserConfig = read(browserConfigPath);
assert.ok(browserConfig.includes("VITE_RUNTIME_MODE: \"connected\""));
assert.ok(browserConfig.includes("env: connectedFrontendEnvironment"));
assert.equal(browserConfig.includes("VITE_API_BASE_URL=${apiBaseUrl}"), false, "External URLs must not be interpolated into a shell command.");
assert.ok(browserConfig.includes("UNICORECRM_TEST_API_BASE_URL"));
assert.ok(browserConfig.includes("connectedApiTestHost.mjs"));
const browserTest = read(browserTestPath);
assert.ok(browserTest.includes("__UNICORECRM_CONNECTED_RUNTIME__"));
assert.ok(browserTest.includes("workspace isolation"));
assert.ok(browserTest.includes("UI DTO acceptance requires"), "External browser mode must explicitly distinguish transport proof from reviewed UI DTO proof.");

const sourceFiles = walkFiles(path.join(repositoryRoot, "src"), {
  include: (_filePath: string, entryName: string) => /\.(?:ts|tsx|mts|mjs|js|jsx)$/u.test(entryName),
});
const fixtureImports = sourceFiles.filter((filePath: string) => {
  const source = fs.readFileSync(filePath, "utf8");
  return source.includes("tests/fixtures/connected-host") || source.includes("connectedApiTestHost");
});
assert.deepEqual(fixtureImports, [], "Production source must never import the Patch 7 test backend fixture.");

const documentation = read(documentationPath);
for (const marker of ["LOCAL FIXTURE", "EXTERNAL BACKEND", "BLOCKED", "NOT production backend", "database restart"]) {
  assert.ok(documentation.includes(marker), `Acceptance documentation must state ${marker}.`);
}

console.log("Connected acceptance harness: PASS (test-only host, real HTTP integration, external backend gate and browser configuration remain clearly separated from production proof)." );
