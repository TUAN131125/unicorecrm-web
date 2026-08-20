import type { InvoiceApiPort, InvoiceDraftLineInput } from "../application/ports/InvoiceApiPort";
import {
  addMoney,
  compareMoney,
  isPositiveMoney,
  money,
  multiplyMoney,
  percentageOfMoney,
  subtractMoney,
  sumMoney,
} from "@/shared/money";
import { createDurableId } from "@/shared/ids";
import type { InvoiceRepository } from "../application/ports/InvoiceRepository";
import type { Invoice, InvoiceLine, InvoiceTotals } from "../domain/model/invoice.types";
import { discardInvoiceDraft, issueCreditNote, issueInvoice, recordInvoiceDelivery, retryInvoiceIssue, saveInvoiceDraft, voidIssuedInvoice } from "../application/commands/invoiceCommands";
import { validateInvoiceDraft } from "../domain/rules/invoiceRules";

export class InMemoryInvoiceApiAdapter implements InvoiceApiPort {
  private readonly saveReplays = new Map<string, Invoice>();
  private readonly repository: InvoiceRepository;

  constructor(repository: InvoiceRepository) {
    this.repository = repository;
  }
  async list() { return this.repository.listInvoices(); }
  async listCreditNotes(invoiceId?: string) { return this.repository.listCreditNotes().filter((item) => !invoiceId || item.invoiceId === invoiceId); }
  async listDeliveries(invoiceId?: string) { return this.repository.listDeliveries().filter((item) => !invoiceId || item.invoiceId === invoiceId); }
  async get(invoiceId: string) { const value = this.repository.listInvoices().find((item) => item.id === invoiceId); if (!value) throw new Error(`Invoice ${invoiceId} not found.`); return value; }

  async createDraft(input: Parameters<InvoiceApiPort["createDraft"]>[0]) {
    const replay = this.repository.listInvoices().find((item) => item.idempotencyKey === input.idempotencyKey);
    if (replay) return replay;
    if (!input.creationIntentId.trim()) throw new Error("INVOICE_CREATION_INTENT_REQUIRED");
    if (!input.sourceLinks.orderId?.trim()) throw new Error("INVOICE_SOURCE_ORDER_REQUIRED");
    const sequence = this.repository.listInvoices().length + 1;
    const id = `inv_dev_${String(sequence).padStart(5, "0")}`;
    const now = new Date().toISOString();
    const lines = buildDraftLines(id, input.currency, input.lines);
    return saveInvoiceDraft(this.repository, {
      id,
      buyerRef: input.buyerRef,
      sellerSnapshot: structuredClone(input.sellerSnapshot),
      buyerSnapshot: structuredClone(input.buyerSnapshot),
      lifecycleState: "DRAFT",
      deliveryState: "NOT_SENT",
      dueDate: input.dueDate,
      currency: input.currency,
      paymentTerms: input.paymentTerms,
      creationIntentId: input.creationIntentId,
      lines,
      totals: calculateInvoiceTotals(lines, input.currency),
      sourceLinks: structuredClone(input.sourceLinks),
      version: 1,
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });
  }

  async saveDraft(input: Parameters<InvoiceApiPort["saveDraft"]>[0]) {
    const replayKey = `${input.invoiceId}:${input.idempotencyKey}`;
    const replay = this.saveReplays.get(replayKey);
    if (replay) return structuredClone(replay);
    const current = this.repository.listInvoices().find((item) => item.id === input.invoiceId);
    if (!current) throw new Error(`Invoice ${input.invoiceId} not found.`);
    if (current.version !== input.expectedVersion) throw new Error("INVOICE_VERSION_CONFLICT");
    if (current.lifecycleState !== "DRAFT") throw new Error(`Invoice ${current.id} is immutable in state ${current.lifecycleState}.`);
    const now = new Date().toISOString();
    const lines = buildDraftLines(current.id, current.currency, input.lines, current.lines);
    const saved = saveInvoiceDraft(this.repository, {
      ...current,
      sellerSnapshot: structuredClone(input.sellerSnapshot),
      buyerSnapshot: structuredClone(input.buyerSnapshot),
      dueDate: input.dueDate,
      paymentTerms: input.paymentTerms,
      lines,
      totals: calculateInvoiceTotals(lines, current.currency),
      version: current.version + 1,
      updatedAt: now,
    });
    this.saveReplays.set(replayKey, structuredClone(saved));
    return saved;
  }

  async getIssueReadiness(invoiceId: string) {
    const invoice = this.repository.listInvoices().find((item) => item.id === invoiceId);
    if (!invoice) throw new Error(`Invoice ${invoiceId} not found.`);
    const blockers = invoice.lifecycleState === "DRAFT" || invoice.lifecycleState === "ISSUE_FAILED" ? validateInvoiceDraft(invoice) : [`INVOICE_STATE_NOT_ISSUABLE:${invoice.lifecycleState}`];
    return { ready: blockers.length === 0, blockers, invoiceVersion: invoice.version };
  }
  async issue(invoiceId: string, input: { expectedVersion: number }) { const now = new Date().toISOString(); return issueInvoice(this.repository, invoiceId, { ...input, invoiceNumber: `DEV-${invoiceId}`, issueDate: now.slice(0, 10), issuedAt: now }); }
  async retryIssue(invoiceId: string, input: { expectedVersion: number }) { const now = new Date().toISOString(); return retryInvoiceIssue(this.repository, invoiceId, { ...input, invoiceNumber: `DEV-${invoiceId}`, issueDate: now.slice(0, 10), issuedAt: now }); }
  async send(invoiceId: string, input: Parameters<InvoiceApiPort["send"]>[1]) {
    const replay = this.repository.listDeliveries().find((item) => item.id === `delivery_${input.idempotencyKey}`);
    if (replay) return replay;
    const invoice = this.repository.listInvoices().find((item) => item.id === invoiceId);
    if (!invoice) throw new Error(`Invoice ${invoiceId} not found.`);
    if (invoice.version !== input.expectedVersion) throw new Error("INVOICE_VERSION_CONFLICT");
    const now = new Date().toISOString();
    return recordInvoiceDelivery(this.repository, {
      id: `delivery_${input.idempotencyKey}`,
      invoiceId,
      channel: input.channel,
      recipient: input.recipient,
      state: "SENT",
      sentAt: now,
      createdAt: now,
    });
  }
  async createCreditNote(input: Parameters<InvoiceApiPort["createCreditNote"]>[0]) {
    const invoice = this.repository.listInvoices().find((item) => item.id === input.invoiceId);
    if (!invoice) throw new Error(`Invoice ${input.invoiceId} not found.`);
    if (invoice.version !== input.expectedInvoiceVersion) throw new Error("INVOICE_VERSION_CONFLICT");
    const requestedLines = input.lines?.length ? input.lines : input.amount ? [{ description: input.reason, amount: input.amount }] : [];
    if (requestedLines.length === 0) throw new Error("CREDIT_NOTE_LINES_REQUIRED");
    const existingIssued = this.repository.listCreditNotes().filter((note) => note.invoiceId === invoice.id && note.state === "ISSUED");
    for (const line of requestedLines) {
      if (!isPositiveMoney(line.amount) || line.amount.currency !== invoice.currency) throw new Error("CREDIT_NOTE_AMOUNT_INVALID");
      if (line.invoiceLineId) {
        const invoiceLine = invoice.lines.find((candidate) => candidate.id === line.invoiceLineId);
        if (!invoiceLine) throw new Error(`INVOICE_LINE_NOT_FOUND:${line.invoiceLineId}`);
        const alreadyCredited = sumMoney(existingIssued.flatMap((note) => note.lines.filter((creditLine) => creditLine.invoiceLineId === line.invoiceLineId).map((creditLine) => creditLine.amount)), invoice.currency);
        const remaining = money(String(Number(invoiceLine.lineTotal.amount) - Number(alreadyCredited.amount)), invoice.currency);
        if (compareMoney(line.amount, remaining) > 0) throw new Error(`CREDIT_NOTE_LINE_EXCEEDS_REMAINING:${line.invoiceLineId}`);
      }
    }
    const total = sumMoney(requestedLines.map((line) => line.amount), invoice.currency);
    if (!isPositiveMoney(total) || compareMoney(total, invoice.totals.grandTotal) > 0) throw new Error("CREDIT_NOTE_AMOUNT_INVALID");
    const replay = this.repository.listCreditNotes().find((item) => item.idempotencyKey === input.idempotencyKey);
    if (replay) return replay;
    const sequence = this.repository.listCreditNotes().length + 1;
    const id = `cn_dev_${String(sequence).padStart(5, "0")}`;
    const now = new Date().toISOString();
    return issueCreditNote(this.repository, {
      id,
      creditNoteNumber: `DEV-CN-${String(sequence).padStart(5, "0")}`,
      invoiceId: invoice.id,
      sourceReturnId: input.sourceReturnId,
      buyerRef: invoice.buyerRef,
      state: "ISSUED",
      reasonCode: input.reasonCode,
      reason: input.reason,
      lines: requestedLines.map((line, index) => ({ id: `${id}_line_${index + 1}`, invoiceLineId: line.invoiceLineId, description: line.description?.trim() || invoice.lines.find((candidate) => candidate.id === line.invoiceLineId)?.description || input.reason, quantity: line.quantity, netAmount: line.netAmount, taxAmount: line.taxAmount, reasonCode: line.reasonCode ?? input.reasonCode, amount: line.amount })),
      total,
      version: 1,
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      updatedAt: now,
      issuedAt: now,
    });
  }
  async discardDraft(invoiceId: string, input: Parameters<InvoiceApiPort["discardDraft"]>[1]) { return discardInvoiceDraft(this.repository, invoiceId, { ...input, now: new Date().toISOString() }); }
  async voidInvoice(invoiceId: string, input: Parameters<InvoiceApiPort["voidInvoice"]>[1]) { return voidIssuedInvoice(this.repository, invoiceId, { ...input, now: new Date().toISOString() }); }
}

function buildDraftLines(
  invoiceId: string,
  currency: string,
  inputs: readonly InvoiceDraftLineInput[],
  currentLines: readonly InvoiceLine[] = [],
): InvoiceLine[] {
  if (inputs.length === 0) throw new Error("INVOICE_LINE_REQUIRED");
  const existingById = new Map(currentLines.map((line) => [line.id, line]));
  return inputs.map((input, index) => {
    const current = input.lineId ? existingById.get(input.lineId) : undefined;
    if (input.lineId && !current) throw new Error(`INVOICE_LINE_NOT_FOUND:${input.lineId}`);
    if (!input.description.trim()) throw new Error(`INVOICE_LINE_INVALID:${index}`);
    const quantity = normalizePositiveDecimal(input.quantity, `INVOICE_LINE_QUANTITY_INVALID:${index}`);
    const discountRate = normalizePercentage(input.discountRate ?? "0", `INVOICE_LINE_DISCOUNT_RATE_INVALID:${index}`);
    const taxRate = normalizePercentage(input.taxRate ?? "0", `INVOICE_LINE_TAX_RATE_INVALID:${index}`);
    if (input.unitPrice.currency !== currency || compareMoney(input.unitPrice, money("0", currency)) < 0) {
      throw new Error(`INVOICE_LINE_UNIT_PRICE_INVALID:${index}`);
    }
    const subtotal = multiplyMoney(input.unitPrice, quantity);
    const discountAmount = percentageOfMoney(subtotal, discountRate);
    const taxable = subtractMoney(subtotal, discountAmount);
    const taxAmount = percentageOfMoney(taxable, taxRate);
    return {
      id: current?.id ?? createDurableId(`${invoiceId}_line`),
      sourceOrderLineId: input.sourceOrderLineId ?? current?.sourceOrderLineId ?? current?.orderLineId,
      orderLineId: input.sourceOrderLineId ?? current?.orderLineId ?? current?.sourceOrderLineId,
      productId: input.productId ?? current?.productId,
      skuSnapshot: input.skuSnapshot ?? current?.skuSnapshot,
      description: input.description.trim(),
      unitOfMeasure: input.unitOfMeasure?.trim() || undefined,
      sourceOrderQuantity: current?.sourceOrderQuantity,
      alreadyInvoicedQuantity: current?.alreadyInvoicedQuantity,
      invoiceableQuantity: current?.invoiceableQuantity,
      quantity,
      unitPrice: structuredClone(input.unitPrice),
      discountRate,
      discountAmount,
      taxRate,
      taxAmount,
      lineTotal: addMoney(taxable, taxAmount),
      notes: input.notes?.trim() || undefined,
    };
  });
}

function calculateInvoiceTotals(lines: readonly InvoiceLine[], currency: string): InvoiceTotals {
  const subtotal = sumMoney(lines.map((line) => multiplyMoney(line.unitPrice, line.quantity)), currency);
  const discountTotal = sumMoney(lines.map((line) => line.discountAmount), currency);
  const taxTotal = sumMoney(lines.map((line) => line.taxAmount), currency);
  const grandTotal = sumMoney(lines.map((line) => line.lineTotal), currency);
  return { subtotal, discountTotal, taxTotal, roundingAdjustment: money("0", currency), grandTotal };
}

function normalizePositiveDecimal(value: string, errorCode: string): string {
  if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/u.test(value) || Number(value) <= 0) throw new Error(errorCode);
  return value;
}

function normalizePercentage(value: string, errorCode: string): string {
  if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/u.test(value)) throw new Error(errorCode);
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) throw new Error(errorCode);
  return value;
}
