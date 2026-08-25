import { assertMutationCommandSupported, isBusinessOperationUnavailable, createMutationMetadata, executeMutationCommand, isMutationCommandUnavailable, type MutationCommandMetadata, type MutationOutcome } from "@/shared/application";
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
export type { CreateCreditNoteInput, CreateCreditNoteLineInput, CreateInvoiceDraftInput, CreditNoteCommandResult, InvoiceApiPort, InvoiceCommandResult, InvoiceDeliveryCommandResult, InvoiceDraftEditableFields, InvoiceDraftLineInput, InvoiceMutationEvidence, SaveInvoiceDraftInput, SendInvoiceInput } from "../application/ports/InvoiceApiPort";
import type { InvoiceMutationEvidence } from "../application/ports/InvoiceApiPort";
import type { CreditNote, Invoice, InvoiceDeliveryRecord } from "../domain/model/invoice.types";
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
/**
 * True when receivable collection activity cannot be recorded authoritatively. The connected
 * composition binds the collection-activity port to an unavailable operation because no
 * backend contract owns this history yet.
 */
export function isReceivableCollectionActivityUnavailable(): boolean {
  return isBusinessOperationUnavailable("Receivable collection activity save")
    || isBusinessOperationUnavailable("Receivable collection activity state update");
}

/**
 * True when invoice seller information cannot be saved authoritatively.
 * `replaceInvoiceSellerInformationConfiguration` is BLOCKED in OpenAPI, so connected mode
 * has no authoritative write for it.
 */
export function isInvoiceSellerInformationSaveUnavailable(): boolean {
  return isBusinessOperationUnavailable("Invoice seller-information save");
}

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
export const retryInvoiceIssueSnapshot = async (invoiceId: string, input: Parameters<typeof invoiceApi.retryIssue>[1]) => (await invoiceApi.retryIssue(invoiceId, input)).invoice;
export const sendInvoiceSnapshot = async (invoiceId: string, input: Parameters<typeof invoiceApi.send>[1]) => (await invoiceApi.send(invoiceId, input)).delivery;
export const createCreditNoteSnapshot = async (note: Parameters<typeof invoiceApi.createCreditNote>[0]) => (await invoiceApi.createCreditNote(note)).creditNote;
export const discardInvoiceDraftSnapshot = async (invoiceId: string, input: Parameters<typeof invoiceApi.discardDraft>[1]) => (await invoiceApi.discardDraft(invoiceId, input)).invoice;
export const voidInvoiceSnapshot = async (invoiceId: string, input: Parameters<typeof invoiceApi.voidInvoice>[1]) => (await invoiceApi.voidInvoice(invoiceId, input)).invoice;


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
/**
 * `invoice.retry-issue`, `invoice.send`, `invoice.create-credit-note`,
 * `invoice.discard-draft` and `invoice.void` are DEDICATED_MODULE_HTTP_ADAPTER in
 * the canonical command registry, so the OpenAPI generator deliberately keeps them
 * out of PRODUCTION_COMMAND_CONTRACTS and RoutedHttpMutationAuthority refuses them.
 * They execute through the Invoice dedicated adapter and report the backend's own
 * mutation evidence. `invoice.create-draft`, `invoice.save-draft` and
 * `invoice.issue` stay on the routed authority because they are routed commands.
 */
export const retryInvoiceIssueCanonical = async (invoiceId: string, input: Parameters<typeof invoiceVerticalSlice.retryIssue>[1], signal?: AbortSignal): Promise<MutationOutcome<Invoice>> => {
  const options = createMutationMetadata(`invoice.retry-issue:${invoiceId}`, { expectedVersion: input.expectedVersion, signal });
  const result = await invoiceVerticalSlice.retryIssue(invoiceId, input, signal);
  return invoiceMutationOutcome("invoice.retry-issue", options, result.invoice, result.evidence);
};
export const sendInvoiceCanonical = async (invoiceId: string, input: Parameters<typeof invoiceVerticalSlice.send>[1], signal?: AbortSignal): Promise<MutationOutcome<InvoiceDeliveryRecord>> => {
  const options = createMutationMetadata(`invoice.send:${invoiceId}`, { idempotencyKey: input.idempotencyKey, expectedVersion: input.expectedVersion, signal });
  const result = await invoiceVerticalSlice.send(invoiceId, input, signal);
  return invoiceMutationOutcome("invoice.send", options, result.delivery, result.evidence);
};
export const createCreditNoteCanonical = async (input: Parameters<typeof invoiceVerticalSlice.createCreditNote>[0], signal?: AbortSignal): Promise<MutationOutcome<CreditNote>> => {
  const options = createMutationMetadata(`invoice.create-credit-note:${input.invoiceId}`, { idempotencyKey: input.idempotencyKey, expectedVersion: input.expectedInvoiceVersion, signal });
  const result = await invoiceVerticalSlice.createCreditNote(input, signal);
  return invoiceMutationOutcome("invoice.create-credit-note", options, result.creditNote, result.evidence);
};
export const discardInvoiceDraftCanonical = async (invoiceId: string, input: Parameters<typeof invoiceVerticalSlice.discardDraft>[1], signal?: AbortSignal): Promise<MutationOutcome<Invoice>> => {
  const options = createMutationMetadata(`invoice.discard-draft:${invoiceId}`, { expectedVersion: input.expectedVersion, signal });
  const result = await invoiceVerticalSlice.discardDraft(invoiceId, input, signal);
  return invoiceMutationOutcome("invoice.discard-draft", options, result.invoice, result.evidence);
};
export const voidInvoiceCanonical = async (invoiceId: string, input: Parameters<typeof invoiceVerticalSlice.voidInvoice>[1], signal?: AbortSignal): Promise<MutationOutcome<Invoice>> => {
  const options = createMutationMetadata(`invoice.void:${invoiceId}`, { expectedVersion: input.expectedVersion, signal });
  const result = await invoiceVerticalSlice.voidInvoice(invoiceId, input, signal);
  return invoiceMutationOutcome("invoice.void", options, result.invoice, result.evidence);
};

/** Projects a dedicated Invoice adapter result into the public MutationOutcome contract. */
function invoiceMutationOutcome<T>(
  commandType: string,
  options: MutationCommandMetadata,
  data: T,
  evidence: InvoiceMutationEvidence,
): MutationOutcome<T> {
  return {
    data,
    commandId: evidence.commandId,
    commandType,
    aggregateType: evidence.aggregateType,
    aggregateId: evidence.aggregateId,
    idempotencyKey: options.idempotencyKey,
    correlationId: evidence.correlationId,
    occurredAt: evidence.occurredAt,
    version: evidence.version,
    outcome: evidence.outcome,
    warnings: [...evidence.warnings],
    emittedEvents: [...evidence.emittedEventIds],
    audit: { authority: evidence.authority === "backend" ? "backend" : "demo", evidenceIds: [...evidence.auditEvidenceIds] },
  };
}
/**
 * `invoice.allocate-receivable` is BLOCKED in the canonical registry, so it is absent from
 * `PRODUCTION_COMMAND_CONTRACTS` and cannot be carried by the routed authority. Connected
 * mode refuses here, before the mutation authority is entered; demo keeps its local executor.
 */
export function isReceivableAllocationUnavailable(): boolean {
  return isMutationCommandUnavailable("invoice.allocate-receivable");
}

export const allocateReceivableCanonical = (input: Parameters<typeof invoiceVerticalSlice.allocateReceivable>[0], signal?: AbortSignal) => {
  assertMutationCommandSupported("invoice.allocate-receivable", "Receivable allocation");
  return executeMutationCommand(
    { commandType: "invoice.allocate-receivable", aggregateType: "invoice", aggregateId: input.invoiceId, payload: input },
    createMutationMetadata(`invoice.allocate-receivable:${input.invoiceId}`, { idempotencyKey: input.idempotencyKey, expectedVersion: input.expectedInvoiceVersion, signal }),
    () => invoiceVerticalSlice.allocateReceivable(input, signal),
  );
};
