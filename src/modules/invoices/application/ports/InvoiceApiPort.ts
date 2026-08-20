import type { BuyerRef } from "@/platform/identity";
import type { MoneyDto } from "@/shared/money";
import type { CreditNote, Invoice, InvoiceDeliveryRecord, InvoiceSourceLinks, LegalPartySnapshot } from "../../domain/model/invoice.types";

/**
 * Client-supplied editable line intent. Monetary totals are deliberately absent:
 * the backend owns discount, tax, line-total and document-total calculation.
 */
export interface InvoiceDraftLineInput {
  /** Server-issued line identifier when editing an existing line. */
  lineId?: string;
  /** UI-only correlation identifier for a new line; never becomes authoritative evidence. */
  clientLocalId?: string;
  sourceOrderLineId?: string;
  productId?: string;
  skuSnapshot?: string;
  description: string;
  unitOfMeasure?: string;
  quantity: string;
  unitPrice: MoneyDto;
  discountRate?: string;
  taxRate?: string;
  notes?: string;
}

export interface InvoiceDraftEditableFields {
  sellerSnapshot: LegalPartySnapshot;
  buyerSnapshot: LegalPartySnapshot;
  dueDate?: string;
  lines: InvoiceDraftLineInput[];
  paymentTerms?: string;
}

export interface CreateInvoiceDraftInput extends InvoiceDraftEditableFields {
  buyerRef: BuyerRef;
  currency: string;
  creationIntentId: string;
  sourceLinks: InvoiceSourceLinks & { orderId: string };
  /** Transport metadata. The HTTP adapter sends this as Idempotency-Key, not in the JSON body. */
  idempotencyKey: string;
}

export interface SaveInvoiceDraftInput extends InvoiceDraftEditableFields {
  invoiceId: string;
  expectedVersion: number;
  /** Transport metadata. The HTTP adapter sends this as Idempotency-Key, not in the JSON body. */
  idempotencyKey: string;
}

export interface SendInvoiceInput {
  expectedVersion: number;
  channel: InvoiceDeliveryRecord["channel"];
  recipient?: string;
  idempotencyKey: string;
}

export interface CreateCreditNoteLineInput {
  invoiceLineId?: string;
  description?: string;
  quantity?: string;
  netAmount?: MoneyDto;
  taxAmount?: MoneyDto;
  reasonCode?: string;
  amount: MoneyDto;
}

export interface CreateCreditNoteInput {
  invoiceId: string;
  sourceReturnId?: string;
  expectedInvoiceVersion: number;
  reasonCode: string;
  reason: string;
  /** Legacy amount-only compatibility. Prefer lines for new UI. */
  amount?: MoneyDto;
  lines?: CreateCreditNoteLineInput[];
  idempotencyKey: string;
}

export interface InvoiceApiPort {
  list(signal?: AbortSignal): Promise<Invoice[]>;
  listCreditNotes(invoiceId?: string, signal?: AbortSignal): Promise<CreditNote[]>;
  listDeliveries(invoiceId?: string, signal?: AbortSignal): Promise<InvoiceDeliveryRecord[]>;
  get(invoiceId: string, signal?: AbortSignal): Promise<Invoice>;
  createDraft(input: CreateInvoiceDraftInput, signal?: AbortSignal): Promise<Invoice>;
  saveDraft(input: SaveInvoiceDraftInput, signal?: AbortSignal): Promise<Invoice>;
  getIssueReadiness(invoiceId: string, signal?: AbortSignal): Promise<{ ready: boolean; blockers: string[]; invoiceVersion: number }>;
  issue(invoiceId: string, input: { expectedVersion: number }, signal?: AbortSignal): Promise<Invoice>;
  retryIssue(invoiceId: string, input: { expectedVersion: number }, signal?: AbortSignal): Promise<Invoice>;
  send(invoiceId: string, input: SendInvoiceInput, signal?: AbortSignal): Promise<InvoiceDeliveryRecord>;
  createCreditNote(input: CreateCreditNoteInput, signal?: AbortSignal): Promise<CreditNote>;
  discardDraft(invoiceId: string, input: { expectedVersion: number }, signal?: AbortSignal): Promise<Invoice>;
  voidInvoice(invoiceId: string, input: { expectedVersion: number; reason: string }, signal?: AbortSignal): Promise<Invoice>;
}
