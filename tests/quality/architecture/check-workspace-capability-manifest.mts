import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildWorkspaceCapabilityManifest } from "../../../src/platform/capability-manifest";
import { CRM_WORKSPACE_CONFIG_PRESETS, DEFAULT_CRM_WORKSPACE_CONFIG } from "../../../src/platform/workspace-config";

const defaultManifest = buildWorkspaceCapabilityManifest(DEFAULT_CRM_WORKSPACE_CONFIG);
assert.equal(defaultManifest.schemaVersion, 1);
assert.equal(defaultManifest.entries.deals.mode, "NATIVE");
assert.equal(defaultManifest.entries.orders.canWriteInNativeUi, true);
assert.equal(defaultManifest.entries.payments.mode, "NATIVE");
assert.deepEqual(defaultManifest.entries.returns.dependencies, ["orders"]);

const retail = CRM_WORKSPACE_CONFIG_PRESETS.find((preset) => preset.config.id === "preset_retail_order")?.config;
assert.ok(retail, "Retail preset is missing.");
const retailManifest = buildWorkspaceCapabilityManifest(retail);
assert.equal(retailManifest.entries.deals.mode, "HISTORICAL_ONLY");
assert.equal(retailManifest.entries.deals.canReadInNativeUi, false);
assert.equal(retailManifest.entries.quotes.canWriteInNativeUi, false);
assert.equal(retailManifest.entries.contacts.mode, "NATIVE");
assert.equal(retailManifest.entries.contacts.canReadInNativeUi, false, "B2C may hide native Contact navigation without removing Contact authority.");

const externalConfig = structuredClone(DEFAULT_CRM_WORKSPACE_CONFIG);
externalConfig.workflow.orderMode = "EXTERNAL";
externalConfig.workflow.paymentMode = "EXTERNAL";
externalConfig.modules.orders = false;
externalConfig.modules.payments = false;
const externalManifest = buildWorkspaceCapabilityManifest(externalConfig);
assert.equal(externalManifest.entries.orders.mode, "EXTERNAL");
assert.equal(externalManifest.entries.orders.canReadInNativeUi, false);
assert.equal(externalManifest.entries.payments.mode, "EXTERNAL");
assert.equal(externalManifest.entries.payments.canWriteInNativeUi, false);

const noPaymentConfig = structuredClone(DEFAULT_CRM_WORKSPACE_CONFIG);
noPaymentConfig.workflow.paymentMode = "NONE";
noPaymentConfig.modules.payments = false;
assert.equal(buildWorkspaceCapabilityManifest(noPaymentConfig).entries.payments.mode, "DISABLED");

const root = repositoryRoot;
for (const relative of [
  "src/app/shell/layout/Sidebar.tsx",
  "src/app/router/workspaces/crmWorkspaceRoutes.tsx",
  "src/components/ModuleGuard.tsx",
]) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  assert.match(source, /buildWorkspaceCapabilityManifest/, `${relative} must consume the canonical workspace capability manifest.`);
}
for (const relative of [
  "src/app/shell/layout/Sidebar.tsx",
  "src/app/router/workspaces/crmWorkspaceRoutes.tsx",
]) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  assert.doesNotMatch(source, /workflow\.(dealUsageMode|quoteUsageMode|paymentMode|orderMode)/, `${relative} must not derive capability modes independently.`);
  assert.doesNotMatch(source, /crmConfig\.modules/, `${relative} must not derive module visibility independently.`);
}

const moduleGuard = fs.readFileSync(path.join(root, "src/components/ModuleGuard.tsx"), "utf8");
assert.match(moduleGuard, /CapabilityUnavailableState/);
assert.match(moduleGuard, /buildWorkspaceCapabilityManifest/);
const unavailableState = fs.readFileSync(path.join(root, "src/components/CapabilityUnavailableState.tsx"), "utf8");
assert.match(unavailableState, /data-capability-mode/);
assert.match(unavailableState, /EXTERNAL/);
assert.match(unavailableState, /HISTORICAL_ONLY/);

console.log("Workspace capability manifest contracts: PASS (authority mode, native UI read/write, external/historical/disabled states, shared route/sidebar source)");
