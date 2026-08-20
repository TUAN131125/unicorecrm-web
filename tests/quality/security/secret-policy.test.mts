import { walkFiles } from "../../../scripts/quality/core/filesystem.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadSecretPolicy,
  scanRepository,
  scanText,
} from "../../../scripts/security/scan-current-tree.mjs";
import {
  FORBIDDEN_BROWSER_ENVIRONMENT_NAMES,
  PROVIDER_SHAPED_SECURITY_VALUES,
  SAFE_OPAQUE_SECURITY_VALUE,
} from "../../fixtures/security-values.ts";
import {
  DEVELOPMENT_IDENTITY_FIXTURES,
  DEVELOPMENT_MFA_CODE_FIXTURE,
} from "../../fixtures/development-identities.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const canonicalCatalog = "src/platform/identity-auth/development/developmentIdentityCatalog.ts";
const adapterPath = "src/platform/identity-auth/infrastructure/DevelopmentAuthAdapter.ts";
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

for (const [label, value] of Object.entries(PROVIDER_SHAPED_SECURITY_VALUES)) {
  assert.ok(scanText(value, label).length > 0, `Detector coverage missing for ${label}.`);
}
assert.deepEqual(scanText(SAFE_OPAQUE_SECURITY_VALUE), [], "Opaque test values must not be classified as provider credentials.");
for (const environmentName of FORBIDDEN_BROWSER_ENVIRONMENT_NAMES) {
  assert.ok(
    scanText(environmentName, "browser-environment").some((finding) => finding.detector === "browser-exposed-secret-name"),
    `Browser secret environment name was not rejected: ${environmentName}`,
  );
}

const policy = loadSecretPolicy(root);
assert.equal(policy.schemaVersion, 1);
assert.deepEqual(policy.allowlist, [], "The initial secret policy must not suppress findings.");
const repositoryScan = scanRepository(root, policy);
assert.deepEqual(
  repositoryScan.findings,
  [],
  `Current tree contains unmanaged high-confidence secret findings:\n${repositoryScan.findings.map((finding) => `${finding.file}:${finding.line} ${finding.detector}`).join("\n")}`,
);

const adapterSource = read(adapterPath);
assert.ok(adapterSource.includes("../development/developmentIdentityCatalog"), "DevelopmentAuthAdapter must consume the canonical development identity owner.");
assert.equal(/password:\s*["']/u.test(adapterSource), false, "DevelopmentAuthAdapter must not duplicate development credentials.");
assert.equal(adapterSource.includes("const DEVELOPMENT_MFA_CODE"), false, "DevelopmentAuthAdapter must not duplicate the development MFA fixture.");

const identityValues = new Set(DEVELOPMENT_IDENTITY_FIXTURES.map((account) => account.password));
identityValues.add(DEVELOPMENT_MFA_CODE_FIXTURE);
for (const value of identityValues) {
  const ownerFiles = walkFiles(path.join(root, "src"), {
    include: (_filePath: string, entryName: string) => /\.(?:ts|tsx|mts|mjs|js|jsx)$/u.test(entryName),
  })
    .filter((absolute) => fs.readFileSync(absolute, "utf8").includes(value))
    .map((absolute) => path.relative(root, absolute).replaceAll("\\", "/"));
  assert.deepEqual(ownerFiles, [canonicalCatalog], `Development identity value must have one source owner: ${value}`);
}

const connectedBoundaryFiles = [
  "src/app/bootstrap/applicationBootstrap.ts",
  "src/app/composition/applicationComposition.ts",
  "src/app/composition/connectedApplicationServiceBundle.ts",
];
for (const file of connectedBoundaryFiles) {
  const source = read(file);
  for (const forbiddenImport of policy.forbiddenConnectedIdentityImports) {
    assert.equal(source.includes(forbiddenImport), false, `${file} must not import development identity authority: ${forbiddenImport}`);
  }
}

console.log(`[secret-policy] PASS — ${repositoryScan.scannedFiles} text files scanned; development identity ownership and connected boundary protected.`);

