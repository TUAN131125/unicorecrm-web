import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/#/w/unicore-vietnam/crm/contacts" });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "Element", "Node", "Event"] as const) {
  Object.defineProperty(globalThis, key, { value: key === "window" ? dom.window : dom.window[key], configurable: true });
}
const { signIn } = await import("../../../src/platform/identity-auth/index");
assert.equal(signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok, true);
const { initializeApplicationComposition } = await import("../../../src/app/composition");
let calls = 0;
await initializeApplicationComposition({ mode: "connected", http: { client: { async request<T>(): Promise<T> { calls++; throw new Error("UNEXPECTED_TRANSPORT"); } } } });
const contacts = await import("../../../src/modules/contacts/public/contacts");
assert.equal(contacts.isContactCreateAvailable(), true);
assert.equal(contacts.isContactUpdateAvailable(), true);
assert.equal(contacts.isContactArchiveAvailable(), true);
assert.equal("isContactRetentionUnavailable" in contacts, false, "A blanket retention predicate must not represent independently admitted commands.");
assert.equal(contacts.isContactRestoreAvailable(), false);
assert.equal(contacts.isContactAnonymizeAvailable(), false);
assert.equal(contacts.isContactBulkAvailable(), false);
for (const command of [contacts.archiveContactCommand, contacts.restoreContactCommand, contacts.anonymizeContactCommand]) {
  assert.throws(() => command("contact_1", { reason: "authority check", actorId: "u1" }), /not a routable production command contract/u);
}
assert.equal(calls, 0, "Legacy snapshot commands must never fall back to local writes or transport.");
const registry = JSON.parse(fs.readFileSync("docs/backend-readiness/command-registry.json", "utf8")) as { commands: { commandType: string; openApiOperationId: string | null; status: string; runtimeImplementationMode: string }[] };
const ready = registry.commands.filter(row => row.commandType.startsWith("contact.") && row.status === "PRODUCTION_CONTRACT_READY");
assert.equal(ready.length, 9);
for (const row of ready) {
  assert.ok(row.openApiOperationId);
  assert.equal(row.runtimeImplementationMode, "DEDICATED_MODULE_HTTP_ADAPTER");
}
for (const type of ["contact.restore", "contact.anonymize"]) assert.equal(registry.commands.find(row => row.commandType === type)?.status, "BLOCKED");
const { configureContactApplication, getContactApplicationServices } = await import("../../../src/modules/contacts/application/composition/contactApplicationServices");
const services = getContactApplicationServices();
configureContactApplication({ ...services, api: { mode: "connected", queries: services.api.queries } });
assert.equal(contacts.isContactCreateAvailable(), false, "A missing connected command adapter must fail closed.");
assert.equal(contacts.isContactUpdateAvailable(), false);
assert.equal(contacts.isContactArchiveAvailable(), false);
configureContactApplication(services);
await initializeApplicationComposition({ mode: "demo" });
assert.equal(contacts.isContactArchiveAvailable(), true);
assert.equal(contacts.isContactRestoreAvailable(), true);
assert.equal(contacts.isContactAnonymizeAvailable(), true);
assert.equal(contacts.isContactBulkAvailable(), true);
console.log("Contact command authority: PASS (9 dedicated READY commands; independent restore/anonymize/bulk blockers; legacy snapshot containment).");
