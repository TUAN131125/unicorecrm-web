import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = repositoryRoot;
const dist = path.join(root, "dist");
const manifestPath = path.join(dist, ".vite", "manifest.json");
const budgetBytes = 500 * 1024;

assert.ok(fs.existsSync(manifestPath), "Production build must emit dist/.vite/manifest.json for bundle-budget verification.");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const entry = Object.values(manifest).find((item) => item && typeof item === "object" && item.isEntry === true);
assert.ok(entry?.file, "Vite manifest must identify the application entry chunk.");

const javascriptFiles = walkAllFiles(path.join(dist, "assets")).filter((file) => file.endsWith(".js"));
assert.ok(javascriptFiles.length > 0, "Production build must emit JavaScript assets.");
const sizes = javascriptFiles.map((file) => ({
  file: path.relative(dist, file),
  bytes: fs.statSync(file).size,
}));
const entrySize = fs.statSync(path.join(dist, entry.file)).size;
const oversized = sizes.filter((asset) => asset.bytes > budgetBytes);

assert.ok(
  entrySize <= budgetBytes,
  `Application entry ${entry.file} is ${formatKiB(entrySize)} KiB; budget is ${formatKiB(budgetBytes)} KiB.`,
);
assert.deepEqual(
  oversized,
  [],
  `Every production JavaScript chunk must stay within ${formatKiB(budgetBytes)} KiB. Oversized: ${oversized.map((asset) => `${asset.file}=${formatKiB(asset.bytes)} KiB`).join(", ")}`,
);

const largest = [...sizes].sort((left, right) => right.bytes - left.bytes)[0];
console.log(`Bundle budget: PASS (entry ${formatKiB(entrySize)} KiB; largest ${largest.file} ${formatKiB(largest.bytes)} KiB; limit ${formatKiB(budgetBytes)} KiB)`);


function formatKiB(bytes) {
  return (bytes / 1024).toFixed(2);
}
