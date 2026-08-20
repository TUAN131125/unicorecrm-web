import { walkFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = repositoryRoot;
const sourceRoot = path.join(root, "src");
const retiredDataModule = path.join(sourceRoot, "data.ts");
const retiredGlobalMockDirectory = path.join(sourceRoot, "mocks", "data");
const codeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs", ".cjs"]);
const excludedDirectories = new Set(["node_modules", "dist", "coverage", ".git"]);

function listCodeFiles(directory) {
  return walkFiles(directory, {
    excludeDirectory: (entryName) => excludedDirectories.has(entryName),
    include: (_filePath, entryName) => codeExtensions.has(path.extname(entryName)),
    sort: false,
  });
}

assert.equal(fs.existsSync(retiredDataModule), false, "The retired root-level data barrel must not return.");
assert.equal(fs.existsSync(retiredGlobalMockDirectory), false, "Global mock-data ownership must not return.");

const violations = [];
for (const file of listCodeFiles(root)) {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  if (relative === "tests/quality/architecture/check-global-data-boundaries.mjs") continue;
  const source = fs.readFileSync(file, "utf8");
  if (/from\s*["']@\/data["']|import\s*\(\s*["']@\/data["']\s*\)/.test(source)) {
    violations.push(`${relative}: imports the retired global data barrel`);
  }
  if (/from\s*["'][^"']*\/mocks\/data(?:\/[^"']*)?["']/.test(source)) {
    violations.push(`${relative}: imports global mock data`);
  }
  if (relative.includes("/presentation/") && /from\s*["'][^"']*\/dev-memory\//.test(source)) {
    violations.push(`${relative}: presentation imports a dev-memory seed directly`);
  }
  if (relative.startsWith("src/dev/") || relative.startsWith("src/test/")) continue;
  if (/from\s*["']@\/(?:dev|test)\//.test(source)) {
    violations.push(`${relative}: production source imports dev/test-only data`);
  }
}
assert.deepEqual(violations, [], `Global data-boundary violations:\n${violations.join("\n")}`);

const workspaceDefaults = path.join(sourceRoot, "platform", "workspace-config", "workspaceConfigDefaults.ts");
const leadSeed = path.join(sourceRoot, "modules", "leads", "infrastructure", "dev-memory", "leadDemoSeed.ts");
const productSeed = path.join(sourceRoot, "modules", "products", "infrastructure", "dev-memory", "productDemoSeed.ts");
for (const required of [workspaceDefaults, leadSeed, productSeed]) {
  assert.equal(fs.existsSync(required), true, `Required owner-scoped data source is missing: ${path.relative(root, required)}`);
}
const defaultsSource = fs.readFileSync(workspaceDefaults, "utf8");
assert.match(defaultsSource, /export const CRM_WORKSPACE_CONFIG_PRESETS/);
assert.match(defaultsSource, /export const DEFAULT_CRM_WORKSPACE_CONFIG/);
assert.doesNotMatch(defaultsSource, /\bMOCK_/);

console.log("[global-data-boundaries] PASS — global data barrel removed; defaults and demo seeds have explicit owners.");
