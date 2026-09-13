import assert from "node:assert/strict";
import { OutboundWebhookMutationIntents } from "../../../src/workspaces/studio/application/outboundWebhookMutationIntents.ts";

let sequence = 0;
const intents = new OutboundWebhookMutationIntents(() => `K${++sequence}`);
const create = { operation: "create", request: { name: "Orders", eventType: "crm.contact.changed", endpointUrl: "https://example.test/hook" } };
const first = intents.keyFor(create);
assert.equal(first, "K1");
const observed: string[] = [];
const fakeApi = async (idempotencyKey: string) => { observed.push(idempotencyKey); if (observed.length === 1) throw new Error("lost response"); return { subscriptionId: "backend-owned" }; };
await assert.rejects(() => fakeApi(first), /lost response/);
// A transport/lost-response failure deliberately does not complete the intent.
assert.equal(intents.keyFor(create), first);
assert.equal((await fakeApi(intents.keyFor(create))).subscriptionId, "backend-owned");
assert.deepEqual(observed, ["K1", "K1"]);
assert.notEqual(intents.keyFor({ ...create, request: { ...create.request, name: "Changed" } }), first);
intents.complete(create);
assert.notEqual(intents.keyFor(create), first);
assert.equal(globalThis.localStorage, undefined, "intent handling must not use browser persistence");
console.log("Outbound webhook mutation intent behavior: PASS");
