import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = repositoryRoot;
const lockPath = path.join(root, "package-lock.json");
assert.ok(fs.existsSync(lockPath), "package-lock.json must exist");

const lock = JSON.parse(fs.readFileSync(lockPath, "utf8")) as {
  packages?: Record<string, { resolved?: string }>;
};

const forbiddenPatterns = [
  /applied-caas/i,
  /internal\.api\.openai\.org/i,
  /localhost/i,
  /127\.0\.0\.1/i,
];

const invalid: Array<{ packagePath: string; resolved: string }> = [];
for (const [packagePath, metadata] of Object.entries(lock.packages ?? {})) {
  const resolved = metadata.resolved;
  if (!resolved) continue;
  if (forbiddenPatterns.some((pattern) => pattern.test(resolved))) {
    invalid.push({ packagePath, resolved });
  }
}

assert.equal(
  invalid.length,
  0,
  `package-lock.json contains non-portable registry URLs:\n${invalid
    .map((entry) => `- ${entry.packagePath}: ${entry.resolved}`)
    .join("\n")}`,
);

console.log("Package lock registry portability: PASS");
