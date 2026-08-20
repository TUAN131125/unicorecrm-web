import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = repositoryRoot;
const baselinePath = path.join(root, "scripts/baselines/contact-visual-baseline.json");
const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8")) as {
  globalStyleFile: string;
  globalStyleSha256: string;
  files: Array<{ path: string; requiredClassFragments: string[] }>;
};

const globalCss = fs.readFileSync(path.join(root, baseline.globalStyleFile));
const globalCssHash = crypto.createHash("sha256").update(globalCss).digest("hex");
assert.equal(
  globalCssHash,
  baseline.globalStyleSha256,
  "Global CSS changed during canonical logic migration. Update the visual baseline only after an explicit UI decision.",
);

for (const entry of baseline.files) {
  const filePath = path.join(root, entry.path);
  assert.ok(fs.existsSync(filePath), `Missing Contact visual reference file: ${entry.path}`);
  const source = fs.readFileSync(filePath, "utf8");
  for (const fragment of entry.requiredClassFragments) {
    assert.ok(
      source.includes(fragment),
      `${entry.path} no longer contains required Contact visual fragment: ${fragment}`,
    );
  }
}

console.log("Contact visual baseline: OK");
