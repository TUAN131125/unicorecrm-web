import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DealStage, type Deal } from "@/modules/deals/domain/model/deal.types";
import { DEFAULT_DEAL_STAGES, assertDealInvariant, validateDealInvariant } from "@/modules/deals/domain/rules/dealStages";

assert.deepEqual(Object.values(DealStage), [
  "DISCOVERY",
  "QUALIFIED",
  "SOLUTION",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
]);
assert.deepEqual(DEFAULT_DEAL_STAGES.map((stage) => stage.code), Object.values(DealStage));

const activeDeal = createDeal("deal-active", DealStage.DISCOVERY);
assert.equal(validateDealInvariant(activeDeal).length, 0);
assert.equal(validateDealInvariant({ ...activeDeal, nextActionAt: undefined, nextActionSummary: undefined, nextActionRef: undefined }).length, 0, "Active Deals may exist without a follow-up task.");

assert.match(validateDealInvariant({ ...activeDeal, stage: DealStage.WON, nextActionAt: undefined }).join(" "), /evidence/i);
assert.doesNotThrow(() => assertDealInvariant({
  ...activeDeal,
  stage: DealStage.WON,
  nextActionAt: undefined,
  nextActionSummary: undefined,
  nextActionRef: undefined,
  winEvidence: { type: "ORDER_CONFIRMED", sourceId: "order-1", occurredAt: "2026-07-07T00:00:00.000Z" },
}));
assert.match(validateDealInvariant({
  ...activeDeal,
  stage: DealStage.LOST,
  nextActionAt: undefined,
  lostReason: "Timing",
  recycleDecision: "RECYCLE",
}).join(" "), /revisitAt/i);

assert.equal(fs.existsSync("src/workflows/contact-opportunity-progress"), false, "Contact-owned Deal stage workflow must remain retired");
assert.equal(fs.existsSync("src/workflows/deal-closing"), false, "Customer-creating Deal closing workflow must remain retired");

const activeSource = [
  ...walkAllFiles("src/modules/deals"),
  ...walkAllFiles("src/modules/contacts/presentation"),
].filter((file) => /\.(ts|tsx)$/.test(file)).map(read).join("\n");
assert.equal(activeSource.includes("latestOpportunityStage"), false, "Contact must not mirror Deal stage");
assert.equal(activeSource.includes("markDealWonOnly"), false, "Legacy Customer-creating WON helper must not be active");
assert.equal(/\bDealStage\.(?:NEW|CONSULTING)\b/.test(activeSource), false, "Active Deal runtime must not use retired stages");

console.log("Deal lifecycle contracts: OK");

function createDeal(id: string, stage: DealStage): Deal {
  return {
    id,
    name: `Deal ${id}`,
    buyerRef: { type: "CONTACT", id: `contact-${id}` },
    stage,
    amount: 100,
    opportunityScore: 10,
    ownerId: "u1",
    expectedCloseDate: "2026-08-01",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    interestedProducts: [],
    lineItems: [],
    nextActionAt: "2026-07-10T09:00:00.000Z",
    nextActionSummary: "Follow up",
    nextActionRef: { type: "MANUAL" },
  };
}

function read(file: string): string { return fs.readFileSync(file, "utf8"); }
