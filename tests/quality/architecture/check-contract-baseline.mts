import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildRepositoryInventory } from "../../../scripts/repository-inventory/repositoryInventory.mjs";

const root = repositoryRoot;
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const readJson = <T,>(relative: string): T => JSON.parse(read(relative)) as T;

interface ReleaseIdentity {
  schemaVersion: number;
  packageName: string;
  version: string;
  releaseId: string;
  releaseDate: string;
  status: string;
  sourceScope: string;
  productionBaselineAccepted: boolean;
  backendApiContractStatus: string;
  archiveIdentity: { stableFileName: string; rootDirectory: string; checksumAuthority: string };
  contractAuthorities: string[];
  changePolicy: string;
}

interface CompatibilityLedgerEntry {
  id: string;
  path: string;
  owner: string;
  signals: string[];
  category: string;
  decision: string;
  priority: string;
  status: string;
  targetMilestone: string;
  removalGate: string;
  evidenceRequired: string[];
}

interface CompatibilityLedger {
  schemaVersion: number;
  baselineReleaseId: string;
  sourceInventory: string;
  candidateSetSha256: string;
  candidateCount: number;
  allowedStatus: string[];
  allowedDecision: string[];
  retirementPolicy: string;
  entries: CompatibilityLedgerEntry[];
}

const packageJson = readJson<{ name: string; version: string; scripts: Record<string, string> }>("package.json");
const packageLock = readJson<{ name: string; version: string; packages: Record<string, { name?: string; version?: string }> }>("package-lock.json");
const release = readJson<ReleaseIdentity>("docs/quality/release-identity.json");

assert.equal(release.schemaVersion, 1);
assert.equal(release.packageName, packageJson.name);
assert.equal(release.version, packageJson.version);
assert.equal(release.releaseId, `${packageJson.name}@${packageJson.version}`);
assert.match(packageJson.version, /^\d+\.\d+\.\d+-(?:contract|platform|financial|commercial|frontend)\.\d+$/);
assert.notEqual(packageJson.version, "0.0.0");
assert.equal(packageLock.name, packageJson.name);
assert.equal(packageLock.version, packageJson.version);
assert.equal(packageLock.packages[""]?.name, packageJson.name);
assert.equal(packageLock.packages[""]?.version, packageJson.version);
assert.equal(release.status, "QUALITY_BASELINE_REMEDIATION_CANDIDATE");
assert.equal(release.sourceScope, "FRONTEND_QUALITY_AND_RUNTIME_REMEDIATION");
assert.equal(release.productionBaselineAccepted, false);
assert.equal(release.backendApiContractStatus, "OPENAPI_3_1_SUPPORT_READY_WITH_EXTERNAL_BLOCKERS");
assert.equal(release.archiveIdentity.stableFileName, "unicorecrm-web.zip");
assert.equal(release.archiveIdentity.rootDirectory, "unicorecrm-web/");
assert.equal(release.archiveIdentity.checksumAuthority, "EXTERNAL_HANDOFF_SHA256");
assert.ok(release.changePolicy.includes("new package version"));
for (const authority of [
  "docs/api/openapi.json",
  "docs/api/generated-client-manifest.json",
  "docs/api/operation-coverage-ledger.json",
  "docs/api/openapi-breaking-baseline.json",
  "scripts/api/openapi/client-ownership.json",
  "tests/quality/architecture/check-api-contract.mts",
  "docs/architecture/dotnet-sqlserver-backend-target.md",
  "docs/architecture/backend-readiness.md",
  "docs/architecture/reference-financial-vertical-slice.md",
  "tests/quality/architecture/check-frontend-backend-separation.mts",
  "docs/architecture/application-composition.md",
  "tests/quality/architecture/check-application-composition.mts",
  "tests/quality/architecture/check-routed-mutation-authority.mts",
  "tests/quality/architecture/check-commercial-authoritative-queries.mts",
  "docs/quality/connected-backend-acceptance.md",
  "tests/quality/architecture/check-connected-acceptance-harness.mts",
  "tests/quality/integration/check-connected-backend-integration.mts",
  "tests/quality/acceptance/check-real-backend-contract.mts",
  "docs/architecture/compatibility-retirement-stage6.md",
  "tests/quality/architecture/check-compatibility-retirement.mts",
  "docs/architecture/large-file-presentation-responsibility-stage7.md",
  "tests/quality/architecture/check-large-file-responsibility.mts",
  ".github/workflows/quality.yml",
  "docs/quality/ci-and-release.md",
  "scripts/release/release-policy.json",
  "scripts/release/source-release.mjs",
  "scripts/release/create-source-release.mjs",
  "scripts/release/check-source-release.mjs",
  "tests/quality/architecture/check-ci-release-contract.mts",
  "docs/architecture/relationship-domain-api-boundary.md",
  "tests/quality/architecture/check-relationship-domain-api-boundary.mts",
  "docs/architecture/deal-api-boundary.md",
  "tests/quality/architecture/check-deal-api-boundary.mts",
  "docs/architecture/quote-api-boundary.md",
  "tests/quality/architecture/check-quote-api-boundary.mts",
  "docs/architecture/product-order-api-boundary.md",
  "tests/quality/architecture/check-product-order-api-boundary.mts",
  "docs/architecture/financial-operations-api-boundary.md",
  "tests/quality/architecture/check-financial-operations-api-boundary.mts",
]) {
  assert.ok(release.contractAuthorities.includes(authority), `Release authority is missing ${authority}.`);
}

const releaseDocument = read("docs/quality/release-identity.md");
assert.ok(releaseDocument.includes(release.releaseId));
assert.match(releaseDocument, /quality and runtime remediation candidate/i);
assert.match(releaseDocument, /not an accepted production baseline/i);
assert.match(releaseDocument, /ASP\.NET Core\/SQL Server backend/i);

const documentStatus = readJson<{
  documents: Record<string, { status: string; authority: string; scope: string; owner: string; lastVerifiedAgainst: string }>;
}>("docs/document-status.json");
for (const [documentPath, entry] of Object.entries(documentStatus.documents)) {
  assert.equal(entry.lastVerifiedAgainst, release.releaseId, `${documentPath} is not verified against the frozen release identity.`);
}

const adrPaths = [
  "docs/architecture/decisions/ADR-001-identity-and-authentication.md",
  "docs/architecture/decisions/ADR-002-workspace-tenancy.md",
  "docs/architecture/decisions/ADR-003-money-and-rounding.md",
  "docs/architecture/decisions/ADR-004-concurrency-and-idempotency.md",
  "docs/architecture/decisions/ADR-005-workflow-transactions-and-events.md",
  "docs/architecture/decisions/ADR-006-dotnet-modular-monolith-and-sqlserver.md",
];
const adrTokens = new Map<string, string[]>([
  [adrPaths[0], ["server-side", "never trusts `actor`", "WorkspaceMembership", "fail-closed"]],
  [adrPaths[1], ["X-Workspace-Id", "immutable `workspaceId`", "tenant boundary", "workspace_id"]],
  [adrPaths[2], ["decimal string", "ISO 4217", "Binary floating point is prohibited", "rounding"]],
  [adrPaths[3], ["expectedVersion", "If-Match", "409 CONFLICT", "idempotency key"]],
  [adrPaths[4], ["modular monolith", "transactional outbox", "webhook inbox", "process manager/saga"]],
  [adrPaths[5], ["ASP.NET Core", "Clean Architecture", "CQRS", "MediatR", "FluentValidation", "SQL Server"]],
]);
for (const adrPath of adrPaths) {
  assert.ok(fs.existsSync(path.join(root, adrPath)), `Missing ADR ${adrPath}.`);
  const source = read(adrPath);
  assert.match(source, /Status:\*\* ACCEPTED FOR BACKEND DESIGN/);
  for (const token of adrTokens.get(adrPath) ?? []) assert.ok(source.includes(token), `${adrPath} is missing decision token ${token}.`);
  const metadata = documentStatus.documents[adrPath];
  assert.equal(metadata?.status, "TARGET", `${adrPath} must be classified as a backend target decision.`);
  assert.equal(metadata?.authority, "CANONICAL");
  assert.equal(metadata?.scope, "BACKEND_TARGET");
}

const inventory = buildRepositoryInventory();
const ledger = readJson<CompatibilityLedger>("docs/architecture/compatibility-ledger.json");
assert.equal(ledger.schemaVersion, 1);
assert.equal(ledger.baselineReleaseId, release.releaseId);
assert.equal(ledger.sourceInventory, "docs/quality/repository-inventory.json");
assert.equal(ledger.candidateCount, inventory.compatibilityCandidates.length);
assert.equal(ledger.entries.length, inventory.compatibilityCandidates.length);
assert.equal(new Set(ledger.entries.map((entry) => entry.id)).size, ledger.entries.length, "Compatibility IDs must be unique.");
assert.equal(new Set(ledger.entries.map((entry) => entry.path)).size, ledger.entries.length, "Compatibility paths must be unique.");
assert.deepEqual(ledger.entries.map((entry) => entry.id), ledger.entries.map((_, index) => `COMP-${String(index + 1).padStart(3, "0")}`));
assert.deepEqual(ledger.entries.map((entry) => entry.path).sort(), inventory.compatibilityCandidates.map((entry) => entry.path).sort());
for (const entry of ledger.entries) {
  assert.ok(ledger.allowedStatus.includes(entry.status), `${entry.id} has invalid status.`);
  assert.ok(ledger.allowedDecision.includes(entry.decision), `${entry.id} has invalid decision.`);
  assert.ok(["LOW", "MEDIUM", "HIGH"].includes(entry.priority), `${entry.id} has invalid priority.`);
  assert.ok(entry.owner && entry.category && entry.removalGate.length >= 60, `${entry.id} has incomplete retirement evidence.`);
  assert.ok(entry.evidenceRequired.length >= 4, `${entry.id} has incomplete evidence requirements.`);
}
const candidateDigestPayload = ledger.entries
  .map((entry) => `${entry.path}|${entry.owner}|${entry.signals.join(",")}`)
  .join("\n");
const candidateDigest = crypto.createHash("sha256").update(candidateDigestPayload).digest("hex");
assert.equal(ledger.candidateSetSha256, candidateDigest);

const deploymentGuidance = read("docs/business/deployment-operations-forecast-and-ai-governance.md");
assert.match(deploymentGuidance, /current frontend contract already includes the official Invoices module/);
assert.match(deploymentGuidance, /Receivables read model, receivable entries, summary and aging buckets/);
assert.match(deploymentGuidance, /Accounting DSO remains unavailable/);
assert.doesNotMatch(deploymentGuidance, /DSO and receivables aging are intentionally unavailable/);
const screenGuidance = read("src/guidance/content/crm/screens.ts");
assert.match(screenGuidance, /Receivables aging/);
assert.match(screenGuidance, /accounting DSO requires durable backend data/);
assert.doesNotMatch(screenGuidance, /DSO\/aging require Invoice\/Receivables/);

const docsIndex = read("docs/README.md");
for (const link of [
  "quality/release-identity.md",
  "architecture/decisions/README.md",
  "architecture/compatibility-ledger.md",
  "architecture/compatibility-retirement-stage6.md",
  "architecture/large-file-presentation-responsibility-stage7.md",
  "api/README.md",
  "architecture/api-contract-and-generated-client.md",
  "architecture/backend-readiness.md",
  "architecture/dotnet-sqlserver-backend-target.md",
  "architecture/reference-financial-vertical-slice.md",
  "quality/api-contract-verification.md",
  "quality/backend-readiness-verification.md",
]) assert.ok(docsIndex.includes(link), `Documentation index is missing ${link}.`);

assert.equal(packageJson.scripts["check:contract-baseline"], undefined, "Individual contract aliases must remain retired.");
assert.equal(packageJson.scripts["quality:gate"], "node scripts/quality/run-quality-pipeline.mjs --require-gate");
console.log(`Frontend/OpenAPI/.NET target baseline: PASS (${release.releaseId}, ${adrPaths.length} ADRs, ${ledger.entries.length} compatibility entries).`);
