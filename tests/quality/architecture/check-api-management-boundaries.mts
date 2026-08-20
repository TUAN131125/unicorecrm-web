import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";

const root = repositoryRoot;
const srcRoot = path.join(root, "src");
const canonicalRoots = [
  "src/platform/api/client",
  "src/platform/api/errors",
  "src/platform/api/contracts",
  "src/platform/api/generated",
  "src/platform/api/catalog",
  "src/platform/api/runtime",
  "src/platform/api/module-boundary",
];
for (const relative of canonicalRoots) assert.equal(fs.existsSync(path.join(root, relative)), true, `Missing canonical API boundary: ${relative}`);
const retiredRoots = [["src", "shared", "api"].join("/"), ["src", "shared", "http"].join("/")];
for (const retired of retiredRoots) assert.equal(fs.existsSync(path.join(root, retired)), false, `${retired} must remain retired.`);
for (const required of [
  "src/platform/api/index.ts",
  "src/platform/api/catalog/generatedApiOperationCatalog.ts",
  "src/platform/api/module-boundary/ModuleApiBoundary.ts",
  "docs/api/api-operation-catalog.json",
  "docs/architecture/module-api-boundary-template.md",
]) assert.equal(fs.existsSync(path.join(root, required)), true, `Missing API management artifact: ${required}`);

const sourceFiles = walkAllFiles(srcRoot).filter((file) => /\.(?:ts|tsx)$/u.test(file));
const violations: string[] = [];
for (const file of sourceFiles) {
  const relative = toPosix(path.relative(root, file));
  const source = fs.readFileSync(file, "utf8");
  const retiredImportRoots = [["@", "shared", "api"].join("/"), ["@", "shared", "http"].join("/")];
  if (retiredImportRoots.some((value) => source.includes(value))) violations.push(`${relative}: imports a retired shared API boundary.`);
  for (const specifier of importSpecifiers(source)) validateImport(relative, specifier, violations);
}
assert.deepEqual(violations, [], `API boundary violations:\n${violations.join("\n")}`);

const catalog = JSON.parse(fs.readFileSync(path.join(root, "docs/api/api-operation-catalog.json"), "utf8")) as ApiOperationCatalog;
const spec = JSON.parse(fs.readFileSync(path.join(root, "docs/api/openapi.json"), "utf8")) as OpenApiDocument;
const operationIds = collectOperationIds(spec);
assert.equal(catalog.authority, "docs/api/openapi.json");
assert.equal(catalog.summary.operations, operationIds.length);
assert.equal(new Set(catalog.operations.map((operation) => operation.operationId)).size, operationIds.length);
assert.deepEqual(catalog.operations.map((operation) => operation.operationId).sort(), operationIds.sort());
for (const operation of catalog.operations) {
  assert.ok(operation.generatedClient.file.startsWith("src/platform/api/generated/"), `${operation.operationId} has non-canonical generated ownership.`);
  assert.ok(operation.generatedClient.method.length > 0, `${operation.operationId} has no generated method.`);
  assert.ok(operation.moduleId.length > 0, `${operation.operationId} has no module owner.`);
  assert.ok(operation.authorization.capability, `${operation.operationId} has no capability.`);
  if (["platform/identity-auth", "platform/workspace-context"].includes(operation.moduleId)) assert.equal(operation.authorization.workspace, "NOT_REQUIRED", `${operation.operationId} resolves before business workspace headers exist.`);
  else assert.equal(operation.authorization.workspace, "REQUIRED", `${operation.operationId} must declare workspace authority.`);
}

console.log(`API management boundaries: PASS (${catalog.summary.operations} cataloged operations; canonical platform boundary; no retired imports).`);

function validateImport(file: string, specifier: string, errors: string[]): void {
  const isModuleRestrictedLayer = /^src\/modules\/[^/]+\/(?:domain|application|presentation|public)\//u.test(file)
    || /^src\/modules\/[^/]+\/index\.ts$/u.test(file)
    || /^src\/workflows\/[^/]+\/(?:domain|application|presentation|public)\//u.test(file)
    || /^src\/workflows\/[^/]+\/index\.ts$/u.test(file);
  if (isModuleRestrictedLayer && (specifier === "@/platform/api" || specifier.startsWith("@/platform/api/"))) {
    errors.push(`${file}: ${specifier} bypasses the module application boundary.`);
  }

  const importsGenerated = specifier.startsWith("@/platform/api/generated") || specifier.includes("/platform/api/generated/");
  if (importsGenerated && !isGeneratedConsumerAllowed(file)) {
    errors.push(`${file}: generated API clients may only be imported by infrastructure or app composition (${specifier}).`);
  }

  const importsRuntime = specifier.startsWith("@/platform/api/runtime") || specifier.includes("/platform/api/runtime/");
  if (importsRuntime && !file.startsWith("src/platform/api/") && !file.startsWith("src/app/composition/")) {
    errors.push(`${file}: platform API runtime executors are composition-only (${specifier}).`);
  }
}

function isGeneratedConsumerAllowed(file: string): boolean {
  return file.startsWith("src/platform/api/")
    || file.startsWith("src/app/composition/")
    || file.startsWith("src/app/bootstrap/")
    || /^src\/modules\/[^/]+\/infrastructure\//u.test(file)
    || /^src\/platform\/[^/]+\/infrastructure\//u.test(file)
    || /^src\/workflows\/[^/]+\/infrastructure\//u.test(file)
    || /^src\/workspaces\/[^/]+\/infrastructure\//u.test(file);
}

function importSpecifiers(source: string): string[] {
  const result: string[] = [];
  const pattern = /(?:import|export)\s+(?:type\s+)?(?:[^"'`]*?\s+from\s+)?["'`]([^"'`]+)["'`]/gu;
  for (const match of source.matchAll(pattern)) if (match[1]) result.push(match[1]);
  return result;
}

function collectOperationIds(document: OpenApiDocument): string[] {
  const result: string[] = [];
  for (const pathItem of Object.values(document.paths)) {
    for (const candidate of Object.values(pathItem)) {
      if (candidate && typeof candidate === "object" && typeof candidate.operationId === "string") result.push(candidate.operationId);
    }
  }
  return result;
}

function toPosix(value: string): string { return value.replaceAll(path.sep, "/"); }

interface ApiOperationCatalog {
  authority: string;
  summary: { operations: number };
  operations: Array<{
    operationId: string;
    moduleId: string;
    generatedClient: { file: string; method: string };
    authorization: { capability: string | null; workspace: string };
  }>;
}
interface OpenApiDocument { paths: Record<string, Record<string, { operationId?: string }>> }
