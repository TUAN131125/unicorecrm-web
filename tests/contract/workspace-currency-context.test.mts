import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost" });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "Element", "Node", "Event", "CustomEvent", "EventTarget"] as const)
  Object.defineProperty(globalThis, key, { value: key === "window" ? dom.window : dom.window[key], configurable: true });
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
const auth = await import("@/platform/identity-auth");
assert.ok(auth.signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok);
const workspace = await import("@/platform/workspace-context");
const config = await import("@/platform/workspace-config");
const settings = await import("@/platform/workspace-config/workspaceRuntimeSettings");
const operational = await import("@/platform/workspace-config/workspaceOperationalConfigurationRuntime");
const studio = await import("@/workspaces/studio/runtime/studioCoreRuntime");
const React = await import("react");
const { createRoot } = await import("react-dom/client");
type Context = import("@/platform/workspace-context").WorkspaceBootstrapContext;
const baseline = config.getWorkspaceOperationalConfiguration();
assert.equal(settings.getWorkspaceRuntimeSettings().baseCurrency, "VND", "demo default stays VND");
const member = workspace.getWorkspaceContextSnapshot();
function context(id: string, currency = "USD"): Context {
  return { workspace: { ...member, workspaceId: id, workspaceKey: id, membershipId: `membership-${id}` },
    contextVersion: 1, capabilities: [], resolvedAt: new Date().toISOString(),
    configuration: { configurationVersion: 4, locale: "en", timeZone: "UTC", baseCurrency: currency,
      enabledModuleKeys: [], availableProductSpaces: ["crm"] } };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
let nextRead: Promise<Context> | undefined;
let unavailable = false;
let membershipUnavailable = false;
workspace.resetWorkspaceRuntimeParticipant();
workspace.configureConnectedWorkspaceBootstrapGateway({
  listMyWorkspaces: async () => { if (membershipUnavailable) throw new Error("test membership transport unavailable"); return [context("A").workspace, context("B").workspace]; },
  getWorkspaceBootstrap: async id => { if (unavailable) throw new Error("test transport unavailable"); return nextRead ?? context(id); },
  ensureInitialWorkspace: async () => "EXISTING_MEMBERSHIP",
});
assert.throws(settings.getWorkspaceRuntimeSettings, { code: "WORKSPACE_CONFIGURATION_UNAVAILABLE" });
assert.throws(config.getWorkspaceOperationalConfiguration, { code: "WORKSPACE_CONFIGURATION_UNAVAILABLE" });
await workspace.enterWorkspace("A");
assert.equal(settings.getWorkspaceRuntimeSettings().baseCurrency, "USD", "direct canonical entry prepares base without Studio");
assert.equal(settings.getWorkspaceRuntimeSettings().configurationVersion, 4);
const root = createRoot(document.getElementById("root") as HTMLElement);
function Consumer() { const value = settings.useWorkspaceRuntimeSettings(); return React.createElement("span", null, `${value.workspaceId}:${value.baseCurrency}:${value.timeZone}`); }
await React.act(async () => root.render(React.createElement(Consumer)));
const ownerA = settings.captureWorkspaceConfigurationOwner();
await React.act(async () => settings.publishWorkspaceRuntimeLocale("EUR", "Europe/Paris", ownerA, 2));
assert.equal(document.getElementById("root")?.textContent, "A:EUR:Europe/Paris", "mounted consumer refreshes after Studio authority publication");
await React.act(async () => root.unmount());
const held = deferred<Context>(); nextRead = held.promise;
const enteringB = workspace.enterWorkspace("B");
assert.throws(settings.getWorkspaceRuntimeSettings, { code: "WORKSPACE_CONFIGURATION_UNAVAILABLE" }, "switch retires A before network completes");
held.resolve(context("B")); await enteringB; nextRead = undefined;
assert.equal(settings.getWorkspaceRuntimeSettings().baseCurrency, "USD");
assert.throws(() => settings.publishWorkspaceRuntimeLocale("EUR", "UTC", ownerA, 2), { code: "WORKSPACE_CONFIGURATION_UNAVAILABLE" });
const stale = deferred<Context>(); nextRead = stale.promise;
const enteringA = workspace.enterWorkspace("A"); nextRead = undefined;
await workspace.enterWorkspace("B"); stale.resolve(context("A", "EUR"));
await assert.rejects(enteringA);
assert.equal(settings.getWorkspaceRuntimeSettings().workspaceId, "B", "late A Bootstrap cannot replace B");
membershipUnavailable = true;
await assert.rejects(workspace.enterWorkspaceByKey("unknown"));
assert.throws(settings.getWorkspaceRuntimeSettings, { code: "WORKSPACE_CONFIGURATION_UNAVAILABLE" }, "currency retires before a failed membership read, not only before Bootstrap");
membershipUnavailable = false;
unavailable = true;
await assert.rejects(workspace.enterWorkspace("A"));
assert.throws(settings.getWorkspaceRuntimeSettings, { code: "WORKSPACE_CONFIGURATION_UNAVAILABLE" });
assert.throws(config.getWorkspaceOperationalConfiguration, { code: "WORKSPACE_CONFIGURATION_UNAVAILABLE" });
assert.equal(workspace.getWorkspaceBootstrapSnapshot(), null, "retired active context cannot skip re-entry after a failure");
unavailable = false;
await workspace.enterWorkspace("A");
const full = deferred<typeof baseline>();
operational.configureWorkspaceOperationalConfigurationLoader(async () => full.promise);
let pending: unknown;
try { operational.readWorkspaceOperationalConfiguration(); } catch (error) { pending = error; }
assert.ok(pending instanceof Promise);
await workspace.enterWorkspace("B"); full.resolve({ ...baseline, localeRegion: { ...baseline.localeRegion, currencies: { ...baseline.localeRegion.currencies, baseCurrency: "EUR" } } });
await pending;
assert.throws(config.getWorkspaceOperationalConfiguration, { code: "WORKSPACE_CONFIGURATION_UNAVAILABLE" }, "late full configuration is discarded");
operational.configureWorkspaceOperationalConfigurationLoader();
await workspace.enterWorkspace("A");
nextRead = Promise.resolve(context("B", ""));
await assert.rejects(workspace.enterWorkspace("B"), { code: "WORKSPACE_CONFIGURATION_UNAVAILABLE" });
assert.throws(settings.getWorkspaceRuntimeSettings, { code: "WORKSPACE_CONFIGURATION_UNAVAILABLE" }, "invalid currency never becomes ready");
nextRead = undefined;
await workspace.enterWorkspace("A");
operational.configureWorkspaceOperationalConfigurationLoader(async () => { throw new Error("test offline"); });
try { operational.readWorkspaceOperationalConfiguration(); } catch (error) { pending = error; }
await pending;
assert.throws(operational.readWorkspaceOperationalConfiguration, { code: "WORKSPACE_CONFIGURATION_UNAVAILABLE" }, "failed authority remains error, not demo or an automatic retry loop");
operational.clearConnectedWorkspaceOperationalConfigurationProjection();
operational.configureWorkspaceOperationalConfigurationLoader();
const crm = config.getWorkspaceConfigSnapshot();
const studioValue = { ...baseline, workspaceId: "A", publicationStatus: "DRAFT" as const,
  localeRegion: { ...baseline.localeRegion, timezone: "UTC", currencies: { ...baseline.localeRegion.currencies, baseCurrency: "USD" } },
  blueprint: { businessModel: crm.businessModel, workflow: crm.workflow }, features: crm.modules };
const unused = async (): Promise<never> => { throw new Error("unused test port"); };
let readConfiguration = async () => studioValue;
studio.configureConnectedStudioCoreGateway({ getConfiguration: () => readConfiguration(),
  updateLocaleRegion: async localeRegion => ({ commandId: "cmd", correlationId: "correlation", aggregateId: "A",
    aggregateType: "WorkspaceStudioConfiguration", version: 2, occurredAt: new Date().toISOString(), outcome: "COMMITTED",
    warnings: [], emittedEventIds: [], auditEvidenceIds: [], configuration: { ...studioValue, revision: 2, localeRegion } }),
  updateBusinessInformation: unused, updateBlueprint: unused, updateFeatures: unused,
  publish: unused, listAudit: unused, getQuickSetup: unused, openQuickSetup: unused, dismissQuickSetupAutoOpen: unused,
  completeQuickSetupStep: unused, skipQuickSetupStep: unused });
await studio.loadStudioConfiguration();
let duplicatePublications = 0;
const unsubscribeDuplicate = settings.subscribeToWorkspaceRuntimeSettings(() => { duplicatePublications += 1; });
await studio.loadStudioConfiguration();
assert.equal(duplicatePublications, 0, "identical Studio reads do not invalidate current consumers or reset drafts");
unsubscribeDuplicate();
const olderRead = deferred<typeof studioValue>(); readConfiguration = () => olderRead.promise;
const olderLoad = studio.loadStudioConfiguration();
await studio.updateStudioLocaleRegion({ ...studioValue.localeRegion, currencies: { ...studioValue.localeRegion.currencies, baseCurrency: "EUR" } });
assert.equal(settings.getWorkspaceRuntimeSettings().baseCurrency, "EUR", "actual Studio command publication refreshes canonical consumer context");
olderRead.resolve(studioValue); await olderLoad;
assert.equal(settings.getWorkspaceRuntimeSettings().baseCurrency, "EUR", "older Studio read cannot undo a newer committed revision");
const lateStudio = deferred<typeof studioValue>();
studio.configureConnectedStudioCoreGateway({ getConfiguration: async () => lateStudio.promise,
  updateBusinessInformation: unused, updateLocaleRegion: unused, updateBlueprint: unused, updateFeatures: unused,
  publish: unused, listAudit: unused, getQuickSetup: unused, openQuickSetup: unused, dismissQuickSetupAutoOpen: unused,
  completeQuickSetupStep: unused, skipQuickSetupStep: unused });
const lateRead = studio.loadStudioConfiguration();
await workspace.enterWorkspace("B"); lateStudio.resolve(studioValue);
await assert.rejects(lateRead, { code: "WORKSPACE_CONFIGURATION_OWNER_RETIRED" });
assert.equal(settings.getWorkspaceRuntimeSettings().baseCurrency, "USD");
assert.throws(config.getWorkspaceOperationalConfiguration, { code: "WORKSPACE_CONFIGURATION_UNAVAILABLE" });
auth.signOut();
assert.throws(settings.getWorkspaceRuntimeSettings, { code: "WORKSPACE_CONFIGURATION_UNAVAILABLE" }, "logout revokes current currency");
studio.resetStudioCoreRuntime();
workspace.resetConnectedWorkspaceBootstrapGateway();
assert.ok(auth.signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok);
assert.equal(settings.getWorkspaceRuntimeSettings().baseCurrency, "VND", "demo remains independent after connected teardown");
console.log("PASS currency authority: direct entry, publication, pending switch, late Bootstrap/full/Studio responses, unavailable, logout, demo");
