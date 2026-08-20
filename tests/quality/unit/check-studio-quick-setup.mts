import assert from "node:assert/strict";
import fs from "node:fs";
import { BrowserQuickSetupRepository, EMPTY_QUICK_SETUP_STATE } from "@/workspaces/studio/infrastructure/BrowserQuickSetupRepository";
import { QUICK_SETUP_STEP_IDS, shouldAutoOpenQuickSetup } from "@/workspaces/studio/application/quickSetup.types";
import type { StoragePort } from "@/platform/persistence";

class MemoryStorage implements StoragePort { private values = new Map<string, unknown>(); get<T>(key: string) { return structuredClone(this.values.get(key) as T | undefined) ?? null; } set<T>(key: string, value: T) { this.values.set(key, structuredClone(value)); } remove(key: string) { this.values.delete(key); } }

assert.deepEqual(QUICK_SETUP_STEP_IDS, ["business-profile", "locale-currency", "workspace-blueprint"]);
assert.equal(shouldAutoOpenQuickSetup(EMPTY_QUICK_SETUP_STATE, true), true);
assert.equal(shouldAutoOpenQuickSetup(EMPTY_QUICK_SETUP_STATE, false), false);
const repository = new BrowserQuickSetupRepository(new MemoryStorage());
let state = repository.open();
assert.equal(state.status, "IN_PROGRESS");
assert.equal(state.currentStepId, QUICK_SETUP_STEP_IDS[0]);
state = repository.completeStep("business-profile");
assert.deepEqual(state.completedStepIds, ["business-profile"]);
assert.equal(state.currentStepId, "locale-currency");
state = repository.skipStep("locale-currency");
assert.deepEqual(state.skippedStepIds, ["locale-currency"]);
state = repository.completeStep("workspace-blueprint");
assert.equal(state.status, "COMPLETED");
assert.equal(state.currentStepId, null);
assert.ok(state.completedAt);
state = repository.open();
assert.equal(state.status, "COMPLETED");
assert.equal(state.currentStepId, null, "Reopening completed Quick Setup must show completion instead of restarting at step one");
for (const forbidden of ["businessInformation", "addresses", "currencies", "features", "pipelines", "answers", "payload"]) assert.equal(forbidden in state, false, `Quick Setup metadata must not store ${forbidden}`);
const dismissed = new BrowserQuickSetupRepository(new MemoryStorage()).dismissAutoOpen();
assert.equal(shouldAutoOpenQuickSetup(dismissed, true), false);

const read = (file: string): string => fs.readFileSync(file, "utf8");
const sheet = read("src/workspaces/studio/presentation/components/QuickSetupSheet.tsx");
for (const contract of [
  "useAccessibleOverlay",
  "useBodyScrollLock(true)",
  'initial={reduceMotion ? false : { y: "100%", opacity: 0.98 }}',
  "max-w-[1480px]",
  "sm:h-[min(92dvh,940px)]",
  'role="dialog"',
  'aria-modal="true"',
  'data-quick-setup-footer="true"',
  'data-quick-setup-background-illustration="true"',
  "crm-scroll-y absolute inset-0 overflow-y-auto overscroll-contain",
  "lg:pr-[420px]",
  "progressValue",
  "radial-gradient",
]) assert.ok(sheet.includes(contract), `Quick Setup sheet must preserve ${contract}.`);
assert.equal((sheet.match(/overflow-y-auto/g) ?? []).length, 1, "Quick Setup must use one outer body scroller instead of a middle-column scrollbar.");
assert.equal(sheet.includes("<aside"), false, "The illustration must be popup background content, not a split aside column.");
assert.equal(sheet.includes("lg:grid-cols-[minmax(0,1.08fr)_420px]"), false, "Quick Setup must not restore the split-column body that created a center scrollbar.");

const quickSetupView = read("src/workspaces/studio/presentation/views/QuickSetupView.tsx");
assert.ok(quickSetupView.includes("<QuickSetupSheet"), "Quick Setup must render through the shared bottom sheet.");
assert.equal(quickSetupView.includes("<StudioPageFrame"), false, "Quick Setup must not nest a Studio page shell.");
assert.equal(quickSetupView.includes("<StudioSaveBar"), false, "Quick Setup must expose one sheet footer instead of nested save bars.");
assert.ok(quickSetupView.includes("registerUnsavedWork({"), "The sheet must participate in the global unsaved-work contract.");
assert.ok(quickSetupView.includes("requestDecision({"), "Dirty step navigation must be guarded.");
for (const editor of ["QuickBusinessProfileEditor", "QuickLocaleEditor", "QuickWorkspaceBlueprintEditor"]) {
  assert.ok(quickSetupView.includes(editor), `${editor} must provide a focused setup step.`);
}
for (const excluded of ["PipelinesStatusesView", "InformationFieldsView", "PaymentInformationView", "InvoiceInformationView", "IntegrationsView", "FeatureUsageView"]) {
  assert.equal(quickSetupView.includes(excluded), false, `${excluded} belongs in advanced Studio, not Quick Setup.`);
}
assert.ok(quickSetupView.includes("Ba bước ngắn") && quickSetupView.includes("Three focused steps"), "Quick Setup must communicate a short essential flow.");
const essentials = read("src/workspaces/studio/presentation/components/QuickSetupEssentials.tsx");
for (const contract of ["CRM_WORKSPACE_CONFIG_PRESETS", "updateStudioBusinessInformation", "updateStudioLocaleRegion", "updateStudioBlueprint", "No sample data created", "Không tạo dữ liệu giả"]) {
  assert.ok(essentials.includes(contract), `Focused setup editors must preserve ${contract}.`);
}

const crmRoutes = read("src/app/router/CrmRoutes.tsx");
for (const contract of ["QuickSetupRouteOverlay", "resolveQuickSetupBackground", "useRoutes(routeTree, resolveQuickSetupBackground(location))"]) {
  assert.ok(crmRoutes.includes(contract), `Canonical routing must preserve ${contract}.`);
}
const quickSetupRouteOverlay = read("src/app/router/overlays/QuickSetupRouteOverlay.tsx");
for (const contract of ["QuickSetupOverlay", "backgroundLocation", "toWorkspacePath", "RouteScreenBoundary"]) {
  assert.ok(quickSetupRouteOverlay.includes(contract), `Quick Setup route overlay must preserve ${contract}.`);
}
const sidebar = read("src/app/shell/layout/Sidebar.tsx");
assert.ok(sidebar.includes('section.id === "quick-setup" ? { backgroundLocation: location, returnToPrevious: true }'), "Studio sidebar must preserve the current screen behind Quick Setup.");
const indexRoute = read("src/workspaces/studio/presentation/pages/StudioIndexRoute.tsx");
assert.equal(indexRoute.includes("openQuickSetup"), false, "Studio index must not mutate Quick Setup open state twice.");

console.log("Studio Quick Setup: PASS (three focused essentials, immersive onboarding surface, guarded progress, metadata only).");
