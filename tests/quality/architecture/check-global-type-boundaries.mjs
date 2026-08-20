import { walkFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = repositoryRoot;
const sourceRoot = path.join(root, "src");
const retiredTypeBarrel = path.join(sourceRoot, "types.ts");
const retiredTypeDirectory = path.join(sourceRoot, "types");
const retiredProductTypeBarrel = path.join(sourceRoot, "features", "products", "product.types.ts");
const codeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs", ".cjs"]);
const excludedDirectories = new Set(["node_modules", "dist", "coverage", ".git"]);

function listCodeFiles(directory) {
  return walkFiles(directory, {
    excludeDirectory: (entryName) => excludedDirectories.has(entryName),
    include: (_filePath, entryName) => codeExtensions.has(path.extname(entryName)),
    sort: false,
  });
}

assert.equal(fs.existsSync(retiredTypeBarrel), false, "The retired root-level type barrel must not return.");
assert.equal(fs.existsSync(retiredTypeDirectory), false, "The retired root-level type directory must not return.");
assert.equal(fs.existsSync(retiredProductTypeBarrel), false, "The retired Product type forwarding barrel must not return.");

const violations = [];
for (const file of listCodeFiles(root)) {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  if (relative === "tests/quality/architecture/check-global-type-boundaries.mjs") continue;
  const source = fs.readFileSync(file, "utf8");
  if (/from\s*["']@\/types["']|import\s*\(\s*["']@\/types["']\s*\)/.test(source)) {
    violations.push(`${relative}: imports the retired global type barrel`);
  }
  for (const match of source.matchAll(/(?:from\s*|import\s*\(\s*)["']([^"']+)["']/g)) {
    const specifier = match[1];
    if (!specifier.startsWith(".")) continue;
    const resolved = path.resolve(path.dirname(file), specifier);
    if (resolved === path.join(sourceRoot, "types")) {
      violations.push(`${relative}: resolves a relative import to the retired global type barrel`);
    }
  }
  if (/from\s*["'][^"']*\/types\/supportCases["']/.test(source)) {
    violations.push(`${relative}: imports the retired support type forwarding barrel`);
  }
}
assert.deepEqual(violations, [], `Global type-boundary violations:\n${violations.join("\n")}`);

const requiredOwners = [
  "src/platform/workspace-config/workspaceConfig.types.ts",
  "src/platform/workspace-config/workspaceTerminology.ts",
  "src/modules/leads/presentation/model/leadTable.types.ts",
  "src/modules/leads/domain/model/lead.types.ts",
  "src/modules/contacts/domain/model/contact.types.ts",
  "src/modules/customers/presentation/model/customerDisplay.types.ts",
  "src/modules/deals/domain/model/deal.types.ts",
  "src/modules/quotes/domain/model/quote.types.ts",
  "src/modules/products/domain/model/product.types.ts",
  "src/modules/support/domain/model/supportCase.types.ts",
  "src/shared/order-to-cash/quoteApprovalPolicy.ts",
];
for (const owner of requiredOwners) {
  assert.equal(fs.existsSync(path.join(root, owner)), true, `Required type owner is missing: ${owner}`);
}

const workspaceTypes = fs.readFileSync(path.join(root, requiredOwners[0]), "utf8");
assert.match(workspaceTypes, /export type CrmWorkspaceConfig/);
assert.match(workspaceTypes, /export type CrmModuleVisibilityConfig/);
assert.doesNotMatch(workspaceTypes, /export\s+(?:interface|type)\s+Customer\b/);

console.log("[global-type-boundaries] PASS — root type barrel removed; business and presentation types have explicit owners.");
