import assert from "node:assert/strict";
import { money } from "@/shared/money";
import { InMemoryInvoiceRepository } from "@/modules/invoices/infrastructure/InMemoryInvoiceRepository";
import { InMemoryInvoiceApiAdapter } from "@/modules/invoices/infrastructure/InMemoryInvoiceApiAdapter";
import { recordInvoiceIssueFailure } from "@/modules/invoices/application/commands/invoiceCommands";

const repo = new InMemoryInvoiceRepository({ accountingAsOfDate: "2026-07-15" });
const api = new InMemoryInvoiceApiAdapter(repo);
const baseInput = {
  buyerRef: { type: "CONTACT", id: "buyer" } as const,
  sellerSnapshot: { displayName: "Seller", addressLines: [] },
  buyerSnapshot: { displayName: "Buyer", addressLines: [] },
  currency: "VND",
  dueDate: "2026-07-20",
  lines: [{
    clientLocalId: "line-local-1",
    description: "Service",
    quantity: "1",
    unitPrice: money("100", "VND"),
    discountRate: "10",
    taxRate: "10",
  }],
  sourceLinks: { orderId: "order" },
  creationIntentId: "create-intent-001",
  idempotencyKey: "invoice-draft",
};

const draft = await api.createDraft(baseInput);
assert.notEqual(draft.id, baseInput.creationIntentId, "Demo backend adapter must issue an aggregate ID distinct from the client creation intent.");
assert.equal(draft.totals.subtotal.amount, "100");
assert.equal(draft.totals.discountTotal.amount, "10");
assert.equal(draft.totals.taxTotal.amount, "9");
assert.equal(draft.totals.grandTotal.amount, "99");
assert.equal((await api.getIssueReadiness(draft.id)).ready, true);

const saved = await api.saveDraft({
  invoiceId: draft.id,
  expectedVersion: draft.version,
  idempotencyKey: "invoice-save-001",
  sellerSnapshot: draft.sellerSnapshot,
  buyerSnapshot: { ...draft.buyerSnapshot, displayName: "Buyer Updated" },
  dueDate: draft.dueDate,
  paymentTerms: "Net 15",
  lines: [{
    lineId: draft.lines[0].id,
    description: "Service",
    quantity: "2",
    unitPrice: money("100", "VND"),
    discountRate: "0",
    taxRate: "10",
  }],
});
assert.equal(saved.version, draft.version + 1);
assert.equal(saved.totals.subtotal.amount, "200");
assert.equal(saved.totals.discountTotal.amount, "0");
assert.equal(saved.totals.taxTotal.amount, "20");
assert.equal(saved.totals.grandTotal.amount, "220");

await assert.rejects(() => api.saveDraft({
  invoiceId: saved.id,
  expectedVersion: draft.version,
  idempotencyKey: "invoice-save-stale",
  sellerSnapshot: saved.sellerSnapshot,
  buyerSnapshot: saved.buyerSnapshot,
  lines: saved.lines.map((line) => ({
    lineId: line.id,
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
  })),
}), /VERSION_CONFLICT/u);

const issued = await api.issue(saved.id, { expectedVersion: saved.version });
assert.equal(issued.lifecycleState, "ISSUED");
assert.ok(issued.invoiceNumber);
await assert.rejects(() => api.saveDraft({
  invoiceId: issued.id,
  expectedVersion: issued.version,
  idempotencyKey: "invoice-save-issued",
  sellerSnapshot: issued.sellerSnapshot,
  buyerSnapshot: { ...issued.buyerSnapshot, displayName: "Changed" },
  lines: issued.lines.map((line) => ({ lineId: line.id, description: line.description, quantity: line.quantity, unitPrice: line.unitPrice })),
}), /immutable|DRAFT state/iu);

const note = await api.createCreditNote({
  invoiceId: issued.id,
  expectedInvoiceVersion: issued.version,
  reasonCode: "ADJUST",
  reason: "Adjustment",
  amount: money("20", "VND"),
  idempotencyKey: "credit-note",
});
assert.equal(note.creditNote.state, "ISSUED");
assert.equal(note.evidence.authority, "demo");

const retryDraft = await api.createDraft({ ...baseInput, creationIntentId: "create-intent-002", idempotencyKey: "invoice-retry" });
const failed = recordInvoiceIssueFailure(repo, retryDraft.id, {
  expectedVersion: retryDraft.version,
  failureCode: "PROVIDER_DOWN",
  now: "2026-07-15T00:00:00.000Z",
});
const retried = await api.retryIssue(failed.id, { expectedVersion: failed.version });
assert.equal(retried.invoice.lifecycleState, "ISSUED");
assert.equal(retried.evidence.authority, "demo");
console.log("Invoice domain contracts: PASS");
