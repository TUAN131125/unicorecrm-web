import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  archiveQuote,
  saveQuote,
  updateManyQuotes,
  updateQuote,
} from "@/modules/quotes/application/commands/quoteRepositoryCommands";
import {
  approveQuote,
  changeQuoteStatus,
  duplicateQuote,
  recordQuoteDelivery,
  requestQuoteApproval,
  reviseQuote,
} from "@/modules/quotes/application/commands/quoteCommands";
import {
  getQuoteDealId,
  getQuoteStats,
  isQuoteAccepted,
  queryQuotes,
} from "@/modules/quotes/application/queries/quoteQueries";
import { validateQuoteDraft } from "@/modules/quotes/application/queries/quoteDraftValidation";
import { calculateQuoteDraftTotals } from "@/modules/quotes/domain/rules/quoteDraftPricing";
import { isQuoteVersionImmutable } from "@/modules/quotes/domain/rules/quoteVersioning";
import { applyQuoteApprovalAssessment, DEFAULT_QUOTE_APPROVAL_POLICY } from "@/modules/quotes/domain/rules/quoteApprovalPolicy";
import { SalesDocumentAdjustmentType } from "@/modules/quotes";
import { InMemoryQuoteRepository } from "@/modules/quotes/infrastructure/InMemoryQuoteRepository";
import {
  QuoteApprovalStatus,
  QuoteStatus,
  type Quote,
} from "@/modules/quotes";
import { QUOTE_MODULE_MANIFEST } from "@/modules/quotes/manifest";
import { ModuleRegistry } from "@/platform/module-registry/ModuleRegistry";

const validationMessages = {
  minOneLineItem: "At least one line",
  productRequired: "Product required",
  rowNumber: (row: number) => `Row ${row}`,
  quantityInvalid: "Quantity invalid",
  unitPriceInvalid: "Price invalid",
  discountInvalid: "Discount invalid",
  titleRequired: "Title required",
};

const seed: Quote[] = [
  createQuote("quote-1", "Q-001", QuoteStatus.DRAFT, "deal-1", 100_000_000),
  createQuote("quote-2", "Q-002", QuoteStatus.SENT, "deal-2", 50_000_000),
];

const listeners = new Map<string, Set<(payload: unknown) => void>>();
const repository = new InMemoryQuoteRepository(seed, {
  publish: (eventName, payload) => listeners.get(eventName)?.forEach((listener) => listener(payload)),
  subscribe: (eventName, listener) => {
    const bucket = listeners.get(eventName) ?? new Set();
    bucket.add(listener as (payload: unknown) => void);
    listeners.set(eventName, bucket);
    return () => bucket.delete(listener as (payload: unknown) => void);
  },
});

let observedCount = 0;
const unsubscribe = repository.subscribe((quotes) => { observedCount = quotes.length; });
saveQuote(repository, createQuote("quote-3", "Q-003", QuoteStatus.DRAFT, undefined, 20_000_000));
assert.equal(repository.list().length, 3);
assert.equal(observedCount, 3);
unsubscribe();

// SENT and terminal versions are immutable. The business content cannot be edited in place.
assert.throws(
  () => updateQuote(repository, "quote-2", (quote) => ({ ...quote, grandTotal: 75_000_000 })),
  /immutable/i,
);
assert.equal(repository.getById("quote-2")?.grandTotal, 50_000_000);

// Mutable DRAFT/REVIEW versions may be edited.
const updatedMany = updateManyQuotes(repository, ["quote-1", "quote-3"], (quote) => ({ ...quote, senderName: "Tester" }));
assert.equal(updatedMany, 2);
assert.equal(repository.getById("quote-1")?.senderName, "Tester");

// Standard Quotes can be sent directly without an internal review step.
changeQuoteStatus(repository, "quote-1", QuoteStatus.SENT, "2026-07-06T09:00:00.000Z");
assert.equal(repository.getById("quote-1")?.sentAt, "2026-07-06T09:00:00.000Z");
changeQuoteStatus(repository, "quote-1", QuoteStatus.ACCEPTED, "2026-07-07T10:00:00.000Z");
assert.equal(repository.getById("quote-1")?.acceptedAt, "2026-07-07T10:00:00.000Z");
assert.equal(isQuoteVersionImmutable(repository.getById("quote-1")!.status), true);

// Revision creates a new mutable version in the same version lineage.
const revision = reviseQuote(repository, "quote-1", "2026-07-08T00:00:00.000Z", () => "quote-1-v2");
assert.ok(revision);
assert.equal(revision?.status, QuoteStatus.DRAFT);
assert.equal(revision?.version, 2);
assert.equal(revision?.rootQuoteId, "quote-1");
assert.equal(revision?.revisionOfQuoteId, "quote-1");
assert.equal(repository.list().length, 4);

// Duplicate is a new independent document root, not another revision.
const copy = duplicateQuote(repository, "quote-1", "Copy Q-001", "2026-07-09T00:00:00.000Z");
assert.equal(copy?.status, QuoteStatus.DRAFT);
assert.equal(copy?.version, 1);
assert.equal(copy?.rootQuoteId, copy?.id);
assert.equal(copy?.revisionOfQuoteId, undefined);
assert.notEqual(copy?.rootQuoteId, revision?.rootQuoteId);
assert.equal(repository.list().length, 5);

// Approval policy is separate from customer-facing Quote status.
updateQuote(repository, "quote-3", (quote) => applyQuoteApprovalAssessment({
  ...quote,
  subtotal: 200_000_000,
  grandTotal: 200_000_000,
}, DEFAULT_QUOTE_APPROVAL_POLICY));
assert.equal(repository.getById("quote-3")?.approvalRequired, true);
assert.equal(repository.getById("quote-3")?.approvalStatus, QuoteApprovalStatus.PENDING);
assert.throws(
  () => changeQuoteStatus(repository, "quote-3", QuoteStatus.SENT, "2026-07-10T00:00:00.000Z"),
  /approval/i,
);
requestQuoteApproval(repository, "quote-3", { actorId: "sales-user", now: "2026-07-10T01:00:00.000Z" });
assert.equal(repository.getById("quote-3")?.approvalRequestedAt, "2026-07-10T01:00:00.000Z");
assert.equal(queryQuotes(repository, { search: "Q-002" }).length, 1);
const stats = getQuoteStats(repository.list());
assert.equal(stats.total, 5);
assert.equal(stats.accepted, 1);
assert.equal(stats.review, 1);
approveQuote(repository, "quote-3", { actorId: "sales-manager", now: "2026-07-10T02:00:00.000Z" });
assert.equal(repository.getById("quote-3")?.approvalStatus, QuoteApprovalStatus.APPROVED);
recordQuoteDelivery(repository, "quote-3", {
  id: "delivery-q3",
  channel: "GMAIL",
  recipientEmail: "customer@example.com",
  sentAt: "2026-07-10T03:00:00.000Z",
  sentBy: "sales-user",
  fileName: "Q-003.pdf",
});
assert.equal(repository.getById("quote-3")?.status, QuoteStatus.SENT);
assert.equal(repository.getById("quote-3")?.deliveryHistory?.length, 1);
assert.equal(repository.getById("quote-3")?.sentAt, "2026-07-10T03:00:00.000Z");
recordQuoteDelivery(repository, "quote-3", {
  id: "delivery-q3-zalo",
  channel: "ZALO",
  recipient: "0909000000",
  sentAt: "2026-07-10T03:30:00.000Z",
  sentBy: "sales-user",
  note: "Customer confirmed receipt in Zalo",
});
assert.equal(repository.getById("quote-3")?.deliveryHistory?.length, 2);
assert.equal(repository.getById("quote-3")?.deliveryHistory?.[1]?.channel, "ZALO");
assert.equal(repository.getById("quote-3")?.deliveryHistory?.[1]?.recipient, "0909000000");
assert.equal(repository.getById("quote-3")?.sentAt, "2026-07-10T03:00:00.000Z", "Additional delivery evidence must preserve the first sent time");
assert.throws(
  () => recordQuoteDelivery(repository, "quote-3", {
    id: "delivery-q3-missing-recipient",
    channel: "CHAT_APP",
    sentAt: "2026-07-10T04:00:00.000Z",
  }),
  /recipient or destination/i,
);

assert.equal(isQuoteAccepted(QuoteStatus.ACCEPTED), true);
assert.equal(isQuoteAccepted(QuoteStatus.SENT), false);
assert.equal(getQuoteDealId({ dealId: "deal-primary", sourceDealId: "deal-legacy" }), "deal-primary");
assert.equal(getQuoteDealId({ sourceDealId: "deal-legacy" }), "deal-legacy");

const totals = calculateQuoteDraftTotals([{
  id: "line-1",
  productName: "CRM",
  quantity: 2,
  unitPrice: 1_000_000,
  discountPercent: 10,
}], [{
  id: "tax",
  type: SalesDocumentAdjustmentType.TAX,
  label: "VAT",
  calculation: "PERCENTAGE",
  value: 10,
  amount: 0,
}]);
assert.equal(totals.subtotal, 2_000_000);
assert.equal(totals.discountTotal, 200_000);
assert.equal(totals.taxTotal, 180_000);
assert.equal(totals.grandTotal, 1_980_000);

assert.equal(validateQuoteDraft("", [], validationMessages), "At least one line");
assert.equal(validateQuoteDraft("Valid", [{
  id: "line-valid",
  productName: "CRM",
  quantity: 1,
  unitPrice: 100,
  discountPercent: 0,
}], validationMessages), null);

archiveQuote(repository, copy!.id, { reason: "Retention policy contract", actorId: "tester", actorName: "Tester", now: "2026-07-09T00:00:00.000Z" });
assert.equal(repository.list().length, 5, "Archiving a Quote must retain the record.");
assert.equal(repository.getById(copy!.id)?.archivedAt, "2026-07-09T00:00:00.000Z");

const registry = new ModuleRegistry().register(QUOTE_MODULE_MANIFEST);
assert.equal(registry.get("quotes")?.routes.length, 5);

const presentationRoot = path.resolve("src/modules/quotes/presentation");
for (const file of walkAllFiles(presentationRoot)) {
  if (!/\.(ts|tsx)$/.test(file)) continue;
  const source = fs.readFileSync(file, "utf8");
  assert.equal(/\blocalStorage\s*\./.test(source), false, `${file} must not access browser storage directly`);
}

console.log("Quote module checks: OK");

function createQuote(
  id: string,
  quoteNumber: string,
  status: QuoteStatus,
  dealId: string | undefined,
  grandTotal: number,
): Quote {
  return {
    id,
    quoteNumber,
    version: 1,
    rootQuoteId: id,
    buyerRef: { type: "CONTACT", id: `contact-${id}` },
    sourcePath: dealId ? "DEAL" : "DIRECT_SALE",
    sourceDealId: dealId,
    dealId,
    status,
    title: `Quote ${quoteNumber}`,
    lineItems: [],
    subtotal: grandTotal,
    grandTotal,
    createdAt: "2026-07-01T00:00:00.000Z",
  };
}

