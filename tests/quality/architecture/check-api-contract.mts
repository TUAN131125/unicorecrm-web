import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import { OPENAPI_CONTRACT_VERSION, OPENAPI_SPEC_SHA256 } from "@/platform/api";
import { findBreakingChanges, renderGeneratedArtifacts } from "../../../scripts/api/generate-openapi-client.mjs";

const root = repositoryRoot;
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");
const readJson = <T,>(relativePath: string): T => JSON.parse(read(relativePath)) as T;
const artifacts = renderGeneratedArtifacts();
const spec = artifacts.document as OpenApiDocument;
const packageJson = readJson<{ version: string; scripts: Record<string, string> }>("package.json");
const release = readJson<ReleaseIdentity>("docs/quality/release-identity.json");
const manifest = readJson<GeneratedManifest>("docs/api/generated-client-manifest.json");
const coverage = readJson<CoverageLedger>("docs/api/operation-coverage-ledger.json");
const baseline = readJson<BreakingBaseline>("docs/api/openapi-breaking-baseline.json");

assert.equal(spec.openapi, "3.1.0");
assert.equal(spec["x-contract-authority"], "OPENAPI");
assert.equal(spec.security?.[0]?.bearerAuth?.length, 0);
assert.equal(spec.info.version, packageJson.version);
assert.equal(release.version, packageJson.version);
assert.equal(release.backendApiContractStatus, "OPENAPI_3_1_SUPPORT_READY_WITH_EXTERNAL_BLOCKERS");
assert.equal(OPENAPI_CONTRACT_VERSION, packageJson.version);
assert.equal(OPENAPI_SPEC_SHA256, artifacts.sha256);
assert.equal(manifest.specSha256, artifacts.sha256);
assert.equal(manifest.contractVersion, packageJson.version);
assert.equal(coverage.summary.operations, 270);
assert.equal(coverage.summary.productionReadyOperations, 236);
assert.equal(coverage.summary.blockedOperations, 34);

for (const [relativePath, expected] of [
  ["docs/api/openapi.sha256", artifacts.checksum],
  ["docs/api/generated-client-manifest.json", artifacts.manifestSource],
  ["docs/api/operation-coverage-ledger.json", artifacts.coverageSource],
  ["docs/api/api-operation-catalog.json", artifacts.operationCatalogJsonSource],
  ["src/platform/api/catalog/generatedApiOperationCatalog.ts", artifacts.operationCatalogSource],
  ...Object.entries(artifacts.renderedClients),
  ["src/platform/api/generated/index.ts", artifacts.indexSource],
] as const) assert.equal(read(relativePath), expected, `${relativePath} drifted from OpenAPI generation.`);

const operations = collectOperations(spec);
assert.equal(operations.length, 270);
assert.equal(new Set(operations.map((operation) => operation.operationId)).size, 270);
assert.deepEqual(manifest.operations.map((operation) => operation.operationId).sort(), operations.map((operation) => operation.operationId).sort());
assert.deepEqual(coverage.operations.map((operation) => operation.operationId).sort(), operations.map((operation) => operation.operationId).sort());

for (const operation of operations) {
  assert.ok(operation.operation["x-module-owner"]);
  assert.ok(operation.operation["x-required-capability"]);
  assert.ok(operation.operation["x-resource-scope"]);
  assert.ok(operation.operation["x-data-scope"]);
  assert.ok(operation.operation["x-idempotency-policy"]);
  assert.ok(operation.operation["x-concurrency-policy"]);
  assert.ok(operation.operation["x-audit-requirement"]);
  assert.ok(operation.operation["x-transaction-boundary"]);
  if (operation.operation["x-workspace-required"] === false) {
    assert.equal((operation.operation.parameters ?? []).some((parameter) => parameter.$ref === "#/components/parameters/WorkspaceIdHeader"), false, `${operation.operationId} must be workspace-independent.`);
  } else {
    assert.ok((operation.operation.parameters ?? []).some((parameter) => parameter.$ref === "#/components/parameters/WorkspaceIdHeader"));
  }
  if (operation.operation["x-contract-status"] === "PRODUCTION_CONTRACT_READY") {
    assert.ok(Object.keys(operation.operation.responses).some((status) => /^2\d\d$/u.test(status)), `${operation.operationId} needs typed success.`);
  } else {
    assert.equal(operation.operation["x-contract-status"], "BLOCKED");
    assert.ok(operation.operation["x-blocking-decision-id"]);
    assert.equal(Object.keys(operation.operation.responses).some((status) => /^2\d\d$/u.test(status)), false, `${operation.operationId} must not advertise success while blocked.`);
  }
}

const schemas = spec.components.schemas;
assert.equal(schemas.CommandPayload, undefined);
assert.equal(schemas.CommandMutationResponse, undefined);
assert.equal(schemas.MutationResult, undefined);
assert.equal(schemas.Money.additionalProperties, false);
assert.deepEqual(schemas.Money.required, ["amount", "currency"]);
assert.equal(schemas.Money.properties.amount.$ref, "#/components/schemas/DecimalAmount");
assert.equal(schemas.DecimalAmount.type, "string");
assert.equal(schemas.CurrencyCode.pattern, "^[A-Z]{3}$");
assert.equal(schemas.ProblemDetails.additionalProperties, false);
assert.equal(schemas.LeadDocument.properties.status, undefined);
assert.equal(schemas.LeadDocument.properties.leadWorkState.$ref, "#/components/schemas/LeadWorkState");

const readyMutations = operations.filter((item) => item.method !== "GET" && item.operation["x-contract-status"] === "PRODUCTION_CONTRACT_READY");
const readyQueries = operations.filter((item) => item.method === "GET" && item.operation["x-contract-status"] === "PRODUCTION_CONTRACT_READY");
assert.equal(readyMutations.length + readyQueries.length, coverage.summary.productionReadyOperations);
for (const operationId of [
  "archiveLead",
  "archiveLeadBatch",
  "anonymizeLead",
  "recordLeadConsent",
  "mergeLeadDuplicates",
  "confirmLeadDuplicatesDistinct",
  "assignLeadOwner",
  "importLeadBatch",
  "handoverLeadWithTasks",
]) assert.ok(readyMutations.some((item) => item.operationId === operationId), `${operationId} must be a ready Lead mutation.`);
for (const operation of readyMutations) {
  assert.ok(operation.operation.requestBody?.content?.["application/json"]?.schema?.$ref, `${operation.operationId} requires a typed request.`);
  const success = Object.entries(operation.operation.responses ?? {}).find(([status]) => /^2\d\d$/u.test(status))?.[1];
  assert.ok(success?.content?.["application/json"]?.schema?.$ref, `${operation.operationId} requires a typed response.`);
}


for (const sourcePath of [
  "src/platform/api/runtime/HttpModuleDataAuthority.ts",
  "src/platform/api/runtime/RoutedHttpMutationAuthority.ts",
  "src/modules/invoices/infrastructure/http/InvoiceHttpAdapter.ts",
  "src/modules/payments/infrastructure/http/PaymentHttpAdapter.ts",
]) {
  const source = read(sourcePath);
  assert.doesNotMatch(source, /path:\s*["'`]\/(?!\/)/u, `${sourcePath} must not own production endpoint literals.`);
}

assert.deepEqual(findBreakingChanges(baseline, structuredClone(baseline)), []);
const removedOperation = structuredClone(baseline);
removedOperation.operations = removedOperation.operations.filter((operation) => operation.operationId !== "listInvoices");
assert.ok(findBreakingChanges(baseline, removedOperation).some((finding) => finding.includes("Operation listInvoices was removed")));

assert.equal(packageJson.scripts["api:generate"], "node scripts/api/generate-openapi-client.mjs");
assert.equal(packageJson.scripts["api:check"], "node scripts/quality/run-quality-pipeline.mjs --gate quality.api-contract");
console.log(`OpenAPI/API contract: PASS (${operations.length} operations; 236 ready; 34 explicitly blocked; ${artifacts.sha256}).`);

function collectOperations(document: OpenApiDocument): OperationRecord[] {
  const result: OperationRecord[] = [];
  for (const [route, pathItem] of Object.entries(document.paths)) {
    for (const [method, candidate] of Object.entries(pathItem)) {
      if (!candidate || typeof candidate !== "object" || !("operationId" in candidate)) continue;
      result.push({ route, method: method.toUpperCase(), operationId: String(candidate.operationId), operation: candidate });
    }
  }
  return result;
}

interface OpenApiSchema { type?: string; pattern?: string; additionalProperties?: boolean; required?: string[]; properties: Record<string, { $ref?: string; type?: string }> }
interface OperationShape {
  operationId?: string;
  security?: Array<{ bearerAuth?: string[] }>;
  parameters?: Array<{ $ref?: string }>;
  requestBody?: { content?: Record<string, { schema?: { $ref?: string } }> };
  responses: Record<string, { content?: Record<string, { schema?: { $ref?: string } }> }>;
  "x-contract-status": string;
  "x-blocking-decision-id"?: string;
  "x-module-owner"?: string;
  "x-required-capability"?: string;
  "x-resource-scope"?: string;
  "x-data-scope"?: string;
  "x-idempotency-policy"?: string;
  "x-concurrency-policy"?: string;
  "x-audit-requirement"?: string;
  "x-transaction-boundary"?: string;
  "x-workspace-required"?: boolean;
}
interface OpenApiDocument { openapi: string; security?: Array<{ bearerAuth?: string[] }>; info: { version: string }; paths: Record<string, Record<string, OperationShape>>; components: { schemas: Record<string, OpenApiSchema> }; "x-contract-authority": string }
interface OperationRecord { route: string; method: string; operationId: string; operation: OperationShape }
interface ReleaseIdentity { version: string; backendApiContractStatus: string }
interface GeneratedManifest { specSha256: string; contractVersion: string; operations: Array<{ operationId: string }> }
interface CoverageLedger { summary: { operations: number; productionReadyOperations: number; blockedOperations: number }; operations: Array<{ operationId: string }> }
interface BreakingBaseline { operations: Array<{ operationId: string }>; schemas: Record<string, unknown> }
