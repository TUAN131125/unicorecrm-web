import { CAPABILITIES, assertRuntimeCapability } from "@/platform/access-control/authorization";
import type { InvoiceRepository } from "../ports/InvoiceRepository";
import type { CreditNote, Invoice, InvoiceDeliveryRecord } from "../../domain/model/invoice.types";
import { assertInvoiceMutable, invoiceCommercialFingerprint, validateInvoiceDraft } from "../../domain/rules/invoiceRules";
import { compareMoney, isPositiveMoney, money, sumMoney } from "@/shared/money";

export function saveInvoiceDraft(repository: InvoiceRepository, invoice: Invoice): Invoice {
  const current = repository.listInvoices().find((item) => item.id === invoice.id);
  assertRuntimeCapability(current ? CAPABILITIES.INVOICES_UPDATE_DRAFT : CAPABILITIES.INVOICES_CREATE);
  if (current) {
    assertInvoiceMutable(current);
    if (invoice.version !== current.version + 1) throw new Error("INVOICE_VERSION_CONFLICT");
  }
  if (invoice.lifecycleState !== "DRAFT") throw new Error("Invoice draft command requires DRAFT state.");
  const replay = repository.listInvoices().find((item) => item.idempotencyKey === invoice.idempotencyKey && item.id !== invoice.id);
  if (replay) throw new Error("Invoice idempotency key already belongs to another Invoice.");
  const blockers = validateInvoiceDraft(invoice);
  if (blockers.length > 0) throw new Error(blockers.join(", "));
  return repository.saveInvoice(structuredClone(invoice));
}

export function issueInvoice(repository: InvoiceRepository, invoiceId: string, input: { expectedVersion: number; invoiceNumber: string; issueDate: string; issuedAt: string }): Invoice {
  assertRuntimeCapability(CAPABILITIES.INVOICES_ISSUE);
  const current = repository.listInvoices().find((item) => item.id === invoiceId);
  if (!current) throw new Error(`Invoice ${invoiceId} not found.`);
  assertInvoiceMutable(current);
  if (current.version !== input.expectedVersion) throw new Error("INVOICE_VERSION_CONFLICT");
  const blockers = validateInvoiceDraft(current);
  if (blockers.length > 0) throw new Error(blockers.join(", "));
  if (!input.invoiceNumber.trim()) throw new Error("Authoritative Invoice number is required.");
  return repository.saveInvoice({ ...current, invoiceNumber: input.invoiceNumber, issueDate: input.issueDate, lifecycleState: "ISSUED", issuedAt: input.issuedAt, issueFailureCode: undefined, version: current.version + 1, updatedAt: input.issuedAt });
}

export function retryInvoiceIssue(repository: InvoiceRepository, invoiceId: string, input: { expectedVersion: number; invoiceNumber: string; issueDate: string; issuedAt: string }): Invoice {
  assertRuntimeCapability(CAPABILITIES.INVOICES_ISSUE);
  const current = repository.listInvoices().find((item) => item.id === invoiceId);
  if (!current) throw new Error(`Invoice ${invoiceId} not found.`);
  if (current.lifecycleState !== "ISSUE_FAILED") throw new Error("Only ISSUE_FAILED Invoice can be retried.");
  if (current.version !== input.expectedVersion) throw new Error("INVOICE_VERSION_CONFLICT");
  const blockers = validateInvoiceDraft(current);
  if (blockers.length > 0) throw new Error(blockers.join(", "));
  if (!input.invoiceNumber.trim()) throw new Error("Authoritative Invoice number is required.");
  return repository.saveInvoice({ ...current, invoiceNumber: input.invoiceNumber, issueDate: input.issueDate, lifecycleState: "ISSUED", issuedAt: input.issuedAt, issueFailureCode: undefined, version: current.version + 1, updatedAt: input.issuedAt });
}

export function recordInvoiceIssueFailure(repository: InvoiceRepository, invoiceId: string, input: { expectedVersion: number; failureCode: string; now: string }): Invoice {
  const current = repository.listInvoices().find((item) => item.id === invoiceId);
  if (!current) throw new Error(`Invoice ${invoiceId} not found.`);
  if (current.version !== input.expectedVersion) throw new Error("INVOICE_VERSION_CONFLICT");
  return repository.saveInvoice({ ...current, lifecycleState: "ISSUE_FAILED", issueFailureCode: input.failureCode, version: current.version + 1, updatedAt: input.now });
}

export function discardInvoiceDraft(repository: InvoiceRepository, invoiceId: string, input: { expectedVersion: number; now: string }): Invoice {
  assertRuntimeCapability(CAPABILITIES.INVOICES_EDIT);
  const current = repository.listInvoices().find((item) => item.id === invoiceId);
  if (!current) throw new Error(`Invoice ${invoiceId} not found.`);
  assertInvoiceMutable(current);
  if (current.version !== input.expectedVersion) throw new Error("INVOICE_VERSION_CONFLICT");
  return repository.saveInvoice({ ...current, lifecycleState: "DISCARDED", discardedAt: input.now, version: current.version + 1, updatedAt: input.now });
}

export function voidIssuedInvoice(repository: InvoiceRepository, invoiceId: string, input: { expectedVersion: number; reason: string; now: string }): Invoice {
  assertRuntimeCapability(CAPABILITIES.INVOICES_VOID);
  const current = repository.listInvoices().find((item) => item.id === invoiceId);
  if (!current) throw new Error(`Invoice ${invoiceId} not found.`);
  if (current.lifecycleState !== "ISSUED") throw new Error("Only ISSUED Invoice can be voided.");
  if (current.version !== input.expectedVersion) throw new Error("INVOICE_VERSION_CONFLICT");
  if (!input.reason.trim()) throw new Error("Invoice void reason is required.");
  return repository.saveInvoice({ ...current, lifecycleState: "VOIDED", voidReason: input.reason.trim(), voidedAt: input.now, version: current.version + 1, updatedAt: input.now });
}

export function issueCreditNote(repository: InvoiceRepository, note: CreditNote): CreditNote {
  assertRuntimeCapability(CAPABILITIES.INVOICES_CREATE_CREDIT_NOTE);
  const invoice = repository.listInvoices().find((item) => item.id === note.invoiceId);
  if (!invoice || invoice.lifecycleState !== "ISSUED") throw new Error("Credit Note requires an ISSUED Invoice.");
  if (invoice.buyerRef.type !== note.buyerRef.type || invoice.buyerRef.id !== note.buyerRef.id) throw new Error("Credit Note buyer must match Invoice buyer.");
  if (note.state !== "ISSUED" || !note.creditNoteNumber || !note.issuedAt) throw new Error("Credit Note issue command requires authoritative issued evidence.");
  if (note.total.currency !== invoice.currency) throw new Error("Credit Note currency must match Invoice currency.");
  if (note.lines.length === 0 || note.lines.some((line) => !isPositiveMoney(line.amount))) throw new Error("Credit Note requires positive adjustment lines.");
  const computedTotal = sumMoney(note.lines.map((line) => line.amount), invoice.currency);
  if (compareMoney(computedTotal, note.total) !== 0 || compareMoney(note.total, money("0", invoice.currency)) <= 0) throw new Error("Credit Note total must equal line totals.");
  return repository.saveCreditNote(structuredClone(note));
}

export function recordInvoiceDelivery(repository: InvoiceRepository, delivery: InvoiceDeliveryRecord): InvoiceDeliveryRecord {
  assertRuntimeCapability(CAPABILITIES.INVOICES_SEND);
  const invoice = repository.listInvoices().find((item) => item.id === delivery.invoiceId);
  if (!invoice || invoice.lifecycleState !== "ISSUED") throw new Error("Only ISSUED Invoice can be sent.");
  const saved = repository.saveDelivery(structuredClone(delivery));
  const deliveryState = delivery.state === "SENT" ? "SENT" : delivery.state === "FAILED" ? "DELIVERY_FAILED" : "SENDING";
  repository.saveInvoice({ ...invoice, deliveryState, version: invoice.version + 1, updatedAt: delivery.sentAt ?? delivery.createdAt });
  return saved;
}

export function assertIssuedInvoiceUnchanged(before: Invoice, after: Invoice): void {
  if (before.lifecycleState === "ISSUED" && invoiceCommercialFingerprint(before) !== invoiceCommercialFingerprint(after)) throw new Error("Issued Invoice commercial content is immutable.");
}
