import { walkFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = repositoryRoot;
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const readJson = <T,>(relative: string): T => JSON.parse(read(relative)) as T;

const packageJson = readJson<{
  version: string;
  description?: string;
  scripts: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}>("package.json");
const release = readJson<{
  status: string;
  sourceScope: string;
  backendApiContractStatus: string;
  contractAuthorities: string[];
}>("docs/quality/release-identity.json");
const manifest = readJson<{ outputs: string[] }>("docs/api/generated-client-manifest.json");

assert.equal(fs.existsSync(path.join(root, "backend")), false, "The frontend source package must not contain an executable backend implementation.");
for (const dependency of ["pg", "@electric-sql/pglite", "@types/pg", "express", "dotenv", "@types/express"]) {
  assert.equal(packageJson.dependencies?.[dependency], undefined, `${dependency} must not be a frontend production dependency.`);
  assert.equal(packageJson.devDependencies?.[dependency], undefined, `${dependency} must not be a frontend development dependency.`);
}
for (const script of Object.keys(packageJson.scripts)) {
  assert.doesNotMatch(script, /^backend:|^typecheck:backend$|^test:backend-|^check:(?:backend-platform|financial-backend|commercial-backend)/, `Wrong-stack backend script remains: ${script}`);
  assert.doesNotMatch(packageJson.scripts[script] ?? "", /(?:^|\s)backend\//, `Package script ${script} still executes repository-local backend code.`);
}
assert.ok(packageJson.description?.includes("Frontend reference implementation"));
assert.doesNotMatch(packageJson.description ?? "", /executable .*backend vertical slice/i);
assert.equal(release.status, "QUALITY_BASELINE_REMEDIATION_CANDIDATE");
assert.equal(release.sourceScope, "FRONTEND_QUALITY_AND_RUNTIME_REMEDIATION");
assert.equal(release.backendApiContractStatus, "OPENAPI_3_1_SUPPORT_READY_WITH_EXTERNAL_BLOCKERS");
assert.ok(release.contractAuthorities.includes("docs/architecture/dotnet-sqlserver-backend-target.md"));
assert.ok(release.contractAuthorities.includes("tests/quality/architecture/check-frontend-backend-separation.mts"));
assert.ok(release.contractAuthorities.includes("docs/quality/connected-backend-acceptance.md"));
assert.ok(release.contractAuthorities.includes("tests/quality/integration/check-connected-backend-integration.mts"));
assert.ok(manifest.outputs.length >= 4);
assert.ok(
  manifest.outputs.every((output) =>
    output.startsWith("src/platform/api/generated/") ||
    output.startsWith("src/platform/api/contracts/generated") ||
    output === "src/platform/api/catalog/generatedApiOperationCatalog.ts" ||
    output === "docs/api/api-operation-catalog.json" ||
    output === "docs/backend-readiness/operation-contract-status.json",
  ),
  "Generated artifacts must remain frontend-repository-owned and cannot create backend implementation.",
);

const generator = read("scripts/api/generate-openapi-client.mjs");
assert.doesNotMatch(generator, /backend\/src\/generated|renderBackendContract|backendContractSource/);
const architecture = read("ARCHITECTURE.md");
assert.doesNotMatch(architecture, /^backend\//m);
assert.match(architecture, /ASP\.NET Core modular monolith/);
const target = read("docs/architecture/dotnet-sqlserver-backend-target.md");
for (const token of ["Clean Architecture", "CQRS", "MediatR", "FluentValidation", "SQL Server", "Entity Framework Core", "rowversion", "decimal"]) {
  assert.ok(target.includes(token), `Backend target is missing ${token}.`);
}

const sourceFiles = walk(path.join(root, "src")).filter((file) => /\.(?:ts|tsx|js|jsx|mts|mjs)$/.test(file));
const backendImports = sourceFiles.flatMap((file) => {
  const source = fs.readFileSync(file, "utf8");
  return /(?:from\s+["'][^"']*backend\/|import\(["'][^"']*backend\/)/.test(source)
    ? [path.relative(root, file).replaceAll(path.sep, "/")]
    : [];
});
assert.deepEqual(backendImports, [], `Frontend files import backend implementation paths:\n${backendImports.join("\n")}`);

for (const [directory, file] of [
  ["docs/architecture", "backend-platform-foundation.md"],
  ["docs/architecture", "financial-backend-vertical-slice.md"],
  ["docs/architecture", "commercial-backend-vertical-slice.md"],
  ["docs/quality", "backend-platform-foundation-verification.md"],
  ["docs/quality", "financial-vertical-slice-verification.md"],
  ["docs/quality", "commercial-vertical-slice-verification.md"],
] as const) {
  const deletedDoc = `${directory}/${file}`;
  assert.equal(fs.existsSync(path.join(root, directory, file)), false, `${deletedDoc} must not return as current frontend authority.`);
}

console.log(`Frontend/backend separation: PASS (${packageJson.version}, ${manifest.outputs.length} frontend generated artifacts).`);

function walk(directory: string): string[] {
  return walkFiles(directory, {
    excludeDirectory: (entryName) => ["node_modules", "dist", ".git", "coverage"].includes(entryName),
    sort: false,
  });
}
