import assert from "node:assert/strict";
import fs from "node:fs";
import {
  QuoteStatus,
  canTransitionQuoteStatus,
  isQuoteVersionImmutable,
  assertQuoteMutationAllowed,
  type Quote,
} from "@/modules/quotes";
import { validateDirectSaleReadiness } from "@/workflows/lead-qualification/domain/leadQualification.rules";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

assert.equal(canTransitionQuoteStatus(QuoteStatus.DRAFT, QuoteStatus.SENT), true);
assert.equal(canTransitionQuoteStatus(QuoteStatus.DRAFT, QuoteStatus.REVIEW), true, "Legacy REVIEW remains readable/mutable during migration");
assert.equal(canTransitionQuoteStatus(QuoteStatus.REVIEW, QuoteStatus.SENT), true);
assert.equal(isQuoteVersionImmutable(QuoteStatus.SENT), true);
assert.equal(isQuoteVersionImmutable(QuoteStatus.ACCEPTED), true);
assert.equal(isQuoteVersionImmutable(QuoteStatus.REVIEW), false);
const sentQuote = createQuote("quote-sent", QuoteStatus.SENT, "DEAL");
assert.throws(() => assertQuoteMutationAllowed(sentQuote, { ...sentQuote, title: "Mutated after send" }), /immutable/i);
assert.doesNotThrow(() => assertQuoteMutationAllowed(sentQuote, { ...sentQuote, updatedAt: "2026-07-08T00:00:00.000Z" }));

const directQuote = createQuote("quote-direct", QuoteStatus.DRAFT, "DIRECT_SALE");
assert.equal(directQuote.dealId, undefined);
assert.equal(directQuote.sourceDealId, undefined);
assert.equal(directQuote.sourcePath, "DIRECT_SALE");

const directSaleBase = {
  leadId: "lead-1",
  relationship: {
    kind: "CONTACT" as const,
    mode: "EXISTING" as const,
    selectedId: "contact-1",
    contact: { name: "Buyer" },
  },
  lineItems: [{ productId: "p1", name: "CRM", quantity: 1, unitPrice: 100 }],
  orderEnabled: true,
  actorCanSellNow: true,
  currency: "VND",
};
assert.deepEqual(validateDirectSaleReadiness({ ...directSaleBase, path: "ORDER", quoteEnabled: false }), []);
assert.match(validateDirectSaleReadiness({ ...directSaleBase, path: "QUOTE", quoteEnabled: false }).join(" "), /Quote is disabled/i);

const directSaleSource = read("src/workflows/lead-qualification/application/executeLeadDirectSale.ts");
assert.match(directSaleSource, /sourcePath:\s*"DIRECT_SALE"/);
assert.equal(/dealId\s*:/.test(directSaleSource), false, "Direct Sale Quote must not require Deal fields");
assert.equal(/ports\.deals\.create/.test(directSaleSource), false, "Direct Sale must never create a hidden Deal");

const opportunitySource = read("src/workflows/lead-qualification/application/executeLeadOpportunity.ts");
assert.match(opportunitySource, /ports\.deals\.create/);
assert.match(opportunitySource, /dealRef:\s*dealId/);

const quoteBuilderSource = read("src/modules/quotes/presentation/pages/QuoteBuilderPage.tsx");
assert.match(quoteBuilderSource, /createQuoteRevision/);
const quoteRuleSource = read("src/modules/quotes/domain/rules/quoteVersioning.ts");
assert.match(quoteRuleSource, /QuoteStatus\.REVIEW/);
assert.match(quoteRuleSource, /SENT or terminal Quote versions are immutable/);

console.log("Quote and Direct Sale contracts: OK");

function createQuote(id: string, status: QuoteStatus, sourcePath: Quote["sourcePath"]): Quote {
  const dealId = sourcePath === "DEAL" ? `deal-${id}` : undefined;
  return {
    id,
    quoteNumber: `Q-${id}`,
    version: 1,
    rootQuoteId: id,
    buyerRef: { type: "CONTACT", id: `contact-${id}` },
    sourcePath,
    dealId,
    sourceDealId: dealId,
    status,
    title: `Quote ${id}`,
    lineItems: [],
    subtotal: 100,
    grandTotal: 100,
    createdAt: "2026-07-01T00:00:00.000Z",
  };
}

function read(file: string): string { return readPresentationComposition(file, "utf8"); }
