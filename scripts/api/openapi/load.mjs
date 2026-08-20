import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../quality/core/repo-context.mjs";

export const openApiPaths = Object.freeze({
  spec: "docs/api/openapi.json",
  checksum: "docs/api/openapi.sha256",
  generatedManifest: "docs/api/generated-client-manifest.json",
  coverageLedger: "docs/api/operation-coverage-ledger.json",
  breakingBaseline: "docs/api/openapi-breaking-baseline.json",
  ownership: "scripts/api/openapi/client-ownership.json",
});

export function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8"));
}

export function loadOpenApiContract() {
  const source = fs.readFileSync(path.join(repositoryRoot, openApiPaths.spec), "utf8");
  return {
    source,
    document: JSON.parse(source),
    sha256: crypto.createHash("sha256").update(source).digest("hex"),
  };
}

export function loadClientOwnership() {
  return readJson(openApiPaths.ownership);
}

export function loadQualityGateIds() {
  const manifest = readJson("scripts/quality/quality-pipeline.json");
  return new Set((manifest.gates ?? []).map((gate) => gate.id));
}
