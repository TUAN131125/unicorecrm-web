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

/**
 * Authoritative evidence returned by an Invoice mutation.
 *
 * Mirrors the shape established by `DealMutationEvidence`. The connected HTTP
 * adapter populates every field from the backend mutation response envelope and
 * never synthesizes one; the demo adapter marks itself `authority: "demo"`.
 *
 * Named `...CommandResult` rather than `...MutationResult` because the generated
 * OpenAPI client already exports `InvoiceMutationResult` for the wire payload.
 */
export interface InvoiceMutationEvidence {
  authority: "backend" | "demo" | "test";
  commandId: string;
  correlationId: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  occurredAt: string;
  outcome: "COMMITTED" | "REPLAYED" | "DEMO_COMMITTED";
  warnings: readonly string[];
  emittedEventIds: readonly string[];
  auditEvidenceIds: readonly string[];
}

export interface InvoiceCommandResult {
  invoice: Invoice;
  evidence: InvoiceMutationEvidence;
}

export interface InvoiceDeliveryCommandResult {
  delivery: InvoiceDeliveryRecord;
  evidence: InvoiceMutationEvidence;
}

export interface CreditNoteCommandResult {
  creditNote: CreditNote;
  evidence: InvoiceMutationEvidence;
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
  // The five commands below are DEDICATED_MODULE_HTTP_ADAPTER in the canonical
  // command registry, so they never route through RoutedHttpMutationAuthority and
  // must carry the backend's authoritative mutation evidence themselves.
  retryIssue(invoiceId: string, input: { expectedVersion: number }, signal?: AbortSignal): Promise<InvoiceCommandResult>;
  send(invoiceId: string, input: SendInvoiceInput, signal?: AbortSignal): Promise<InvoiceDeliveryCommandResult>;
  createCreditNote(input: CreateCreditNoteInput, signal?: AbortSignal): Promise<CreditNoteCommandResult>;
  discardDraft(invoiceId: string, input: { expectedVersion: number }, signal?: AbortSignal): Promise<InvoiceCommandResult>;
  voidInvoice(invoiceId: string, input: { expectedVersion: number; reason: string }, signal?: AbortSignal): Promise<InvoiceCommandResult>;
}
