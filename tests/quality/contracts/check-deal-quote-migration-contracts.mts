import assert from "node:assert/strict";
import { DealStage } from "@/modules/deals/domain/model/deal.types";
import { previewDealNormalization, previewQuoteNormalization } from "@/migrations/canonical-v1/dealQuoteNormalization";

const mappedNew = previewDealNormalization({
  id: "legacy-new",
  name: "Legacy New",
  stage: "NEW",
  ownerId: "u1",
  amount: 10,
  expectedCloseDate: "2026-08-01",
  nextActivity: { date: "2026-07-10T09:00:00.000Z", title: "Call buyer" },
}, { buyerRef: { type: "CONTACT", id: "contact-1" } });
assert.equal(mappedNew.canonicalStage, DealStage.DISCOVERY);
assert.equal(mappedNew.disposition, "INFER");
assert.equal(mappedNew.canAutoMigrate, true);
assert.equal(mappedNew.candidate.nextActionAt, "2026-07-10T09:00:00.000Z");

const ambiguousConsulting = previewDealNormalization({
  id: "legacy-consulting",
  name: "Ambiguous Consulting",
  stage: "CONSULTING",
  ownerId: "u1",
}, { buyerRef: { type: "CONTACT", id: "contact-1" } });
assert.equal(ambiguousConsulting.disposition, "REVIEW");
assert.equal(ambiguousConsulting.canAutoMigrate, false);
assert.ok(ambiguousConsulting.issues.some((issue) => issue.rule === "LEGACY_CONSULTING_STAGE_AMBIGUOUS"));
assert.equal(ambiguousConsulting.issues.some((issue) => issue.rule === "ACTIVE_DEAL_NEXT_ACTION_REQUIRED"), false, "An optional follow-up task must not block legacy Deal normalization.");

const directQuoteMigration = previewQuoteNormalization({
  id: "legacy-quote",
  quoteNumber: "LQ-1",
  status: "SENT",
  title: "Legacy direct proposal",
  subtotal: 100,
  grandTotal: 100,
  createdAt: "2026-07-01T00:00:00.000Z",
}, { buyerRef: { type: "CONTACT", id: "contact-1" } });
assert.equal(directQuoteMigration.candidate?.version, 1);
assert.equal(directQuoteMigration.candidate?.rootQuoteId, "legacy-quote");
assert.equal(directQuoteMigration.candidate?.sourcePath, "DIRECT_SALE");
assert.equal(directQuoteMigration.candidate?.dealId, undefined);

console.log("Deal and Quote migration contracts: OK");
