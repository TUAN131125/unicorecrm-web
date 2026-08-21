import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { walkFiles } from "../../../scripts/quality/core/filesystem.mjs";
import {
  indexQualityManifest,
  loadQualityManifest,
  validateQualityManifest,
} from "../../../scripts/quality/core/quality-manifest.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import { stableShardIndex } from "../../../scripts/quality/core/stable-hash.mjs";

const readJson = (file: string) => JSON.parse(fs.readFileSync(path.join(repositoryRoot, file), "utf8"));
const read = (file: string) => fs.readFileSync(path.join(repositoryRoot, file), "utf8");
const packageJson = readJson("package.json") as { scripts: Record<string, string> };
const manifest = loadQualityManifest();
const validation = validateQualityManifest(manifest);
assert.equal(validation.ok, true, validation.errors.join("\n"));
assert.equal(manifest.schemaVersion, 2);
assert.deepEqual(
  manifest.groups.map((group: { id: string }) => group.id),
  ["lint", "typecheck", "architecture", "unit", "contract", "integration", "route-smoke", "critical-e2e", "backend-contract-hardening", "build", "acceptance"],
);
assert.equal(manifest.groups.at(-2)?.id, "build", "Production build must run immediately before external acceptance.");
assert.equal(manifest.groups.at(-1)?.id, "acceptance", "External backend and browser acceptance must remain the final quality group.");
assert.equal(manifest.gates.length, 311);
assert.equal(new Set(manifest.gates.map((gate: { id: string }) => gate.id)).size, 311, "Stable gate IDs must be unique.");
assert.equal(new Set(manifest.gates.map((gate: { commandName: string }) => gate.commandName)).size, 311, "Compatibility command names must be unique.");
assert.equal(fs.existsSync(path.join(repositoryRoot, "scripts/quality/gate-migration-manifest.json")), false, "The migration ledger must be retired after compatibility cleanup.");
assert.equal(fs.existsSync(path.join(repositoryRoot, "scripts/quality/run-legacy-gate.mjs")), false, "The legacy gate dispatcher must remain retired.");
assert.equal(manifest.gates.some((gate: { id: string }) => gate.id === "quality.gate-migration-contract"), false);
assert.equal(manifest.gates.some((gate: { id: string }) => gate.id === "quality.ci-release-contract"), true);
for (const gate of manifest.gates) {
  assert.ok(gate.owner.trim(), `${gate.id} must have an owner.`);
  assert.equal(gate.shardKey, gate.id, `${gate.id} must use its stable ID as shard key.`);
  assert.ok(gate.steps.length > 0, `${gate.id} must have direct executable steps.`);
  if (!["lint", "build"].includes(gate.commandName)) {
    assert.equal(packageJson.scripts[gate.commandName], undefined, `Individual package gate aliases must remain retired: ${gate.commandName}`);
  }
  for (const step of gate.steps) {
    if (step.type !== "node") continue;
    const entrySource = read(step.entry);
    if (/from\s+["']typescript["']|require\(["']typescript["']\)/u.test(entrySource)) {
      assert.ok(gate.requires.includes("typescript"), `${gate.id} imports TypeScript directly and must declare the dependency.`);
    }
  }
}

const runner = read("scripts/quality/run-quality-pipeline.mjs");
assert.equal(runner.includes("packageJson"), false, "The quality runner must not resolve gates through package.json scripts.");
assert.equal(runner.includes("absoluteGateIndex++ %"), false, "Sharding must not depend on manifest position.");
assert.ok(runner.includes("stableShardIndex"), "Sharding must use the shared stable hash helper.");
assert.ok(runner.includes("QUALITY_REPORT_PATH"), "JSON report output must remain configurable.");
assert.ok(runner.includes("QUALITY_JUNIT_PATH"), "JUnit report output must remain configurable.");
assert.ok(runner.includes("BLOCKED"), "The runner must distinguish unavailable dependencies.");
assert.ok(runner.includes("OPEN_HANDLE"), "The runner must distinguish retained active resources.");
assert.ok(runner.includes("--groups"), "The runner must support a stable multi-group public test command.");
assert.ok(runner.includes("--require-gate"), "The public gate command must fail closed without a gate ID.");
assert.ok(runner.includes("--require-group"), "The public group command must fail closed without a group ID.");
assert.ok(runner.includes("--without-acceptance"), "Deterministic verify must be able to exclude environment-gated acceptance.");

const nodeGateSource = read("scripts/quality/run-node-gate.mjs");
const nodeEntrySource = read("scripts/quality/run-node-entry.mjs");
assert.equal(nodeGateSource.includes("process.exit(0)"), false, "Node gate execution must not force a successful exit.");
assert.equal(nodeEntrySource.includes("process.exit(0)"), false, "Node entries must exit naturally after releasing resources.");
assert.ok(nodeGateSource.includes("quality-entry-complete"));
assert.ok(nodeGateSource.includes("OPEN_HANDLE"));

const existingShardAssignments = new Map(manifest.gates.map((gate: { id: string; shardKey: string }) => [gate.id, stableShardIndex(gate.shardKey, 7)]));
const extendedGateList = [...manifest.gates, { id: "quality.synthetic-new-gate", shardKey: "quality.synthetic-new-gate" }];
for (const gate of extendedGateList.slice(0, -1)) {
  assert.equal(stableShardIndex(gate.shardKey, 7), existingShardAssignments.get(gate.id), `${gate.id} changed shard after appending another gate.`);
}

const qualitySources = walkFiles(repositoryRoot, {
  excludeDirectory: (entryName: string) => [".git", "node_modules", "dist", "coverage", "artifacts"].includes(entryName),
  include: (_filePath: string, entryName: string) => /\.(?:cjs|js|mjs|mts|ts|tsx)$/u.test(entryName),
});
const directCwdExpression = ["process", "cwd()"].join(".");
const cwdViolations = qualitySources
  .filter((filePath: string) => fs.readFileSync(filePath, "utf8").includes(directCwdExpression))
  .map((filePath: string) => path.relative(repositoryRoot, filePath).replaceAll(path.sep, "/"));
assert.deepEqual(cwdViolations, [], `Direct working-directory access must be replaced by canonical repository context:\n${cwdViolations.join("\n")}`);

function recursiveFilesystemHelpers(source: string, relativeFile: string): string[] {
  const findings: string[] = [];
  const declarations = /(?:function\s+(walk|listFiles|visit|collect|collectSourceFiles|collectFiles|findFiles|listSourceFiles|listTextFiles|visitScripts)\s*\([^)]*\)\s*(?::\s*[^\{]+)?|const\s+(walk|listFiles|visit|collect|collectSourceFiles|collectFiles|findFiles|listSourceFiles|listTextFiles|visitScripts)\s*=\s*[^=]*=>)\s*\{/gu;
  for (const match of source.matchAll(declarations)) {
    const name = match[1] ?? match[2];
    const start = (match.index ?? 0) + match[0].lastIndexOf("{");
    let depth = 0;
    let quote: string | null = null;
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const character = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = null;
        continue;
      }
      if (character === '"' || character === "'" || character === "`") quote = character;
      else if (character === "{") depth += 1;
      else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          const body = source.slice(start + 1, index);
          if (body.includes("readdirSync") && new RegExp(`\\b${name}\\s*\\(`, "u").test(body)) findings.push(`${relativeFile}:${name}`);
          break;
        }
      }
    }
  }
  return findings;
}
const recursiveWalkerViolations = qualitySources.flatMap((filePath: string) => {
  const relativeFile = path.relative(repositoryRoot, filePath).replaceAll(path.sep, "/");
  if (relativeFile === "scripts/quality/core/filesystem.mjs") return [];
  return recursiveFilesystemHelpers(fs.readFileSync(filePath, "utf8"), relativeFile);
});
assert.deepEqual(recursiveWalkerViolations, [], `Recursive filesystem walkers must use the shared harness:\n${recursiveWalkerViolations.join("\n")}`);

const runNodeGate = path.join(repositoryRoot, "scripts/quality/run-node-gate.mjs");
const gateArguments = (entry: string) => [runNodeGate, "--entry", entry, "--node-args-json", "[]", "--args-json", "[]", "--grace-ms", "75"];
const passFixture = spawnSync(process.execPath, gateArguments("tests/tooling/fixtures/quality-runner/pass-gate.mjs"), {
  cwd: os.tmpdir(),
  encoding: "utf8",
});
assert.equal(passFixture.status, 0, passFixture.stderr);
const failFixture = spawnSync(process.execPath, gateArguments("tests/tooling/fixtures/quality-runner/fail-gate.mjs"), {
  cwd: os.tmpdir(),
  encoding: "utf8",
});
assert.equal(failFixture.status, 1, failFixture.stderr);
const openHandleFixture = spawnSync(process.execPath, gateArguments("tests/tooling/fixtures/quality-runner/open-handle-gate.mjs"), {
  cwd: os.tmpdir(),
  encoding: "utf8",
  timeout: 5_000,
});
assert.equal(openHandleFixture.status, 86, openHandleFixture.stderr);
assert.match(openHandleFixture.stderr, /OPEN_HANDLE/u);

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "unicore-quality-contract-"));
try {
  const reportPath = path.join(temporaryDirectory, "quality-report.json");
  const junitPath = path.join(temporaryDirectory, "quality-report.junit.xml");
  const pipelineRun = spawnSync(process.execPath, [
    path.join(repositoryRoot, "scripts/quality/run-quality-pipeline.mjs"),
    "--gate", "quality.secret-policy",
    "--report", reportPath,
    "--junit", junitPath,
  ], {
    cwd: os.tmpdir(),
    encoding: "utf8",
    timeout: 30_000,
  });
  assert.equal(pipelineRun.status, 0, `${pipelineRun.stdout}\n${pipelineRun.stderr}`);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.status, "PASS");
  assert.equal(report.results.length, 1);
  assert.equal(report.results[0].id, "quality.secret-policy");
  assert.match(fs.readFileSync(junitPath, "utf8"), /<testsuite[^>]+tests="1"/u);

  const missingGateSelection = spawnSync(process.execPath, [
    path.join(repositoryRoot, "scripts/quality/run-quality-pipeline.mjs"),
    "--require-gate",
  ], { cwd: os.tmpdir(), encoding: "utf8" });
  assert.equal(missingGateSelection.status, 1);
  assert.match(missingGateSelection.stderr, /requires --gate/u);

  const multiGroupSelection = spawnSync(process.execPath, [
    path.join(repositoryRoot, "scripts/quality/run-quality-pipeline.mjs"),
    "--groups", "lint,architecture",
    "--list",
  ], { cwd: os.tmpdir(), encoding: "utf8" });
  assert.equal(multiGroupSelection.status, 0, multiGroupSelection.stderr);
  assert.match(multiGroupSelection.stdout, /^lint$/mu);
  assert.match(multiGroupSelection.stdout, /^architecture$/mu);
  assert.doesNotMatch(multiGroupSelection.stdout, /^unit$/mu);

  const timeoutManifestPath = path.join(temporaryDirectory, "timeout-manifest.json");
  const timeoutReportPath = path.join(temporaryDirectory, "timeout-report.json");
  fs.writeFileSync(timeoutManifestPath, `${JSON.stringify({
    schemaVersion: 2,
    authority: "timeout-fixture",
    reportSchemaVersion: 1,
    groups: [{ id: "build", label: "Fixture", description: "Timeout fixture", gates: ["quality.fixture-slow", "quality.fixture-pass"] }],
    gates: [
      {
        id: "quality.fixture-slow",
        commandName: "fixture:slow",
        groupId: "build",
        kind: "tooling",
        owner: "quality-runner-contract",
        entry: "tests/tooling/fixtures/quality-runner/slow-gate.mjs",
        timeoutMs: 1_000,
        openHandleGraceMs: 75,
        requires: ["node"],
        shardKey: "quality.fixture-slow",
        steps: [{ type: "node", entry: "tests/tooling/fixtures/quality-runner/slow-gate.mjs", nodeArgs: [], args: [] }],
      },
      {
        id: "quality.fixture-pass",
        commandName: "fixture:pass",
        groupId: "build",
        kind: "tooling",
        owner: "quality-runner-contract",
        entry: "tests/tooling/fixtures/quality-runner/pass-gate.mjs",
        timeoutMs: 1_000,
        openHandleGraceMs: 75,
        requires: ["node"],
        shardKey: "quality.fixture-pass",
        steps: [{ type: "node", entry: "tests/tooling/fixtures/quality-runner/pass-gate.mjs", nodeArgs: [], args: [] }],
      },
    ],
    excludedScripts: [],
  }, null, 2)}
`);
  const timeoutRun = spawnSync(process.execPath, [
    path.join(repositoryRoot, "scripts/quality/run-quality-pipeline.mjs"),
    "--manifest", timeoutManifestPath,
    "--report", timeoutReportPath,
  ], {
    cwd: os.tmpdir(),
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(timeoutRun.status, 1, `${timeoutRun.stdout}
${timeoutRun.stderr}`);
  const timeoutReport = JSON.parse(fs.readFileSync(timeoutReportPath, "utf8"));
  assert.equal(timeoutReport.status, "FAIL");
  assert.deepEqual(timeoutReport.results.map((result: { status: string }) => result.status), ["TIMEOUT", "NOT_RUN"]);


  const environmentManifestPath = path.join(temporaryDirectory, "environment-manifest.json");
  const environmentReportPath = path.join(temporaryDirectory, "environment-report.json");
  fs.writeFileSync(environmentManifestPath, `${JSON.stringify({
    schemaVersion: 2,
    authority: "environment-fixture",
    reportSchemaVersion: 1,
    groups: [{ id: "acceptance", label: "Fixture", description: "Environment requirement fixture", gates: ["quality.fixture-environment"] }],
    gates: [{
      id: "quality.fixture-environment",
      commandName: "fixture:environment",
      groupId: "acceptance",
      kind: "acceptance",
      owner: "quality-runner-contract",
      entry: "tests/tooling/fixtures/quality-runner/pass-gate.mjs",
      timeoutMs: 1_000,
      openHandleGraceMs: 75,
      requires: ["node", "env:UNICORECRM_QUALITY_ENV_FIXTURE"],
      shardKey: "quality.fixture-environment",
      steps: [{ type: "node", entry: "tests/tooling/fixtures/quality-runner/pass-gate.mjs", nodeArgs: [], args: [] }],
    }],
    excludedScripts: [],
  }, null, 2)}
`);
  const blockedEnvironmentRun = spawnSync(process.execPath, [
    path.join(repositoryRoot, "scripts/quality/run-quality-pipeline.mjs"),
    "--manifest", environmentManifestPath,
    "--report", environmentReportPath,
  ], {
    cwd: os.tmpdir(),
    env: { ...process.env, UNICORECRM_QUALITY_ENV_FIXTURE: "" },
    encoding: "utf8",
  });
  assert.equal(blockedEnvironmentRun.status, 2, `${blockedEnvironmentRun.stdout}
${blockedEnvironmentRun.stderr}`);
  const blockedEnvironmentReport = JSON.parse(fs.readFileSync(environmentReportPath, "utf8"));
  assert.equal(blockedEnvironmentReport.status, "BLOCKED");
  assert.equal(blockedEnvironmentReport.results[0].status, "BLOCKED");
  assert.match(blockedEnvironmentReport.results[0].message, /UNICORECRM_QUALITY_ENV_FIXTURE/u);

  const availableEnvironmentRun = spawnSync(process.execPath, [
    path.join(repositoryRoot, "scripts/quality/run-quality-pipeline.mjs"),
    "--manifest", environmentManifestPath,
  ], {
    cwd: os.tmpdir(),
    env: { ...process.env, UNICORECRM_QUALITY_ENV_FIXTURE: "configured" },
    encoding: "utf8",
  });
  assert.equal(availableEnvironmentRun.status, 0, `${availableEnvironmentRun.stdout}
${availableEnvironmentRun.stderr}`);
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

const expectedPublicScripts = {
  dev: "vite --port=3000 --host=0.0.0.0",
  build: "vite build && node tests/quality/architecture/check-bundle-budget.mjs",
  preview: "vite preview",
  clean: "rm -rf dist server.js",
  lint: "node scripts/quality/run-quality-pipeline.mjs --group lint",
  typecheck: "node scripts/quality/run-quality-pipeline.mjs --group typecheck",
  test: "node scripts/quality/run-quality-pipeline.mjs --groups unit,contract,integration,route-smoke",
  verify: "node scripts/quality/run-quality-pipeline.mjs --without-acceptance",
  "verify:no-build": "node scripts/quality/run-quality-pipeline.mjs --without-build",
  "security:scan": "node scripts/security/scan-current-tree.mjs",
  "api:generate": "node scripts/api/generate-openapi-client.mjs",
  "api:check": "node scripts/quality/run-quality-pipeline.mjs --gate quality.api-contract",
  "repo:inventory": "node scripts/generate-repository-inventory.mjs",
  "repo:check": "node scripts/quality/run-quality-pipeline.mjs --gate quality.repository-inventory",
  "quality:list": "node scripts/quality/run-quality-pipeline.mjs --list",
  "quality:gate": "node scripts/quality/run-quality-pipeline.mjs --require-gate",
  "quality:group": "node scripts/quality/run-quality-pipeline.mjs --require-group",
  e2e: "playwright test",
  "e2e:connected": "node tests/tooling/run-connected-playwright.mjs",
  "e2e:install": "playwright install chromium",
  "e2e:critical": "node scripts/quality/run-quality-pipeline.mjs --group critical-e2e",
  "release:prepare": "node scripts/release/create-source-release.mjs",
  "release:check": "node scripts/release/check-source-release.mjs",
};
assert.deepEqual(packageJson.scripts, expectedPublicScripts, "package.json must expose only the reviewed public command surface.");
assert.ok(Object.keys(packageJson.scripts).length <= 25, "Public package command surface must stay at or below 25 commands.");
assert.equal("check:quality-pipeline" in packageJson.scripts, false);
assert.equal("verify:gates" in packageJson.scripts, false);
assert.equal("test:unit" in packageJson.scripts, false);
const retiredRunnerPath = ["scripts", "run-verify.cjs"].join("/");
assert.equal(fs.existsSync(path.join(repositoryRoot, retiredRunnerPath)), false);

const indexed = indexQualityManifest(manifest);
assert.equal(indexed.gatesById.size, 311);
console.log(`Quality pipeline: PASS (${validation.groupCount} groups, ${validation.gateCount} stable manifest-owned gates).`);
