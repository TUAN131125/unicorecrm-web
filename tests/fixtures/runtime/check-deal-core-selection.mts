import assert from "node:assert/strict";
import { createDraft } from "@/modules/deals/presentation/components/dealFormModel";
import { projectDealReadModel } from "@/modules/deals/application/read-models/dealReadModel";

const selected = { type: "CONTACT" as const, id: "contact-second" };
const ids = ["product-one", "product-two"];
const draft = createDraft({ buyerRef: selected, customerName: "Duplicate name", interestedProductIds: ids, amountDecimal: "9007199254740993.123456" }, [], [], "VND");
assert.deepEqual(draft.buyerRef, selected);
assert.equal(draft.amountDecimal, "9007199254740993.123456");
assert.deepEqual(draft.interestedProductIds, ids);
ids.pop();
assert.equal(draft.interestedProductIds.length, 2, "Caller collection mutation must not remove a selected ID");
const projected = projectDealReadModel({ id: "deal", name: "Reopened", buyerRef: selected, stageCode: "DISCOVERY", stageCategory: "OPEN", amount: { amount: draft.amountDecimal, currency: "VND" }, opportunityScore: "10", ownerId: "member", expectedCloseDate: "2026-12-01", interestedProductIds: draft.interestedProductIds, lineItems: [], resourceVersion: 0, createdAt: "2026-10-13T00:00:00Z", updatedAt: "2026-10-13T00:00:00Z" });
assert.equal(projected.amountDecimal, draft.amountDecimal, "Display-number rounding must not alter persistence money");
assert.deepEqual(projected.buyerRef, selected);
assert.deepEqual(projected.interestedProducts, draft.interestedProductIds);
console.log("Deal exact identity/decimal projection: PASS (unit)");
