import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
for (const key of ["window", "document", "localStorage", "CustomEvent", "Event", "EventTarget"] as const)
  Object.defineProperty(globalThis, key, { value: key === "window" ? dom.window : dom.window[key], configurable: true });
const { signIn } = await import("@/platform/identity-auth");
assert.equal(signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok, true);
const { initializeApplicationComposition } = await import("@/app/composition");
await initializeApplicationComposition({ mode: "demo" });
const { getDealApplicationServices, configureDealApplication } = await import("@/modules/deals/application/composition/dealApplicationServices");
const { createDraft } = await import("@/modules/deals/presentation/components/dealFormModel");
const { DealSaveCheckpoint } = await import("@/modules/deals/presentation/model/dealSaveCheckpoint");
const { ApplicationError } = await import("@/shared/domain");
const services = getDealApplicationServices();
const seed = { id: "unit-deal", name: "Unit", buyerRef: { type: "CONTACT" as const, id: "contact-unit" }, stage: "DISCOVERY", amount: 1, opportunityScore: 10, ownerId: "member-unit", expectedCloseDate: "2026-12-01", interestedProducts: [], lineItems: [], activities: [], createdAt: "2026-10-13T00:00:00Z", updatedAt: "2026-10-13T00:00:00Z" };
const opening = { ...seed, resourceVersion: 42, name: "Opening", amount: 1, amountDecimal: "1", currency: "VND", notes: "Need", expectedCloseDate: "2026-12-01", forecastCategory: "PIPELINE" as const, interestedProducts: [], lineItems: [] };
services.repository.replace([opening]);
let stored: import("@/modules/deals/domain/model/deal.types").Deal = structuredClone(opening), profileCalls = 0, forecastCalls = 0;
const attempts: Array<{ expectedVersion: number; idempotencyKey: string }> = [];
const result = () => ({ deal: structuredClone(stored), evidence: { authority: "test" as const, commandId: "command", correlationId: "correlation", aggregateId: stored.id, aggregateType: "DEAL", version: stored.resourceVersion ?? 0, occurredAt: "2026-10-13T00:00:00Z", outcome: "COMMITTED" as const, warnings: [], emittedEventIds: [], auditEvidenceIds: [] } });
configureDealApplication({ ...services, repository: { list: () => [structuredClone(stored)], getById: id => id === stored.id ? structuredClone(stored) : undefined, replace: values => { const first = values[0]; if (first) stored = { ...stored, ...first }; }, subscribe: () => () => undefined }, api: { ...services.api, mode: "test", queries: { ...services.api.queries, get: async () => structuredClone(stored) }, commands: { ...services.api.commands,
  replaceDealProfile: async (_id, input, options) => { profileCalls++; assert.equal(options.expectedVersion, 42); stored = { ...stored, name: input.name, resourceVersion: 43 }; return result(); },
  updateDealForecast: async (_id, input, options) => { forecastCalls++; attempts.push({ expectedVersion: options.expectedVersion, idempotencyKey: options.idempotencyKey }); if (forecastCalls === 1) { stored = { ...stored, expectedCloseDate: input.expectedCloseDate ?? stored.expectedCloseDate, resourceVersion: 44 }; throw new ApplicationError({ code: "NETWORK_ERROR", message: "Acknowledgement lost", category: "NETWORK" }); } return result(); },
} } });
const draft = createDraft({ name: "Updated", buyerRef: opening.buyerRef, customerName: "Buyer", amount: 1, amountDecimal: "1", ownerId: opening.ownerId, currency: "VND", notes: "Need", stage: opening.stage, probability: opening.opportunityScore, forecastCategory: "PIPELINE", expectedCloseDate: "2026-12-02" }, [], [], "VND");
const checkpoint = new DealSaveCheckpoint();
const first = await checkpoint.save(opening, draft, "stable-intent", null);
assert.equal(first.status, "PARTIAL_SUCCESS", String(first.error));
assert.deepEqual(first.committed.map(x => x.step), ["profile"]);
await assert.rejects(checkpoint.save(opening, { ...draft, name: "Changed during ambiguity" }, "stable-intent", null), { code: "DEAL_SAVE_INTENT_PENDING" });
const retry = await checkpoint.save(opening, draft, "stable-intent", null);
assert.equal(retry.status, "FULL_SUCCESS"); assert.equal(profileCalls, 1); assert.equal(forecastCalls, 2);
assert.deepEqual(attempts[0], attempts[1], "Unknown acknowledgement retry must retain exact key and expected version despite refresh");
assert.equal(attempts[0]?.expectedVersion, 43);
console.log("Deal partial/unknown acknowledgement retry: PASS (unit test runtime, not connected)");
dom.window.close();
