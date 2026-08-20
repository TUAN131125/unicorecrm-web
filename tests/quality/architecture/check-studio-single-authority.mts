import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = repositoryRoot;
const read = (file: string) => readFileSync(join(root, file), "utf8");

const registry = read("src/workspaces/studio/navigation/studioSectionRegistry.ts");
for (const marker of ["quick-setup", "business-information", "locale-region", "feature-usage", "pipelines-statuses", "product-types", "information-fields", "payment-information", "invoice-information", "integrations", "webhooks-api"]) assert.ok(registry.includes(`id: \"${marker}\"`), `Missing Studio section ${marker}`);
assert.equal((registry.match(/\broutePath: relativeRoutePath\(/g) ?? []).length, 11);

for (const removed of ["src/workspaces/studio/domain/studioConfiguration.types.ts", "src/workspaces/studio/application/studioConfigurationGateway.ts", "src/workspaces/studio/infrastructure/BrowserStudioConfigurationGateway.ts", "src/workspaces/studio/infrastructure/HttpStudioConfigurationGateway.ts", "src/workspaces/studio/runtime/studioConfigurationRuntime.ts", "src/workspaces/studio/presentation/hooks/useStudioConfigurationController.ts"]) assert.equal(existsSync(join(root, removed)), false, `${removed} must remain removed`);

for (const file of walkAllFiles(join(root, "src/modules")).filter((item) => /\.[tj]sx?$/.test(item))) {
  const source = readFileSync(file, "utf8");
  assert.doesNotMatch(source, /(?:@\/|\.\.\/)+(?:workspaces\/)?studio(?:\/|\")/, `${relative(root, file)} must not depend on Studio`);
}

const studioRoutes = read("src/app/router/workspaces/studioWorkspaceRoutes.tsx");
assert.equal(existsSync(join(root, "src/workspaces/studio/presentation/pages/StudioSectionPage.tsx")), false, "Studio routes must not funnel all screens through one static section module");
for (const owner of ["QuickSetupView", "BusinessInformationView", "LocaleRegionView", "FeatureUsageView", "PipelinesStatusesView", "ProductTypesView", "InformationFieldsView", "PaymentInformationView", "InvoiceInformationView", "IntegrationsView", "WebhooksApiView"]) {
  assert.ok(studioRoutes.includes(`const ${owner} = lazyRouteComponent(`), `${owner} must have an isolated lazy route module`);
}
assert.equal((studioRoutes.match(/StudioRouteScreen sectionId=/g) ?? []).length, 1, "Studio route mapping must use the isolated screen wrapper");
console.log("Studio single authority: PASS (11 canonical routes, isolated lazy screens, module-owned configuration, no Studio dependency from modules).");
