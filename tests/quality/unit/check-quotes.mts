import { quoteOrderStateLabel } from "@/modules/quotes/presentation/model/quoteOrderPresentation";
import { verifyQuoteListPaging } from "./quoteListPagingChecks";
import { buildPaymentAgreementSnapshot, canEditAgreementWithDraftControls, draftLinesFromAgreement, legacyAgreementDraftLine, resolveDraftPaymentAgreement } from "@/modules/quotes/presentation/model/quotePaymentAgreementDraft";
import { compareQuotePricing, quotePricingReconciliationNotice } from "@/modules/quotes/presentation/model/quotePricingReconciliation";
import { configureQuoteApplication, resetQuoteApplication } from "@/modules/quotes/application/composition/quoteApplicationServices";
import { createQuoteDemoApiRuntime } from "@/modules/quotes/runtime/createQuoteDemoApiRuntime";
import { requestQuoteApprovalChangesCommand, saveQuoteCommand } from "@/modules/quotes/public/quotes";
import type { QuoteRepository } from "@/modules/quotes/application/ports/QuoteRepository";
import type { QuoteMutationResult } from "@/modules/quotes/application/ports/QuoteApiRuntime";
import { mapCreateQuoteDraftRequest } from "@/modules/quotes/infrastructure/http/QuoteApiMapper";
import { resolveQuoteActionIds } from "@/modules/quotes/presentation/model/quoteActionPolicy";
import { ApplicationError } from "@/shared/domain";
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
const directDelivery = new InMemoryQuoteRepository([structuredClone(repository.getById("quote-3") as Quote)], { publish: () => undefined, subscribe: () => () => undefined });
assert.equal(changeQuoteStatus(directDelivery, "quote-3", QuoteStatus.SENT, "2026-07-10T00:00:00.000Z")?.status, QuoteStatus.SENT);
assert.equal(directDelivery.getById("quote-3")?.approvalStatus, QuoteApprovalStatus.PENDING, "Direct delivery preserves historical approval metadata");
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

// Connected core must not accidentally enable lifecycle commands through broad update permission.
const corePermissions = { canView: true, canUpdate: true, canApprove: true, canCreate: true, canDelete: true, canCreateOrder: true, draftCoreOnly: true };
assert.deepEqual(resolveQuoteActionIds({ status: QuoteStatus.DRAFT }, corePermissions), ["view", "export-pdf", "edit"]);
assert.deepEqual(resolveQuoteActionIds({ status: QuoteStatus.REVIEW }, corePermissions), ["view", "export-pdf", "edit"]);
assert.deepEqual(resolveQuoteActionIds({ status: QuoteStatus.SENT }, corePermissions), ["view", "export-pdf"]);
const approvalPermissions = { ...corePermissions, approvalCommandsReady: true };
assert.deepEqual(resolveQuoteActionIds({ status: QuoteStatus.DRAFT }, approvalPermissions), ["view", "export-pdf", "edit"]);
assert.deepEqual(resolveQuoteActionIds({ status: QuoteStatus.REVIEW, approvalRequired: true, approvalStatus: QuoteApprovalStatus.PENDING, approvalRequestedAt: "2026-10-24T00:00:00Z" }, approvalPermissions), ["view", "export-pdf", "edit"]);
assert.deepEqual(resolveQuoteActionIds({ status: QuoteStatus.SENT }, approvalPermissions), ["view", "export-pdf"]);
const roundingLine = { id: "precision", productNameSnapshot: "Manual", quantity: 1, unitPriceSnapshot: 1.2345, discountPercent: 0 };
assert.equal(calculateQuoteDraftTotals([roundingLine], [], 0).grandTotal, 1);
assert.equal(calculateQuoteDraftTotals([roundingLine], [], 3).grandTotal, 1.235);
assert.equal(calculateQuoteDraftTotals([{ ...roundingLine, unitPriceSnapshot: 0.5 }], [], 0).grandTotal, 1);
const draftRequest = mapCreateQuoteDraftRequest({
  buyerRef: { type: "CONTACT", id: "contact-one" }, sourcePath: "DIRECT_SALE", title: "Draft", currency: "VND", lineItems: [],
  paymentAgreement: { version: 1, kind: "FULL_PAYMENT", currency: "VND", sourceQuoteId: "local-intent", policyVersion: "v1", lines: [{ id: "local-line", sequence: 1, label: "Full", purpose: "FULL", amountRule: { type: "REMAINDER" }, previewAmount: { amount: "10", currency: "VND" }, dueRule: { type: "EVENT_RELATIVE", event: "ORDER_CONFIRMED", offsetDays: 0, dayBasis: "CALENDAR" }, allowedMethodCodes: ["BANK_TRANSFER"], fulfillmentGate: "NONE" }] },
});
assert(draftRequest.paymentAgreement);
assert.equal("version" in draftRequest.paymentAgreement, false);
assert.equal("sourceQuoteId" in draftRequest.paymentAgreement, false);
assert.equal("id" in draftRequest.paymentAgreement.lines[0], false);
assert.equal("previewAmount" in draftRequest.paymentAgreement.lines[0], false);

// Exercise the public command boundary: routing and opening versions must survive cache refreshes.
let cache: Quote[] = [];
const projection: QuoteRepository = { list: () => cache, getById: id => cache.find(item => item.id === id), replace: values => { cache = values; }, subscribe: () => () => undefined };
const runtime = createQuoteDemoApiRuntime(projection);
let receivedPrice: string | undefined;
const calls: Array<{ path: string; version?: number; key: string }> = [];
const accepted = { ...createQuote("server-quote", "Q-0000000001", QuoteStatus.DRAFT, undefined, 15), resourceVersion: 1 };
const evidence: QuoteMutationResult["evidence"] = { authority: "backend", commandId: "command-one", correlationId: "correlation-one", aggregateId: accepted.id, aggregateType: "Quote", version: 1, occurredAt: "2026-10-24T00:00:00Z", outcome: "COMMITTED", warnings: [], emittedEventIds: [], auditEvidenceIds: ["audit-one"] };
configureQuoteApplication({ repository: projection, preferences: { get: (_key, fallback) => fallback, set: () => undefined, remove: () => undefined }, api: { ...runtime, mode: "connected", commands: { ...runtime.commands,
  async createDraft(_input, options) { calls.push({ path: "direct", key: options.idempotencyKey }); return { quote: accepted, evidence }; },
  async createDraftForDeal(id, _input, options) { calls.push({ path: id, version: options.expectedVersion, key: options.idempotencyKey }); return { quote: { ...accepted, sourcePath: "DEAL", sourceDealId: id }, evidence }; },
  async replaceDraft(id, _input, options) { receivedPrice = _input.lineItems[0]?.unitPrice.amount; calls.push({ path: id, version: options.expectedVersion, key: options.idempotencyKey }); return { quote: { ...accepted, resourceVersion: 4 }, evidence: { ...evidence, version: 4 } }; },
  async requestApprovalChanges(id, _input, options) { calls.push({ path: id, version: options.expectedVersion, key: options.idempotencyKey }); return { quote: accepted, evidence }; },
} } });
const localCandidate = createQuote("temporary-intent", "", QuoteStatus.DRAFT, undefined, 999);
const directOutcome = await saveQuoteCommand(localCandidate, { idempotencyKey: "direct-stable" });
assert.equal(calls.at(-1)?.path, "direct");
assert.equal(directOutcome.data.id, "server-quote");
assert.equal(directOutcome.data.grandTotal, 15, "Only server totals may become the accepted Quote");
assert.equal(cache[0]?.quoteNumber, "Q-0000000001");
await saveQuoteCommand({ ...localCandidate, sourcePath: "DEAL", sourceDealId: "deal-source" }, { expectedVersion: 7, idempotencyKey: "deal-stable" });
assert.deepEqual(calls.at(-1), { path: "deal-source", version: 7, key: "deal-stable" });
await saveQuoteCommand({ ...localCandidate, sourcePath: "DEAL", sourceDealId: "deal-zero" }, { expectedVersion: 0, idempotencyKey: "deal-zero" });
assert.equal(calls.at(-1)?.version, 0);
await assert.rejects(() => saveQuoteCommand({ ...localCandidate, sourcePath: "DEAL", sourceDealId: "deal-source" }), { code: "DEAL_RESOURCE_VERSION_REQUIRED" });
cache = [{ ...accepted, resourceVersion: 9 }];
await saveQuoteCommand({ ...accepted, resourceVersion: 3 }, { idempotencyKey: "opening-version" });
assert.equal(calls.at(-1)?.version, 3, "A newer cache snapshot must not silently replace the editor opening version");
const dialogOpeningVersion = 4; // Legacy command compatibility still preserves an explicit opening version.
cache = [{ ...accepted, resourceVersion: 10 }];
await requestQuoteApprovalChangesCommand(accepted.id, { actorId: "approver", note: "Changes from the opening dialog" }, { expectedVersion: dialogOpeningVersion, idempotencyKey: "changes-opening-version" });
assert.equal(calls.at(-1)?.version, 4, "A newer cache value must not replace the approval dialog's captured If-Match");
const differences = compareQuotePricing({ ...accepted, grandTotal: 20 }, accepted, 0);
assert.deepEqual(differences, [{ field: "grandTotal", preview: "20", authoritative: "15" }]);
assert.match(quotePricingReconciliationNotice(differences, "VND", "vi"), /20 → 15 VND/u);
assert.match(quotePricingReconciliationNotice(differences, "VND", "en"), /server-calculated totals/u);
assert.deepEqual(compareQuotePricing(accepted, accepted, 0), []);
const exactPrice = "1000000000000000000.123456";
await saveQuoteCommand({ ...accepted, resourceVersion: 3, lineItems: [{ id: "exact-line", productNameSnapshot: "Exact manual", quantity: 1, unitPriceSnapshot: Number(exactPrice), discountPercent: 0, inputDecimals: { unitPrice: exactPrice } }] }, { idempotencyKey: "exact-price" });
assert.equal(receivedPrice, exactPrice, "Title-only edits retain exact accepted price beyond JS number precision");
await assert.rejects(() => saveQuoteCommand({ ...accepted, resourceVersion: 3, lineItems: [{ id: "unsafe-line", productNameSnapshot: "Unsafe manual", quantity: 1, unitPriceSnapshot: Number(exactPrice), discountPercent: 0 }] }, { idempotencyKey: "unsafe-price" }), { code: "VALIDATION_FAILED" });
resetQuoteApplication();

const historicalDraftOrder = { state: "DRAFT" as const, autoConfirmRequested: true };
assert.equal(quoteOrderStateLabel(historicalDraftOrder, true), "Nháp", "Acceptance intent must never relabel a persisted historical DRAFT Order");
assert.equal(quoteOrderStateLabel({ state: "CONFIRMED" }, false), "Confirmed");
assert.equal(quoteOrderStateLabel({ state: "CANCELLED" }, true), "Đã hủy");
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


const normalAgreement = buildPaymentAgreementSnapshot([legacyAgreementDraftLine()], 100, "VND", "terms-quote");
const termsQuote = { ...accepted, paymentAgreement: normalAgreement };
assert.equal(canEditAgreementWithDraftControls(termsQuote), true);
assert.equal(resolveDraftPaymentAgreement(termsQuote, draftLinesFromAgreement(termsQuote), 200, "VND"), normalAgreement, "Untouched terms retain exact original command content despite commercial changes");
const fixedAgreement: NonNullable<Quote["paymentAgreement"]> = { ...normalAgreement, lines: normalAgreement.lines.map(line => ({ ...line, amountRule: { type: "FIXED", amount: { amount: "9007199254740993", currency: "VND" } }, dueRule: { type: "EVENT_RELATIVE", event: "INVOICE_ISSUED", offsetDays: -2, dayBasis: "BUSINESS" } })) };
const fixedTermsQuote = { ...accepted, paymentAgreement: fixedAgreement };
assert.equal(canEditAgreementWithDraftControls(fixedTermsQuote), false);
assert.equal(resolveDraftPaymentAgreement(fixedTermsQuote, draftLinesFromAgreement(fixedTermsQuote), 300, "VND"), fixedAgreement, "Unsupported fixed/advanced rules must remain byte-exact at the command mapper");
assert.deepEqual(mapCreateQuoteDraftRequest({ title: "Preserved terms", currency: "VND", sourcePath: "DIRECT_SALE", lineItems: [], paymentAgreement: fixedAgreement, buyerRef: { type: "CONTACT", id: "buyer" } }).paymentAgreement?.lines[0]?.amountRule, fixedAgreement.lines[0]?.amountRule);

await verifyQuoteListPaging();
