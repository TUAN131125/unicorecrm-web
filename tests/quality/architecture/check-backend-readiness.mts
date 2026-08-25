import { walkFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildRepositoryInventory } from "../../../scripts/repository-inventory/repositoryInventory.mjs";
import { resolveApplicationBootstrapPlan } from "../../../src/app/bootstrap/applicationBootstrap";

const root = repositoryRoot;
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
const readJson = <T,>(relative: string): T => JSON.parse(read(relative)) as T;

const packageJson = readJson<{
  description?: string;
  engines?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}>("package.json");
for (const dependency of ["express", "dotenv"]) {
  assert.equal(packageJson.dependencies?.[dependency], undefined, `${dependency} must not be a frontend production dependency.`);
}
assert.equal(packageJson.devDependencies?.["@types/express"], undefined, "The frontend must not add unused Express types.");
assert.ok(packageJson.description?.includes("Frontend reference implementation"));
assert.ok(packageJson.description?.includes("technology-neutral OpenAPI contracts"));
assert.doesNotMatch(packageJson.description ?? "", /executable .*backend vertical slice/i);
assert.equal(packageJson.engines?.node, ">=22.0.0");
assert.equal(packageJson.engines?.npm, ">=10.0.0");

const mainSource = read("src/main.tsx");
assert.match(mainSource, /bootstrapApplicationComposition\(\)/);
assert.doesNotMatch(mainSource, /initializeApplicationComposition\(\{\s*mode:\s*["']demo["']/);

const bootstrapSource = read("src/app/bootstrap/applicationBootstrap.ts");
for (const token of [
  "VITE_RUNTIME_MODE",
  "VITE_API_BASE_URL",
  "VITE_ALLOW_PRODUCTION_DEMO",
  "__UNICORECRM_CONNECTED_RUNTIME__",
  "getAccessToken",
  "getWorkspaceId",
  "refreshSession",
  "logout",
  "telemetry",
]) assert.ok(bootstrapSource.includes(token), `Runtime bootstrap is missing ${token}.`);
assert.doesNotMatch(bootstrapSource, /getApplicationServices/, "Host runtime must not supply an ApplicationServiceBundle.");

// Connected is the default in every environment; demo is only ever chosen explicitly.
assert.equal(resolveApplicationBootstrapPlan({ DEV: true }).mode, "connected");
assert.equal(resolveApplicationBootstrapPlan({ DEV: true, VITE_RUNTIME_MODE: "demo" }).mode, "demo");
assert.throws(() => resolveApplicationBootstrapPlan({ PROD: true }), /VITE_API_BASE_URL/);
const productionPlan = resolveApplicationBootstrapPlan(
  { PROD: true, VITE_API_BASE_URL: "https://api.example.test/v1", VITE_API_TIMEOUT_MS: "15000" },
  { getAccessToken: () => "token", getWorkspaceId: () => "workspace-test" },
);
assert.equal(productionPlan.mode, "connected");
assert.equal(productionPlan.composition.http?.defaultTimeoutMs, 15_000);

const envExample = read(".env.example");
for (const variable of ["VITE_RUNTIME_MODE", "VITE_API_BASE_URL", "VITE_API_TIMEOUT_MS", "VITE_AUTH_ADAPTER"]) {
  assert.ok(envExample.includes(variable), `.env.example is missing ${variable}.`);
}
assert.doesNotMatch(envExample, /^GEMINI_API_KEY=/m);
assert.doesNotMatch(envExample, /^APP_URL=/m);

const metadata = readJson<{ majorCapabilities?: string[] }>("metadata.json");
assert.ok(!(metadata.majorCapabilities ?? []).includes("MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"));

const documentStatus = readJson<{
  schemaVersion: number;
  allowedStatus: string[];
  documents: Record<string, { status: string; authority: string; scope: string; owner: string; lastVerifiedAgainst: string }>;
}>("docs/document-status.json");
assert.equal(documentStatus.schemaVersion, 1);
const markdownFiles = walk(root)
  .filter((file) => file.endsWith(".md"))
  .map((file) => path.relative(root, file).replaceAll(path.sep, "/"))
  .sort();
assert.deepEqual(Object.keys(documentStatus.documents).sort(), markdownFiles, "Every Markdown document must have exactly one status entry.");
for (const [documentPath, entry] of Object.entries(documentStatus.documents)) {
  assert.ok(documentStatus.allowedStatus.includes(entry.status), `${documentPath} has an unsupported status.`);
  assert.ok(entry.authority && entry.scope && entry.owner && entry.lastVerifiedAgainst, `${documentPath} has incomplete status metadata.`);
}

const docsIndex = read("docs/README.md");
for (const requiredLink of [
  "architecture/backend-readiness.md",
  "architecture/dotnet-sqlserver-backend-target.md",
  "business/order-to-cash-frontend-build-spec.md",
  "business/payment-plans-and-collections-frontend-spec.md",
  "quality/source-packaging.md",
  "ai/SKILLS.md",
]) assert.ok(docsIndex.includes(requiredLink), `Documentation index is missing ${requiredLink}.`);

assert.equal(fs.existsSync(path.join(root, "backend")), false, "Frontend handoff must not contain an executable backend implementation.");
const backendTarget = read("docs/architecture/dotnet-sqlserver-backend-target.md");
for (const token of ["ASP.NET Core", "CQRS", "MediatR", "FluentValidation", "SQL Server", "rowversion"]) assert.ok(backendTarget.includes(token));

const orderToCashSpec = read("docs/business/order-to-cash-frontend-build-spec.md");
assert.match(orderToCashSpec, /TARGET FRONTEND CONTRACT/);
assert.match(orderToCashSpec, /`invoices` đã là module chính thức/);
assert.doesNotMatch(orderToCashSpec, /chưa có module `invoices` thực sự/);
assert.match(orderToCashSpec, /không phải source of truth cho path/);

const guidanceSpec = read("docs/product/guidance-system.md");
assert.match(guidanceSpec, /trạng thái lịch sử/);
assert.doesNotMatch(guidanceSpec, /Route metadata hiện chỉ có `path`, `moduleKey`, `labelKey`/);

const studioRoadmap = read("docs/product/studio-rebuild-roadmap.md");
assert.match(studioRoadmap, /backend is the source of truth/);
assert.match(studioRoadmap, /frontend must not hardcode product types/);

const inventory = buildRepositoryInventory();
assert.deepEqual(inventory.circularDependencies, [], `Circular dependencies remain: ${JSON.stringify(inventory.circularDependencies)}`);

assert.equal(fs.existsSync(path.join(root, "src/platform/api/runtime/HttpMutationAuthority.ts")), false, "Generic production mutation authority must remain deleted.");
const mutationAuthoritySource = read("src/platform/api/runtime/RoutedHttpMutationAuthority.ts");
assert.match(mutationAuthoritySource, /PRODUCTION_COMMAND_CONTRACTS/);
assert.doesNotMatch(mutationAuthoritySource, /randomUUID|Date\.now|new Date\(/u);
assert.match(mutationAuthoritySource, /Mutation response is missing authoritative/);

const paymentPublicEntrySource = read("src/modules/payments/public/index.ts");
assert.match(paymentPublicEntrySource, /export \* from ["']\.\/api["'];?/, "Payments public entry must forward the canonical API barrel.");
const paymentPublicSource = `${paymentPublicEntrySource}
${read("src/modules/payments/public/api.ts")}`;
for (const removedContract of [
  "LegacyPaymentScheduleItem",
  "getLegacyPaymentScheduleSnapshot",
  "getLegacyPaymentScheduleForOrderSnapshot",
  "getLegacyPaymentScheduleFromSnapshot",
]) {
  assert.doesNotMatch(paymentPublicSource, new RegExp(removedContract), `${removedContract} must not return to the Payments public boundary.`);
}
for (const canonicalContract of [
  "PaymentObligation",
  "getPaymentObligations",
  "getPaymentObligationsSnapshot",
  "getPaymentObligationsForOrderSnapshot",
]) {
  assert.ok(paymentPublicSource.includes(canonicalContract), `Payments public boundary is missing ${canonicalContract}.`);
}

const paymentDomainSource = read("src/modules/payments/domain/model/payment.types.ts");
assert.doesNotMatch(paymentDomainSource, /obligationId\?: string/, "PaymentTransaction must not restore the single-obligation compatibility pointer.");
assert.doesNotMatch(paymentDomainSource, /allocationAmount\?: number/, "PaymentTransaction must derive totals from canonical allocations.");
const paymentSnapshotNormalizer = read("src/modules/payments/infrastructure/normalizePaymentRepositorySnapshot.ts");
assert.match(paymentSnapshotNormalizer, /migratedAllocations/);
assert.match(paymentSnapshotNormalizer, /unappliedAmount/);

const shippingDomainSource = read("src/modules/shipping/domain/model/shipping.types.ts");
assert.match(shippingDomainSource, /shipmentGroupId: string/);
assert.doesNotMatch(shippingDomainSource, /attemptGroup/);
const shippingCommandSource = read("src/modules/shipping/application/commands/shippingCommands.ts");
assert.doesNotMatch(shippingCommandSource, /attemptGroup/);
const shippingSnapshotNormalizer = read("src/modules/shipping/infrastructure/shippingBookingSnapshot.ts");
assert.match(shippingSnapshotNormalizer, /attemptGroup\?: string/);
assert.match(shippingSnapshotNormalizer, /resolveShipmentGroupId/);

const shippingConfigurationDomain = read("src/modules/shipping/domain/model/shippingConfiguration.types.ts");
for (const legacyCapability of ["supportsQuotes", "supportsCancel", "supportsSync"]) {
  assert.doesNotMatch(shippingConfigurationDomain, new RegExp(legacyCapability), `${legacyCapability} must remain infrastructure-only persisted-data compatibility.`);
}
const shippingConfigurationStore = read("src/modules/shipping/infrastructure/shippingConfigurationStore.ts");
assert.match(shippingConfigurationStore, /type StoredShippingProviderSetup/);

const accessControlDomain = read("src/platform/access-control/domain/accessControl.types.ts");
assert.doesNotMatch(accessControlDomain, /isSystem: boolean/, "Workspace-owned roles must not restore the obsolete system-role authority flag.");
assert.match(read("src/platform/access-control/runtime/accessControlMigration.ts"), /_legacyIsSystem/);

const aiContextSource = read("src/workspaces/crm/ai-context/application/aiContextBuilder.ts");
assert.doesNotMatch(aiContextSource, /activeRole/);
assert.doesNotMatch(aiContextSource, /\(d as any\)/);
assert.doesNotMatch(aiContextSource, /data: any/);
assert.doesNotMatch(aiContextSource, /relatedItems\?: any/);

const orderDomainSource = read("src/modules/orders/domain/model/order.types.ts");
assert.doesNotMatch(orderDomainSource, /paymentMethod\?: string/, "Payment method compatibility must remain in Order snapshot normalization, not the canonical Order model.");
assert.doesNotMatch(orderDomainSource, /codAmount\?: number/, "COD collectible truth must remain owned by Payment.");
const orderRepositorySource = read("src/modules/orders/infrastructure/InMemoryOrderRepository.ts");
assert.match(orderRepositorySource, /type StoredCustomerOrder/);
assert.match(orderRepositorySource, /legacyPaymentMethod/);

const organizationQueries = read("src/modules/organizations/application/queries/organizationAccountQueries.ts");
assert.doesNotMatch(organizationQueries, /findOrganizationAccountByLegacyCustomerId/);

const customerSectionsBarrel = read("src/modules/customers/presentation/detail/CustomerDetailSections.tsx");
assert.ok(customerSectionsBarrel.split(/\r?\n/).length <= 20, "Customer detail section composition must remain a thin barrel.");
for (const extractedSection of [
  "CustomerRelationshipSections",
  "CustomerCommercialSections",
  "CustomerOperationsSections",
]) {
  assert.ok(customerSectionsBarrel.includes(extractedSection), `Customer detail composition is missing ${extractedSection}.`);
}
assert.ok(
  fs.existsSync(path.join(root, "src/modules/customers/presentation/detail/CustomerDetailSectionPrimitives.tsx")),
  "Customer detail shared primitives must remain extracted from the composition barrel.",
);

const httpAdapters = walk(path.join(root, "src", "modules"))
  .filter((file) => /HttpAdapter\.ts$/.test(file))
  .map((file) => path.relative(root, file).replaceAll(path.sep, "/"));
assert.deepEqual(httpAdapters.sort(), [
  "src/modules/invoices/infrastructure/http/InvoiceHttpAdapter.ts",
  "src/modules/invoices/infrastructure/http/ReceivablesHttpAdapter.ts",
  "src/modules/orders/infrastructure/http/OrderCreditApprovalHttpAdapter.ts",
  "src/modules/payments/infrastructure/http/PaymentHttpAdapter.ts",
]);

console.log(`Frontend/backend readiness: PASS (${markdownFiles.length} classified documents, ${inventory.summary.circularDependencyGroups} dependency cycles, ${httpAdapters.length} specialized contract adapters plus self-composed module authority).`);

function walk(directory: string): string[] {
  return walkFiles(directory, {
    excludeDirectory: (entryName) => ["node_modules", "dist", ".git", "coverage", ".agents", ".claude", ".ai-workflows", "design-reconstruction"].includes(entryName),
    sort: false,
  });
}
