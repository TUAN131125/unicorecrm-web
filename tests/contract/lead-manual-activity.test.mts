import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost" });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "Element", "Node", "Event", "CustomEvent", "EventTarget"] as const)
  Object.defineProperty(globalThis, key, { value: key === "window" ? dom.window : dom.window[key], configurable: true });
const auth = await import("@/platform/identity-auth");
assert.ok(auth.signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok);
const { initializeApplicationComposition } = await import("@/app/composition");
await initializeApplicationComposition({ mode: "demo" });
const ac = await import("@/platform/access-control"), ws = await import("@/platform/workspace-context");
await ac.loadAccessGovernance(ws.getWorkspaceContextSnapshot().workspaceId);
const services = await import("@/modules/tasks/application/composition/taskApplicationServices");
const original = services.getTaskApplicationServices();
const calls: Array<Parameters<typeof original.api.commands.logActivity>[0]> = [];
services.configureTaskApplication({ ...original, api: { ...original.api, commands: { ...original.api.commands,
  async logActivity(input, options) { calls.push(input); return original.api.commands.logActivity(input, options); },
} } });
const { logLeadActivityViaApi } = await import("@/modules/leads/application/commands/leadActivityCommands");
const { logActivityCommand } = await import("@/modules/tasks");
for (const type of ["SYSTEM", "system", "unknown", ""]) {
  await assert.rejects(logLeadActivityViaApi("lead_contract", { id: `invalid-${type}`, title: "Invalid manual event", createdAt: "2026-10-21T00:00:00Z", author: "Actor", type }), { code: "VALIDATION_FAILED" });
}
await assert.rejects(Reflect.apply(logActivityCommand, undefined, [{ id: "invalid-public", type: "SYSTEM", subject: "Invalid system", actorId: "actor" }]), { code: "VALIDATION_FAILED" });
assert.equal(calls.length, 0, "invalid types must fail before the command port/transport");
for (const type of ["call", "EMAIL", "meeting", " Note ", "message"]) {
  await logLeadActivityViaApi("lead_contract", { id: `valid-${type}`, title: "Manual Lead interaction", createdAt: "2026-10-21T00:00:00Z", author: "Actor", type });
}
assert.deepEqual(calls.map(x => x.type), ["CALL", "EMAIL", "MEETING", "NOTE", "MESSAGE"]);
assert.ok(calls.every(x => x.recordRef?.moduleKey === "leads" && x.recordRef.recordId === "lead_contract"));
console.log("PASS Lead/manual command: valid legacy casing normalizes to five manual types; unknown/SYSTEM rejected before port; no SYSTEM/NOTE fallback. Demo/in-process evidence only.");
