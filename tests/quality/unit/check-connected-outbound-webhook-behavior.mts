import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { ConnectedOutboundWebhookBehavior, type OutboundWebhookForm } from "../../../src/workspaces/studio/application/connectedOutboundWebhookBehavior.ts";
import { OutboundWebhookMutationIntents } from "../../../src/workspaces/studio/application/outboundWebhookMutationIntents.ts";

const dom = new JSDOM("", { url: "https://studio.example.test" });
let keys: string[] = []; let creates = 0; let updates: Array<{ request: OutboundWebhookForm; key: string }> = []; let refreshes = 0; let sequence = 0;
const api = {
  async createOutboundWebhookSubscription(_request: OutboundWebhookForm, options: { idempotencyKey: string }) { keys.push(options.idempotencyKey); creates++; if (creates === 1) throw new Error("lost response"); return { signingSecret: "one-time" }; },
  async updateOutboundWebhookSubscription(_id: string, request: OutboundWebhookForm, options: { idempotencyKey: string; expectedVersion: number }) { updates.push({ request, key: options.idempotencyKey }); return {}; },
};
const behavior = new ConnectedOutboundWebhookBehavior(api, new OutboundWebhookMutationIntents(() => `K${++sequence}`));
const create = { name: "CRM", eventType: "crm.contact.changed", endpointUrl: "https://example.test/hook" };
await assert.rejects(() => behavior.create(create, async () => { refreshes++; }), /lost response/);
await behavior.create(create, async () => { refreshes++; });
assert.deepEqual(keys, ["K1", "K1"]); assert.equal(refreshes, 1);
await behavior.create({ ...create, name: "Changed" }, async () => { refreshes++; }); assert.equal(keys[2], "K2");
const paused = { subscriptionId: "s1", status: "PAUSED", version: 4, ...create };
const selected = { ...create, eventType: "crm.customer.changed" };
assert.deepEqual(behavior.beginEdit(paused), create); assert.equal(behavior.beginEdit({ ...paused, status: "ACTIVE" }), undefined);
await behavior.update(paused, selected, async () => { refreshes++; }); assert.equal(updates[0]?.request.eventType, "crm.customer.changed"); assert.equal(refreshes, 3);
assert.equal(dom.window.localStorage.length, 0, "connected failures must not write browser persistence");
console.log("Connected outbound webhook behavior: PASS");
