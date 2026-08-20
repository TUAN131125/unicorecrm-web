import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { loadClientOwnership, loadOpenApiContract, loadQualityGateIds } from "./openapi/load.mjs";
import { validateDocument } from "./openapi/validate.mjs";
import { normalizeOpenApi } from "./openapi/normalize.mjs";
import { renderGeneratedArtifacts as renderArtifacts } from "./openapi/render.mjs";
import { acceptBreakingBaseline, checkGeneratedArtifacts, generatedOutputs, writeGeneratedArtifacts } from "./openapi/write-or-check.mjs";

export { loadOpenApiContract } from "./openapi/load.mjs";
export { findBreakingChanges } from "./openapi/breaking-changes.mjs";

export function prepareOpenApiGeneration() {
  const contract = loadOpenApiContract();
  const ownership = loadClientOwnership();
  validateDocument(contract.document, ownership, loadQualityGateIds());
  const normalized = normalizeOpenApi(contract.document, ownership);
  return { ...contract, ownership, normalized };
}

export function renderGeneratedArtifacts() {
  const prepared = prepareOpenApiGeneration();
  return { ...renderArtifacts(prepared.normalized, prepared.sha256), normalized: prepared.normalized };
}

function runCli() {
  const checkOnly = process.argv.includes("--check");
  const acceptBaseline = process.argv.includes("--accept-breaking-baseline");
  if (checkOnly && acceptBaseline) throw new Error("--check and --accept-breaking-baseline cannot be combined.");
  const artifacts = renderGeneratedArtifacts();
  if (acceptBaseline) acceptBreakingBaseline(artifacts.normalized);
  if (checkOnly) {
    checkGeneratedArtifacts(artifacts, artifacts.normalized);
    console.log(`[openapi-generator] PASS (${artifacts.document.info.version}, ${artifacts.normalized.operations.length} operations, ${artifacts.sha256})`);
    return;
  }
  writeGeneratedArtifacts(artifacts);
  console.log(`[openapi-generator] wrote ${generatedOutputs(artifacts).length} deterministic artifacts`);
  console.log(`[openapi-generator] contract ${artifacts.document.info.version} (${artifacts.sha256})`);
  if (acceptBaseline) console.log("[openapi-generator] accepted reviewed breaking-change baseline");
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) runCli();
