import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { AppEventBus } from "../../../src/platform/events/AppEventBus";
import type { StoragePort } from "../../../src/platform/persistence/StoragePort";
import {
  FrontendRequestError,
  clearFrontendRequestScenarios,
  configureFrontendRequestScenario,
  executeFrontendRequest,
} from "../../../src/platform/request-simulation/index";
import { InMemoryQuoteRepository } from "../../../src/modules/quotes/infrastructure/InMemoryQuoteRepository";
import { QUOTE_SEED } from "../../../src/modules/quotes/infrastructure/quote.mock";
import {
  QuoteStatus,
  calculateQuotePricing,
  getQuoteConversionIssues,
  withCanonicalQuotePricing,
  type Quote,
} from "../../../src/modules/quotes/index";
import { InMemoryOrderRepository } from "../../../src/modules/orders/infrastructure/InMemoryOrderRepository";
import { INITIAL_ORDERS } from "../../../src/modules/orders/infrastructure/order.mock";
import {
  assertOrderCommercialMutationAllowed,
  calculateOrderLineTotals,
  normalizeSourceLineItemToOrderItem,
  withCanonicalOrderPricing,
  type CustomerOrder,
} from "../../../src/modules/orders/index";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;

class TestEventBus implements AppEventBus {
  private readonly listeners = new Map<string, Set<(payload: unknown) => void>>();
  publish<TPayload = void>(eventName: string, payload?: TPayload): void {
    this.listeners.get(eventName)?.forEach((listener) => listener(payload));
  }
  subscribe<TPayload = void>(eventName: string, listener: (payload: TPayload) => void): () => void {
    const listeners = this.listeners.get(eventName) ?? new Set<(payload: unknown) => void>();
    listeners.add(listener as (payload: unknown) => void);
    this.listeners.set(eventName, listeners);
    return () => listeners.delete(listener as (payload: unknown) => void);
  }
}

class TestStorage implements StoragePort {
  readonly values = new Map<string, unknown>();
  constructor(private readonly writeMode: "normal" | "drop" | "throw" = "normal") {}
  get<T>(key: string): T | null { return structuredClone((this.values.get(key) as T | undefined) ?? null); }
  set<T>(key: string, value: T): void {
    if (this.writeMode === "throw") throw new Error("simulated storage failure");
    if (this.writeMode === "normal") this.values.set(key, structuredClone(value));
  }
  remove(key: string): void { this.values.delete(key); }
}


// Frontend-only service simulation supports deterministic latency and common backend failure classes.
configureFrontendRequestScenario("integrity.request", { failure: "unauthorized", once: true });
await assert.rejects(
  () => executeFrontendRequest("integrity.request", () => "unexpected"),
  (error: unknown) => error instanceof FrontendRequestError && error.status === 401 && error.code === "UNAUTHORIZED",
);
assert.equal(await executeFrontendRequest("integrity.request", () => "recovered"), "recovered", "One-shot failures must recover on the next request");
configureFrontendRequestScenario("integrity.request", { failure: "validation", fieldErrors: { title: "Required" } });
await assert.rejects(
  () => executeFrontendRequest("integrity.request", () => "unexpected"),
  (error: unknown) => error instanceof FrontendRequestError && error.status === 422 && error.fieldErrors?.title === "Required",
);
clearFrontendRequestScenarios();

// Quote: one canonical formula owns line discount, tax and grand total.
const quotePricing = calculateQuotePricing([{ id: "line", quantity: 2, unitPriceSnapshot: 100, discountPercent: 10, taxRateSnapshot: 10, taxModeSnapshot: "exclusive" }]);
assert.deepEqual(
  { subtotal: quotePricing.subtotal, discount: quotePricing.discountTotal, tax: quotePricing.taxTotal, grand: quotePricing.grandTotal },
  { subtotal: 200, discount: 20, tax: 18, grand: 198 },
  "Quote line tax must be included in grandTotal after the line discount",
);
const inclusiveQuote = calculateQuotePricing([{ id: "inclusive", quantity: 1, unitPriceSnapshot: 110, discountPercent: 0, taxRateSnapshot: 10, taxModeSnapshot: "inclusive" }]);
assert.equal(inclusiveQuote.taxTotal, 10);
assert.equal(inclusiveQuote.grandTotal, 110);

const draft = QUOTE_SEED.find((quote) => quote.id === "q1")!;
const accepted = QUOTE_SEED.find((quote) => quote.id === "q2")!;
assert.equal(withCanonicalQuotePricing(draft).grandTotal, 135_000_000);
assert.equal(draft.status, QuoteStatus.DRAFT);
assert.equal(accepted.status, QuoteStatus.ACCEPTED);
assert.ok(getQuoteConversionIssues(draft, "2026-06-15T00:00:00Z").some((issue) => issue.code === "NOT_ACCEPTED"));
assert.equal(getQuoteConversionIssues(accepted, "2026-06-05T00:00:00Z").length, 0);
assert.ok(getQuoteConversionIssues(accepted, "2026-07-01T00:00:00Z").some((issue) => issue.code === "EXPIRED"));

// Quote persistence: reload, malformed snapshots and write failures are deterministic.
const quoteStorage = new TestStorage();
const quoteRepository = new InMemoryQuoteRepository(QUOTE_SEED, new TestEventBus(), quoteStorage);
const additionalQuote: Quote = { ...structuredClone(draft), id: "q-persisted", rootQuoteId: "q-persisted", quoteNumber: "Q-2026-9999", title: "Persisted draft" };
quoteRepository.replace([additionalQuote, ...quoteRepository.list()]);
assert.ok(new InMemoryQuoteRepository(QUOTE_SEED, new TestEventBus(), quoteStorage).getById("q-persisted"));
const malformedQuoteStorage = new TestStorage();
malformedQuoteStorage.values.set("snapshot", { version: 1, records: [{ id: "broken" }] });
assert.equal(new InMemoryQuoteRepository(QUOTE_SEED, new TestEventBus(), malformedQuoteStorage).list().length, QUOTE_SEED.length);
assert.throws(() => new InMemoryQuoteRepository(QUOTE_SEED, new TestEventBus(), new TestStorage("drop")), /could not be saved/i);

// Order: line edits always recalculate tax from the immutable tax snapshot.
const recalculatedOrderLine = calculateOrderLineTotals({
  id: "order-line", productId: "p", productNameSnapshot: "Product", quantity: 3,
  unitPriceSnapshot: 100, discountPercent: 10, taxRateSnapshot: 8, taxModeSnapshot: "exclusive",
  lineSubtotal: 0, lineDiscountAmount: 0, lineTaxAmount: 0, lineTotal: 0,
});
assert.deepEqual(
  { subtotal: recalculatedOrderLine.lineSubtotal, discount: recalculatedOrderLine.lineDiscountAmount, tax: recalculatedOrderLine.lineTaxAmount, total: recalculatedOrderLine.lineTotal },
  { subtotal: 300, discount: 30, tax: 21.6, total: 291.6 },
);
const snapshotLine = normalizeSourceLineItemToOrderItem({
  id: "snapshot", productId: "p", productNameSnapshot: "Snapshot", quantity: 1,
  unitPriceSnapshot: 100, discountPercent: 0, taxRateSnapshot: 8, taxModeSnapshot: "exclusive",
}, [{ id: "p", name: "Mutable product", taxRate: 20, taxMode: "exclusive" }]);
assert.equal(snapshotLine.taxRateSnapshot, 8, "Quote tax snapshot must win over the mutable Product record");

const canonicalOrders = Object.values(INITIAL_ORDERS).flat().map(withCanonicalOrderPricing);
for (const order of canonicalOrders) assert.equal(order.totalAmount, order.grandTotal, `${order.orderNumber} totalAmount must equal grandTotal`);
const linkedOrder = canonicalOrders.find((order) => order.sourceQuoteId === accepted.id);
assert.equal(linkedOrder, undefined, "An accepted Quote linked to an open Deal must not already have an Order");

const orderStorage = new TestStorage();
const orderRepository = new InMemoryOrderRepository(INITIAL_ORDERS, new TestEventBus(), orderStorage);
const orderCopy: CustomerOrder = {
  ...structuredClone(canonicalOrders[0]), id: "o-persisted", orderNumber: "ORD-2026-9999", sourceQuoteId: undefined, sourceQuoteNumber: undefined,
};
const nextOrders = orderRepository.snapshot();
nextOrders["ORGANIZATION_ACCOUNT:org_c1"] = [orderCopy, ...(nextOrders["ORGANIZATION_ACCOUNT:org_c1"] ?? [])];
orderRepository.replace(nextOrders);
assert.ok(new InMemoryOrderRepository(INITIAL_ORDERS, new TestEventBus(), orderStorage).getById("o-persisted"));
const malformedOrderStorage = new TestStorage();
malformedOrderStorage.values.set("snapshot", { version: 1, records: { bad: [{ id: "broken" }] } });
assert.equal(new InMemoryOrderRepository(INITIAL_ORDERS, new TestEventBus(), malformedOrderStorage).list().length, canonicalOrders.length);
assert.throws(() => new InMemoryOrderRepository(INITIAL_ORDERS, new TestEventBus(), new TestStorage("drop")), /could not be saved/i);

const confirmedOrder = canonicalOrders.find((order) => order.state === "CONFIRMED")!;
const changedConfirmedOrder = structuredClone(confirmedOrder);
changedConfirmedOrder.items[0].quantity += 1;
assert.throws(() => assertOrderCommercialMutationAllowed(confirmedOrder, withCanonicalOrderPricing(changedConfirmedOrder)), /immutable/i);
const duplicateQuoteCollection = orderRepository.snapshot();
const linkedTemplate = { ...structuredClone(confirmedOrder), id: "linked-source", orderNumber: "ORD-2026-LINKED", sourceQuoteId: accepted.id, sourceQuoteNumber: accepted.quoteNumber };
const duplicated = { ...structuredClone(linkedTemplate), id: "duplicate-source", orderNumber: "ORD-2026-DUPLICATE" };
duplicateQuoteCollection["ORGANIZATION_ACCOUNT:org_c1"] = [linkedTemplate, duplicated, ...(duplicateQuoteCollection["ORGANIZATION_ACCOUNT:org_c1"] ?? [])];
assert.throws(() => orderRepository.replace(duplicateQuoteCollection), /already been converted/i);

// Static contracts protect every frontend entry point, not only visible buttons.
const quoteListSource = readPresentationComposition(path.join(root, "src/modules/quotes/presentation/pages/QuoteListPage.tsx"), "utf8");
assert.match(quoteListSource, /hidden: !canCreateQuote/);
assert.match(quoteListSource, /disabled={!canSelectQuotes}/);
assert.match(quoteListSource, /aria-label=.*Chọn báo giá/);
const quoteBuilderSource = readPresentationComposition(path.join(root, "src/modules/quotes/presentation/pages/QuoteBuilderPage.tsx"), "utf8");
assert.match(quoteBuilderSource, /allocateQuoteIdentitySnapshot/);
assert.match(quoteBuilderSource, /getQuoteConversionIssues/);
assert.match(quoteBuilderSource, /saveQuoteSnapshotAsync/);
assert.match(quoteBuilderSource, /save: \(\) => saveHandlerRef\.current\(\)/);
const orderFormSource = readPresentationComposition(path.join(root, "src/modules/orders/presentation/pages/OrderFormPage.tsx"), "utf8");
assert.match(orderFormSource, /ORDER_COMMERCIAL_IMMUTABLE/);
assert.match(fs.readFileSync(path.join(root, "src/modules/orders/presentation/model/orderFormSupport.ts"), "utf8"), /Confirmed Order commercial content is immutable/);
assert.match(orderFormSource, /existingLinkedOrder/);
assert.match(orderFormSource, /taxRateSnapshot/);
assert.match(orderFormSource, /form\.requestSubmit\(\)/);
const orderCommandsSource = readPresentationComposition(path.join(root, "src/modules/orders/application/commands/orderRepositoryCommands.ts"), "utf8");
assert.match(orderCommandsSource, /retentionClass: "DURABLE"/);
assert.match(orderCommandsSource, /action: "ARCHIVE"/);
const workflowSource = readPresentationComposition(path.join(root, "src/workflows/order-creation/index.ts"), "utf8");
assert.match(workflowSource, /assertQuoteConvertible/);
assert.match(workflowSource, /has already been converted to Order/);
assert.match(workflowSource, /does not preserve the Quote commercial snapshot/);
assert.match(workflowSource, /applyFrontendRequestScenario\("orders\.create"\)/);

console.log("Quote and Order integrity contracts: PASS");
