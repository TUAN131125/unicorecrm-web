import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { walkFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import {
  collectReleaseFiles,
  createCycloneDxSbom,
  createSourceArchive,
  inspectSourceArchive,
  isForbiddenArchiveEntry,
  releasePolicy,
} from "../../../scripts/release/source-release.mjs";

const read = (relativePath: string) => fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
const exists = (relativePath: string) => fs.existsSync(path.join(repositoryRoot, relativePath));
const packageJson = JSON.parse(read("package.json")) as { scripts: Record<string, string>; version: string };
const manifest = JSON.parse(read("scripts/quality/quality-pipeline.json")) as {
  groups: Array<{ id: string; gates: string[] }>;
  gates: Array<{ id: string; entry: string; steps: Array<{ type: string; entry?: string; nodeArgs?: string[] }> }>;
};

const retiredPaths = [
  "scripts/bootstrap-application-composition.mjs",
  "scripts/quality/gate-migration-manifest.json",
  "scripts/quality/run-legacy-gate.mjs",
  "tests/tooling/gate-migration-contract.test.mts",
];
for (const retiredPath of retiredPaths) assert.equal(exists(retiredPath), false, `${retiredPath} must stay retired.`);

const legacyWrappers = walkFiles(path.join(repositoryRoot, "scripts"), {
  include: (filePath: string, entryName: string) => path.dirname(filePath) === path.join(repositoryRoot, "scripts") && /^check-.*\.(?:cjs|mjs|mts)$/u.test(entryName),
}).map((filePath: string) => path.relative(repositoryRoot, filePath).replaceAll(path.sep, "/"));
assert.deepEqual(legacyWrappers, [], `Legacy gate wrappers must stay removed:\n${legacyWrappers.join("\n")}`);

assert.equal(exists("tests/fixtures/runtime/bootstrap-demo-application-composition.mjs"), true);
const manifestText = read("scripts/quality/quality-pipeline.json");
assert.equal(manifestText.includes("scripts/bootstrap-application-composition.mjs"), false);
assert.equal(manifestText.includes("gate-migration"), false);
assert.ok(manifestText.includes("tests/fixtures/runtime/bootstrap-demo-application-composition.mjs"));
assert.equal(manifest.gates.some((gate) => gate.id === "quality.gate-migration-contract"), false);
assert.equal(manifest.gates.some((gate) => gate.id === "quality.ci-release-contract"), true);

assert.equal(Object.keys(packageJson.scripts).length, 23, "The public command surface must remain compact.");
for (const command of ["security:scan", "release:prepare", "release:check", "api:check", "quality:gate", "quality:group"]) {
  assert.ok(packageJson.scripts[command], `Missing public command ${command}.`);
}
for (const command of Object.keys(packageJson.scripts)) {
  assert.equal(command.startsWith("check:"), false, `Legacy check alias returned: ${command}`);
  assert.equal(/^test:.+/u.test(command), false, `Legacy individual test alias returned: ${command}`);
}

const workflow = read(".github/workflows/quality.yml");
const orderedMarkers = [
  "01 Secret scan",
  "02 Dependency and lock policy",
  "03 Lint and typecheck",
  "04 Architecture",
  "05 OpenAPI and generated drift",
  "06 Unit and contract",
  "07 Integration and route smoke",
  "08 Critical journeys",
  "09 Production build",
  "10 Real backend contract",
  "12 Connected browser acceptance",
  "13 Source release evidence",
];
let previousIndex = -1;
for (const marker of orderedMarkers) {
  const index = workflow.indexOf(marker);
  assert.ok(index > previousIndex, `CI step order drifted at ${marker}.`);
  previousIndex = index;
}
assert.ok(workflow.includes("npm run security:scan"));
assert.ok(workflow.indexOf("npm run security:scan") < workflow.indexOf("npm ci --ignore-scripts"), "Secret scan must run before dependency installation.");
assert.ok(workflow.includes("actions/checkout@v6"));
assert.ok(workflow.includes("actions/setup-node@v6"));
assert.ok(workflow.includes("actions/upload-artifact@v7"));
assert.ok(workflow.includes("permissions:\n  contents: read"));
assert.ok(workflow.includes("npm run release:prepare"));
assert.ok(workflow.includes("npm run release:check"));

assert.equal(releasePolicy.archiveName, "unicorecrm-web.zip");
assert.equal(releasePolicy.rootDirectory, "unicorecrm-web");
const sourceFiles = collectReleaseFiles();
assert.ok(sourceFiles.length > 1_000, "Release source inventory is unexpectedly small.");
// Derived from the release policy rather than a hand-written subset, so the artifact rule
// cannot drift from the policy that defines it. This gate owns artifact hygiene: it is the
// only place where a real archive exists, which is why the repository-scoped contract gate
// asserts the policy instead of probing the working tree for node_modules/dist/.git.
assert.ok(releasePolicy.excludedDirectories.length > 0, "Release policy must exclude at least one directory.");
for (const excluded of releasePolicy.excludedDirectories) {
  assert.equal(
    sourceFiles.some((file) => file.relativePath === excluded || file.relativePath.startsWith(`${excluded}/`)),
    false,
    `Release source inventory must not contain ${excluded}/.`,
  );
}
assert.equal(sourceFiles.some((file) => file.relativePath === ".env.example"), true);
assert.equal(sourceFiles.some((file) => file.relativePath === ".env"), false, "Environment secrets must never enter the release inventory.");

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "unicore-release-contract-"));
try {
  const archivePath = path.join(temporaryDirectory, "unicorecrm-web.zip");
  createSourceArchive(archivePath);
  const firstBytes = fs.readFileSync(archivePath);
  createSourceArchive(archivePath);
  const secondBytes = fs.readFileSync(archivePath);
  assert.equal(firstBytes.equals(secondBytes), true, "Source ZIP generation must be deterministic.");
  const inspection = inspectSourceArchive(archivePath);
  assert.equal(inspection.entries.length, sourceFiles.length);
  assert.equal(inspection.entries.some((entry) => isForbiddenArchiveEntry(entry.name)), false);
  assert.deepEqual(new Set(inspection.entries.map((entry) => entry.name.split("/")[0])), new Set(["unicorecrm-web"]));
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

const sbom = createCycloneDxSbom();
assert.equal(sbom.bomFormat, "CycloneDX");
assert.equal(sbom.specVersion, "1.5");
assert.equal(sbom.metadata.component.version, packageJson.version);
assert.ok(sbom.components.length >= 250, "SBOM dependency inventory is unexpectedly small.");
assert.equal(new Set(sbom.components.map((component) => component["bom-ref"])).size, sbom.components.length);

const forbiddenLegacyReferences = [
  ...walkFiles(path.join(repositoryRoot, "scripts"), {
    excludeDirectory: (entryName: string) => ["artifacts", "coverage", "dist", "node_modules"].includes(entryName),
    include: (_filePath: string, entryName: string) => /\.(?:cjs|js|json|mjs|mts|ts|tsx|ya?ml)$/u.test(entryName),
  }),
  ...walkFiles(path.join(repositoryRoot, "tests"), {
    excludeDirectory: (entryName: string) => ["artifacts", "coverage", "dist", "node_modules", "playwright-report", "test-results"].includes(entryName),
    include: (_filePath: string, entryName: string) => /\.(?:cjs|js|json|mjs|mts|ts|tsx|ya?ml)$/u.test(entryName),
  }),
].filter((filePath: string) => {
  const relativePath = path.relative(repositoryRoot, filePath).replaceAll(path.sep, "/");
  if ([
    "tests/quality/architecture/check-ci-release-contract.mts",
    "tests/quality/architecture/check-quality-pipeline.mts",
  ].includes(relativePath)) return false;
  const source = fs.readFileSync(filePath, "utf8");
  return source.includes("run-legacy-gate.mjs") || source.includes("gate-migration-manifest.json") || source.includes("scripts/bootstrap-application-composition.mjs");
}).map((filePath: string) => path.relative(repositoryRoot, filePath).replaceAll(path.sep, "/"));
assert.deepEqual(forbiddenLegacyReferences, [], `Retired tooling references remain:\n${forbiddenLegacyReferences.join("\n")}`);

console.log(`CI/release contract: PASS (${manifest.gates.length} gates, ${sourceFiles.length} source files, ${sbom.components.length} SBOM components, zero legacy wrappers).`);
