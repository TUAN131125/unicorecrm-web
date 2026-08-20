import { walkFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = repositoryRoot;
const manifestPath = path.join(root, "scripts/repository-cleanup/removed-paths.json");
const inventoryPath = path.join(root, "docs/quality/repository-inventory.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));

const excludedDirectories = new Set([".git", "node_modules", "dist", "coverage", "artifacts"]);
const searchableExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs", ".cjs", ".json", ".md"]);
const excludedFiles = new Set([
  "scripts/repository-cleanup/removed-paths.json",
  "docs/quality/repository-inventory.json",
  "docs/quality/repository-inventory.md",
  "tests/quality/architecture/check-studio-single-authority.mts",
  "tests/quality/architecture/check-studio-api-contract.mts",
  "tests/quality/architecture/check-studio-v1-removal.mts",
  "tests/quality/integration/check-workspace-governance-contracts.mts",
]);

const repositoryFiles = walkFiles(root, {
  excludeDirectory: (entryName) => excludedDirectories.has(entryName),
  include: (_filePath, entryName) => searchableExtensions.has(path.extname(entryName)),
  sort: false,
});

for (const removedPath of manifest.removedPaths) {
  assert.equal(fs.existsSync(path.join(root, removedPath)), false, `${removedPath} was removed and must not return.`);
}

const staleReferences = [];
for (const absolute of repositoryFiles) {
  const relative = path.relative(root, absolute).replaceAll("\\", "/");
  if (excludedFiles.has(relative)) continue;
  const source = fs.readFileSync(absolute, "utf8");
  for (const removedPath of manifest.removedPaths) {
    if (source.includes(removedPath)) staleReferences.push(`${relative} -> ${removedPath}`);
  }
}
assert.deepEqual(staleReferences, [], `Repository files still reference removed compatibility/dead paths:\n${staleReferences.join("\n")}`);

const deadCandidates = inventory.fileClassifications
  .filter((entry) => entry.classification === "dead-candidate")
  .map((entry) => entry.path);
assert.deepEqual(deadCandidates, [], `Unreviewed dead-code candidates remain:\n${deadCandidates.join("\n")}`);

const unownedCompatibility = inventory.fileClassifications
  .filter((entry) => entry.classification === "compatibility")
  .filter((entry) => !entry.usage.runtimeReachable && !entry.usage.testReachable && !entry.usage.scriptReachable)
  .map((entry) => entry.path);
assert.deepEqual(unownedCompatibility, [], `Compatibility files without a runtime/test/tooling consumer remain:\n${unownedCompatibility.join("\n")}`);

assert.equal(inventory.summary.duplicateGroups, 0, "Exact-content duplicate files must not return.");

console.log(`[repository-cleanup] PASS — ${manifest.removedPaths.length} removed paths protected, zero dead candidates, zero unowned compatibility files.`);
