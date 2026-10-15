import assert from "node:assert/strict";
import { createLeadOpportunityIntent } from "@/workflows/lead-qualification/presentation/model/leadOpportunityIntent";
import { getOpportunityFieldErrors } from "@/workflows/lead-qualification/domain/leadQualification.rules";

const command = { leadId: "lead-intent", dealsEnabled: true, currency: "VND", relationship: { kind: "CONTACT" as const, mode: "EXISTING" as const, selectedId: "contact-second", contact: { name: "Same name" } }, deal: { name: "Exact amount", ownerId: "member", estimatedValue: "9007199254740993.123456", needSummary: "Need", interestedProductIds: ["product-second"] } };
const intent = createLeadOpportunityIntent(command, 0, "authority-A", 3);
const body = JSON.stringify(intent.command);
command.deal.estimatedValue = "1"; command.deal.interestedProductIds.push("product-other"); command.relationship.selectedId = "contact-first";
assert.equal(JSON.stringify(intent.command), body);
assert.equal(intent.metadata.expectedVersion, 0);
assert.ok(intent.metadata.idempotencyKey);
assert.equal(intent.authority, "authority-A"); assert.equal(intent.generation, 3);
assert.equal(Reflect.set(intent.command.deal, "estimatedValue", "0"), false);
assert.equal(Reflect.set(intent.command.deal.interestedProductIds, "0", "wrong"), false);
assert.deepEqual(getOpportunityFieldErrors(intent.command), {});
for (const value of ["-1", "1e6", "NaN", "1.1234567", "01", "1,2"]) assert.ok(getOpportunityFieldErrors({ ...intent.command, deal: { ...intent.command.deal, estimatedValue: value } })["deal.estimatedValue"]);
console.log("WF-10 frozen intent, canonical version 0 and exact decimal validation: PASS (focused fixture; not connected acceptance).");
