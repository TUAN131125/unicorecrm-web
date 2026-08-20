import { createMutationMetadata, executeMutationCommand } from "@/shared/application";
import { buildReceivables, getInvoiceById, queryInvoices } from "../application/queries/invoiceQueries";
import { getInvoiceableOrderLines } from "../application/queries/invoiceableOrderLines";
import { getOrderSnapshot } from "@/modules/orders";
import { invoiceApi, invoiceConfiguration, invoiceRepository, invoiceVerticalSlice } from "../application/composition/invoiceApplicationServices";
import { allocatePaymentToInvoicesSnapshot, getPaymentsSnapshot } from "@/modules/payments";
import type { MoneyDto } from "@/shared/money";

export type {
  CreditNote,
  CreditNoteLine,
  CreditNoteState,
  Invoice,
  InvoiceDeliveryRecord,
  InvoiceDeliveryState,
  InvoiceLifecycleState,
  InvoiceLine,
  InvoiceSourceLinks,
  InvoiceTotals,
  LegalPartySnapshot,
  ReceivableEntry,
  SettlementState,
} from "../domain/model/invoice.types";
export type { InvoiceRepositorySnapshot } from "../application/ports/InvoiceRepository";
export type { CreateCreditNoteInput, CreateCreditNoteLineInput, CreateInvoiceDraftInput, InvoiceApiPort, InvoiceDraftEditableFields, InvoiceDraftLineInput, SaveInvoiceDraftInput, SendInvoiceInput } from "../application/ports/InvoiceApiPort";
export { validateInvoiceDraft, assertInvoiceMutable, projectReceivable } from "../domain/rules/invoiceRules";
export type { ReceivablesApiPort, ReceivablesSummary, ReceivablesAgingSummary } from "../application/ports/ReceivablesApiPort";
export type { InvoiceableOrderLineDto } from "../application/queries/invoiceableOrderLines";
export type { ReceivableCollectionActivity, ReceivableCollectionActivityType } from "../application/composition/invoiceApplicationServices";
export {
  getReceivableCollectionActivities,
  saveReceivableCollectionActivity,
  updateReceivableCollectionActivityState,
  subscribeToReceivableCollectionActivities,
} from "../application/composition/invoiceApplicationServices";

export const getInvoicesSnapshot = () => ({
  accountingAsOfDate: invoiceRepository.getAccountingAsOfDate(),
  invoices: invoiceRepository.listInvoices(),
  creditNotes: invoiceRepository.listCreditNotes(),
  deliveries: invoiceRepository.listDeliveries(),
});
export const getInvoiceSellerInformation = () => invoiceConfiguration.getSellerInformation();
export const saveInvoiceSellerInformation = (value: Parameters<typeof invoiceConfiguration.saveSellerInformation>[0]) => invoiceConfiguration.saveSellerInformation(value);
export const subscribeToInvoiceConfiguration = (listener: Parameters<typeof invoiceConfiguration.subscribe>[0]) => invoiceConfiguration.subscribe(listener);
export type { InvoiceSellerInformation } from "../domain/model/invoiceConfiguration.types";
export const replaceInvoicesSnapshot = (snapshot: ReturnType<typeof invoiceRepository.snapshot>) => invoiceRepository.replace(snapshot);
export const subscribeToInvoices = (listener: Parameters<typeof invoiceRepository.subscribe>[0]) => invoiceRepository.subscribe(listener);
export const queryInvoiceSnapshot = (input?: Parameters<typeof queryInvoices>[1]) => queryInvoices(invoiceRepository, input);
export const getInvoiceSnapshot = (invoiceId: string) => getInvoiceById(invoiceRepository, invoiceId);
export const getReceivablesSnapshot = (asOfDate?: string) => {
  const paymentSnapshot = getPaymentsSnapshot();
  const invoiceSnapshot = getInvoicesSnapshot();
  return buildReceivables(
    invoiceSnapshot,
    paymentSnapshot.allocations,
    invoiceSnapshot.creditNotes.map((note) => ({ invoiceId: note.invoiceId, amount: note.total, state: note.state })),
    asOfDate ?? invoiceSnapshot.accountingAsOfDate,
  );
};


export const getInvoiceableOrderLinesSnapshot = (orderId: string, excludeInvoiceId?: string) => {
  const order = getOrderSnapshot(orderId);
  return order ? getInvoiceableOrderLines(order, invoiceRepository.listInvoices(), excludeInvoiceId) : [];
};

export const createInvoiceDraftSnapshot = (input: Parameters<typeof invoiceApi.createDraft>[0], signal?: AbortSignal) => invoiceApi.createDraft(input, signal);
export const saveInvoiceDraftSnapshot = (invoice: Parameters<typeof invoiceApi.saveDraft>[0], signal?: AbortSignal) => invoiceApi.saveDraft(invoice, signal);
export const getInvoiceIssueReadinessSnapshot = (invoiceId: string, signal?: AbortSignal) => invoiceApi.getIssueReadiness(invoiceId, signal);
export const issueInvoiceSnapshot = (invoiceId: string, input: Parameters<typeof invoiceApi.issue>[1]) => invoiceApi.issue(invoiceId, input);
export const retryInvoiceIssueSnapshot = (invoiceId: string, input: Parameters<typeof invoiceApi.retryIssue>[1]) => invoiceApi.retryIssue(invoiceId, input);
export const sendInvoiceSnapshot = (invoiceId: string, input: Parameters<typeof invoiceApi.send>[1]) => invoiceApi.send(invoiceId, input);
export const createCreditNoteSnapshot = (note: Parameters<typeof invoiceApi.createCreditNote>[0]) => invoiceApi.createCreditNote(note);
export const discardInvoiceDraftSnapshot = (invoiceId: string, input: Parameters<typeof invoiceApi.discardDraft>[1]) => invoiceApi.discardDraft(invoiceId, input);
export const voidInvoiceSnapshot = (invoiceId: string, input: Parameters<typeof invoiceApi.voidInvoice>[1]) => invoiceApi.voidInvoice(invoiceId, input);


export interface AllocateReceivableInput {
  invoiceId: string;
  expectedInvoiceVersion: number;
  amount: MoneyDto;
  paymentRecordId?: string;
  customerCreditId?: string;
  expectedSourceVersion: number;
  idempotencyKey: string;
  now: string;
}

export const allocateReceivableSnapshot = (input: AllocateReceivableInput) => {
  const invoice = getInvoiceById(invoiceRepository, input.invoiceId);
  if (!invoice || invoice.lifecycleState !== "ISSUED") throw new Error("Allocation requires an ISSUED Invoice.");
  if (invoice.version !== input.expectedInvoiceVersion) throw new Error("INVOICE_VERSION_CONFLICT");
  const receivable = getReceivablesSnapshot().find((item) => item.invoiceId === input.invoiceId);
  if (!receivable) throw new Error("Receivable was not found.");
  return allocatePaymentToInvoicesSnapshot({
    paymentRecordId: input.paymentRecordId,
    customerCreditId: input.customerCreditId,
    expectedSourceVersion: input.expectedSourceVersion,
    now: input.now,
    allocations: [{
      id: `allocation_${crypto.randomUUID()}`,
      invoice: { invoiceId: invoice.id, buyerRef: invoice.buyerRef, outstandingAmount: receivable.outstandingAmount, version: invoice.version },
      amount: input.amount,
      idempotencyKey: input.idempotencyKey,
    }],
  });
};


export type { AccountStatementDto, AllocateReceivableCommand, InvoiceDetailDto, InvoiceVerticalSlice, InvoiceWorkspaceDto, ReceivableDetailDto, ReceivablesWorkspaceDto } from "../application/vertical-slice/invoiceVerticalSlice";
export const getInvoiceWorkspaceResource = () => invoiceVerticalSlice.workspace;
export const getReceivablesWorkspaceResource = () => invoiceVerticalSlice.receivables;
export const getInvoiceDetailResource = (invoiceId: string) => invoiceVerticalSlice.detail(invoiceId);
export const getReceivableDetailResource = (invoiceId: string) => invoiceVerticalSlice.receivableDetail(invoiceId);
export const getAccountStatementResource = (buyerId: string) => invoiceVerticalSlice.accountStatement(buyerId);
export const refreshInvoiceWorkspace = () => invoiceVerticalSlice.refreshAll();
export const createInvoiceDraftCanonical = (input: Parameters<typeof invoiceVerticalSlice.createDraft>[0], signal?: AbortSignal) => {
  const { idempotencyKey, ...payload } = input;
  return executeMutationCommand(
    { commandType: "invoice.create-draft", aggregateType: "invoice", aggregateId: input.creationIntentId, payload },
    createMutationMetadata(`invoice.create-draft:${input.creationIntentId}`, { idempotencyKey, signal }),
    () => invoiceVerticalSlice.createDraft(input, signal),
  );
};
export const saveInvoiceDraftCanonical = (input: Parameters<typeof invoiceVerticalSlice.saveDraft>[0], signal?: AbortSignal) => {
  const { invoiceId, expectedVersion, idempotencyKey, ...payload } = input;
  return executeMutationCommand(
    { commandType: "invoice.save-draft", aggregateType: "invoice", aggregateId: invoiceId, payload },
    createMutationMetadata(`invoice.save-draft:${invoiceId}`, { idempotencyKey, expectedVersion, signal }),
    () => invoiceVerticalSlice.saveDraft(input, signal),
  );
};
export const issueInvoiceCanonical = (invoiceId: string, input: Parameters<typeof invoiceVerticalSlice.issue>[1], signal?: AbortSignal) => executeMutationCommand(
  { commandType: "invoice.issue", aggregateType: "invoice", aggregateId: invoiceId, payload: input },
  createMutationMetadata(`invoice.issue:${invoiceId}`, { expectedVersion: input.expectedVersion, signal }),
  () => invoiceVerticalSlice.issue(invoiceId, input, signal),
);
export const retryInvoiceIssueCanonical = (invoiceId: string, input: Parameters<typeof invoiceVerticalSlice.retryIssue>[1], signal?: AbortSignal) => executeMutationCommand(
  { commandType: "invoice.retry-issue", aggregateType: "invoice", aggregateId: invoiceId, payload: input },
  createMutationMetadata(`invoice.retry-issue:${invoiceId}`, { expectedVersion: input.expectedVersion, signal }),
  () => invoiceVerticalSlice.retryIssue(invoiceId, input, signal),
);
export const sendInvoiceCanonical = (invoiceId: string, input: Parameters<typeof invoiceVerticalSlice.send>[1], signal?: AbortSignal) => executeMutationCommand(
  { commandType: "invoice.send", aggregateType: "invoice", aggregateId: invoiceId, payload: input },
  createMutationMetadata(`invoice.send:${invoiceId}`, { idempotencyKey: input.idempotencyKey, expectedVersion: input.expectedVersion, signal }),
  () => invoiceVerticalSlice.send(invoiceId, input, signal),
);
export const createCreditNoteCanonical = (input: Parameters<typeof invoiceVerticalSlice.createCreditNote>[0], signal?: AbortSignal) => executeMutationCommand(
  { commandType: "invoice.create-credit-note", aggregateType: "invoice", aggregateId: input.invoiceId, payload: input },
  createMutationMetadata(`invoice.create-credit-note:${input.invoiceId}`, { idempotencyKey: input.idempotencyKey, expectedVersion: input.expectedInvoiceVersion, signal }),
  () => invoiceVerticalSlice.createCreditNote(input, signal),
);
export const discardInvoiceDraftCanonical = (invoiceId: string, input: Parameters<typeof invoiceVerticalSlice.discardDraft>[1], signal?: AbortSignal) => executeMutationCommand(
  { commandType: "invoice.discard-draft", aggregateType: "invoice", aggregateId: invoiceId, payload: input },
  createMutationMetadata(`invoice.discard-draft:${invoiceId}`, { expectedVersion: input.expectedVersion, signal }),
  () => invoiceVerticalSlice.discardDraft(invoiceId, input, signal),
);
export const voidInvoiceCanonical = (invoiceId: string, input: Parameters<typeof invoiceVerticalSlice.voidInvoice>[1], signal?: AbortSignal) => executeMutationCommand(
  { commandType: "invoice.void", aggregateType: "invoice", aggregateId: invoiceId, payload: input },
  createMutationMetadata(`invoice.void:${invoiceId}`, { expectedVersion: input.expectedVersion, signal }),
  () => invoiceVerticalSlice.voidInvoice(invoiceId, input, signal),
);
export const allocateReceivableCanonical = (input: Parameters<typeof invoiceVerticalSlice.allocateReceivable>[0], signal?: AbortSignal) => executeMutationCommand(
  { commandType: "invoice.allocate-receivable", aggregateType: "invoice", aggregateId: input.invoiceId, payload: input },
  createMutationMetadata(`invoice.allocate-receivable:${input.invoiceId}`, { idempotencyKey: input.idempotencyKey, expectedVersion: input.expectedInvoiceVersion, signal }),
  () => invoiceVerticalSlice.allocateReceivable(input, signal),
);
