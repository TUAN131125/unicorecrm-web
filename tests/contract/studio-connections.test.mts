import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><div id='root'></div>", { url: "http://localhost" });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "Event", "CustomEvent"] as const)
  Object.defineProperty(globalThis, key, { value: key === "window" ? dom.window : dom.window[key], configurable: true });
const { STUDIO_SECTIONS, listStudioSectionsForGroup } = await import("@/workspaces/studio/navigation/studioSectionRegistry");
const { ROUTE_KEYS, canonicalizeLegacyPath } = await import("@/platform/navigation");
assert.deepEqual(listStudioSectionsForGroup("connections").map(item => item.id), ["connections-overview", "integrations", "connections-inbound", "webhooks-api", "api-access"]);
assert.equal(STUDIO_SECTIONS.find(item => item.id === "ai")?.groupId, "ai");
assert.equal(STUDIO_SECTIONS.find(item => item.id === "communication-channels")?.requiredCapability, "communications.channels.manage");
assert.ok(listStudioSectionsForGroup("connections").every(item => item.requiredCapability === "studio.read"));
assert.equal(canonicalizeLegacyPath("other-workspace", ROUTE_KEYS.SETTINGS_INTEGRATIONS), "/w/other-workspace/studio/settings/integrations");
assert.equal(canonicalizeLegacyPath("other-workspace", ROUTE_KEYS.SETTINGS_WEBHOOKS_API), "/w/other-workspace/studio/settings/webhooks-api");

const availability = await import("@/platform/connected-configuration/connectedConfigurationAvailability");
const { declareUnavailableBusinessOperation, resetBusinessOperationAvailability } = await import("@/shared/application");
const { saveDeveloperWebhooks } = await import("@/platform/developer-configuration");
resetBusinessOperationAvailability();
assert.equal(availability.isDeveloperWebhookSaveUnavailable(), false, "Demo configuration remains available");
declareUnavailableBusinessOperation(availability.DEVELOPER_WEBHOOK_SAVE_OPERATION);
assert.equal(availability.isDeveloperWebhookSaveUnavailable(), true);
const storageBefore = { ...dom.window.localStorage };
assert.throws(() => saveDeveloperWebhooks([]), { code: "CONNECTED_OPERATION_REQUIRES_BACKEND" });
assert.deepEqual({ ...dom.window.localStorage }, storageBefore, "Refusal must occur before workspace repository or browser storage is touched");
resetBusinessOperationAvailability();
console.log("PASS Connections destination order, capabilities, legacy paths and connected browser-write refusal without persistence");
