import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export function validateRepositoryInventory(value) {
  if (!value || typeof value !== "object" || value.schemaVersion !== 1) throw new Error("Invalid inventory schemaVersion");
  if (!value.authority || typeof value.authority.generator !== "string" || typeof value.authority.checker !== "string") throw new Error("Missing inventory authority");
  if (!value.summary || typeof value.summary !== "object") throw new Error("Missing inventory summary");
  for (const field of ["repositoryFiles", "sourceFiles", "modules", "routes", "capabilities", "workflows"]) {
    if (!Number.isInteger(value.summary[field]) || value.summary[field] < 0) throw new Error(`Invalid inventory summary.${field}`);
  }
  for (const field of ["modules", "routes", "loadableRouteModules", "capabilities", "workspaceFlags", "workflows", "publicExports", "repositories", "browserEvents", "mockAndDefaultData", "compatibilityCandidates", "deprecatedComponents", "duplicateGroups", "largeFiles", "circularDependencies", "fileClassifications", "criticalJourneys", "qualityPipeline"]) {
    if (!Array.isArray(value[field])) throw new Error(`Missing inventory ${field}`);
  }
  if (!value.persistence || !Array.isArray(value.persistence.entries) || !value.verificationContract || !Array.isArray(value.verificationContract.requiredCommands)) throw new Error("Missing inventory persistence/verification contract");
  if (typeof value.inventoryFingerprint !== "string" || !/^[a-f0-9]{64}$/u.test(value.inventoryFingerprint)) throw new Error("Invalid inventory fingerprint");
}

export function writeValidatedInventory(jsonPath, markdownPath, json, markdown) {
  const suffix = `.tmp-${process.pid}-${crypto.randomUUID()}`;
  const jsonTemp = jsonPath + suffix;
  const markdownTemp = markdownPath + suffix;
  try {
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonTemp, json, "utf8");
    validateRepositoryInventory(JSON.parse(fs.readFileSync(jsonTemp, "utf8")));
    fs.writeFileSync(markdownTemp, markdown, "utf8");
    // Both outputs are fully generated and JSON validated before replacing either.
    fs.renameSync(jsonTemp, jsonPath);
    fs.renameSync(markdownTemp, markdownPath);
  } finally {
    fs.rmSync(jsonTemp, { force: true });
    fs.rmSync(markdownTemp, { force: true });
  }
}
