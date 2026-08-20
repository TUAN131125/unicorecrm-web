import { createAuthoritativeResource, type AuthoritativeResource } from "@/shared/application";
import type { CustomerCredit, InvoicePaymentAllocation, PaymentApiPort, PaymentRecord } from "@/modules/payments";
import type { InvoiceApiPort } from "../ports/InvoiceApiPort";
import type { ReceivablesApiPort, ReceivablesAgingSummary, ReceivablesSummary } from "../ports/ReceivablesApiPort";
import type { CreditNote, Invoice, InvoiceDeliveryRecord, ReceivableEntry } from "../../domain/model/invoice.types";
import type { MoneyDto } from "@/shared/money";

export interface InvoiceWorkspaceDto {
  invoices: Invoice[];
  creditNotes: CreditNote[];
  deliveries: InvoiceDeliveryRecord[];
}

export interface ReceivablesWorkspaceDto {
  entries: ReceivableEntry[];
  summary: ReceivablesSummary;
  aging: ReceivablesAgingSummary;
}

export interface InvoiceDetailDto {
  invoice: Invoice;
  creditNotes: CreditNote[];
  deliveries: InvoiceDeliveryRecord[];
  receivable?: ReceivableEntry;
  allocations: InvoicePaymentAllocation[];
}

export interface ReceivableDetailDto extends InvoiceDetailDto {
  paymentRecords: PaymentRecord[];
  customerCredits: CustomerCredit[];
}

export interface AccountStatementDto {
  invoices: Invoice[];
  creditNotes: CreditNote[];
  receivables: ReceivableEntry[];
  paymentRecords: PaymentRecord[];
  allocations: InvoicePaymentAllocation[];
  customerCredits: CustomerCredit[];
}

export interface AllocateReceivableCommand {
  invoiceId: string;
  expectedInvoiceVersion: number;
  amount: MoneyDto;
  paymentRecordId?: string;
  customerCreditId?: string;
  expectedSourceVersion: number;
  idempotencyKey: string;
  now: string;
}

export interface InvoiceVerticalSlice {
  workspace: AuthoritativeResource<InvoiceWorkspaceDto>;
  receivables: AuthoritativeResource<ReceivablesWorkspaceDto>;
  detail(invoiceId: string): AuthoritativeResource<InvoiceDetailDto>;
  receivableDetail(invoiceId: string): AuthoritativeResource<ReceivableDetailDto>;
  accountStatement(buyerId: string): AuthoritativeResource<AccountStatementDto>;
  refreshAll(): Promise<void>;
  createDraft(input: Parameters<InvoiceApiPort["createDraft"]>[0], signal?: AbortSignal): ReturnType<InvoiceApiPort["createDraft"]>;
  saveDraft(input: Parameters<InvoiceApiPort["saveDraft"]>[0], signal?: AbortSignal): ReturnType<InvoiceApiPort["saveDraft"]>;
  issue(invoiceId: string, input: Parameters<InvoiceApiPort["issue"]>[1], signal?: AbortSignal): ReturnType<InvoiceApiPort["issue"]>;
  retryIssue(invoiceId: string, input: Parameters<InvoiceApiPort["retryIssue"]>[1], signal?: AbortSignal): ReturnType<InvoiceApiPort["retryIssue"]>;
  send(invoiceId: string, input: Parameters<InvoiceApiPort["send"]>[1], signal?: AbortSignal): ReturnType<InvoiceApiPort["send"]>;
  createCreditNote(input: Parameters<InvoiceApiPort["createCreditNote"]>[0], signal?: AbortSignal): ReturnType<InvoiceApiPort["createCreditNote"]>;
  discardDraft(invoiceId: string, input: Parameters<InvoiceApiPort["discardDraft"]>[1], signal?: AbortSignal): ReturnType<InvoiceApiPort["discardDraft"]>;
  voidInvoice(invoiceId: string, input: Parameters<InvoiceApiPort["voidInvoice"]>[1], signal?: AbortSignal): ReturnType<InvoiceApiPort["voidInvoice"]>;
  allocateReceivable(command: AllocateReceivableCommand, signal?: AbortSignal): Promise<Awaited<ReturnType<PaymentApiPort["allocate"]>>>;
}

export interface InvoiceVerticalSliceOptions {
  projectWorkspace?(workspace: InvoiceWorkspaceDto): void;
  projectAccountingAsOfDate?(asOfDate: string): void;
}

export function createInvoiceVerticalSlice(
  api: InvoiceApiPort,
  receivablesApi: ReceivablesApiPort,
  paymentApi: PaymentApiPort,
  options: InvoiceVerticalSliceOptions = {},
): InvoiceVerticalSlice {
  const details = new Map<string, AuthoritativeResource<InvoiceDetailDto>>();
  const receivableDetails = new Map<string, AuthoritativeResource<ReceivableDetailDto>>();
  const statements = new Map<string, AuthoritativeResource<AccountStatementDto>>();

  const workspace = createAuthoritativeResource(async (signal) => {
    const [invoices, creditNotes, deliveries] = await Promise.all([
      api.list(signal),
      api.listCreditNotes(undefined, signal),
      api.listDeliveries(undefined, signal),
    ]);
    const workspace = { invoices, creditNotes, deliveries };
    options.projectWorkspace?.(workspace);
    return workspace;
  });

  const receivables = createAuthoritativeResource(async (signal) => {
    const [entries, summary, aging] = await Promise.all([
      receivablesApi.list(undefined, signal),
      receivablesApi.summary(undefined, signal),
      receivablesApi.aging(undefined, signal),
    ]);
    options.projectAccountingAsOfDate?.(summary.asOfDate);
    return { entries, summary, aging };
  });

  const detail = (invoiceId: string) => {
    const existing = details.get(invoiceId);
    if (existing) return existing;
    const resource = createAuthoritativeResource(async (signal) => {
      const [invoice, creditNotes, deliveries, receivableEntries, allocations] = await Promise.all([
        api.get(invoiceId, signal),
        api.listCreditNotes(invoiceId, signal),
        api.listDeliveries(invoiceId, signal),
        receivablesApi.list({}, signal),
        paymentApi.listAllocations(invoiceId, signal),
      ]);
      return { invoice, creditNotes, deliveries, receivable: receivableEntries.find((item) => item.invoiceId === invoiceId), allocations };
    });
    details.set(invoiceId, resource);
    return resource;
  };

  const receivableDetail = (invoiceId: string) => {
    const existing = receivableDetails.get(invoiceId);
    if (existing) return existing;
    const resource = createAuthoritativeResource(async (signal) => {
      const [base, paymentRecords, customerCredits] = await Promise.all([
        detail(invoiceId).load({ force: true }),
        paymentApi.listPaymentRecords(undefined, signal),
        paymentApi.listCustomerCredits(undefined, signal),
      ]);
      if (!base) throw new Error(`Invoice ${invoiceId} was not found.`);
      return { ...base, paymentRecords, customerCredits };
    });
    receivableDetails.set(invoiceId, resource);
    return resource;
  };

  const accountStatement = (buyerId: string) => {
    const existing = statements.get(buyerId);
    if (existing) return existing;
    const resource = createAuthoritativeResource(async (signal) => {
      const invoices = await api.list(signal);
      const buyerInvoices = invoices.filter((invoice) => invoice.buyerRef.id === buyerId);
      const buyerRef = buyerInvoices[0]?.buyerRef;
      const [creditNotes, receivableEntries, paymentRecords, allocations, customerCredits] = await Promise.all([
        api.listCreditNotes(undefined, signal),
        buyerRef ? receivablesApi.accountStatement(buyerRef, signal) : Promise.resolve([]),
        paymentApi.listPaymentRecords(buyerId, signal),
        paymentApi.listAllocations(undefined, signal),
        paymentApi.listCustomerCredits(buyerId, signal),
      ]);
      const invoiceIds = new Set(buyerInvoices.map((invoice) => invoice.id));
      return {
        invoices: buyerInvoices,
        creditNotes: creditNotes.filter((note) => invoiceIds.has(note.invoiceId)),
        receivables: receivableEntries,
        paymentRecords,
        allocations: allocations.filter((allocation) => invoiceIds.has(allocation.invoiceId)),
        customerCredits,
      };
    });
    statements.set(buyerId, resource);
    return resource;
  };

  const refreshInvoice = async (invoiceId?: string, buyerId?: string) => {
    const tasks: Array<Promise<unknown>> = [workspace.refresh(), receivables.refresh()];
    if (invoiceId) {
      tasks.push(detail(invoiceId).refresh(), receivableDetail(invoiceId).refresh());
    }
    if (buyerId) tasks.push(accountStatement(buyerId).refresh());
    await Promise.allSettled(tasks);
  };

  const mutate = async <T>(operation: () => Promise<T>, invoiceId?: string, buyerId?: string): Promise<T> => {
    const result = await operation();
    await refreshInvoice(invoiceId, buyerId);
    return result;
  };

  return {
    workspace,
    receivables,
    detail,
    receivableDetail,
    accountStatement,
    async refreshAll() {
      await Promise.allSettled([
        workspace.refresh(),
        receivables.refresh(),
        ...[...details.values()].map((resource) => resource.refresh()),
        ...[...receivableDetails.values()].map((resource) => resource.refresh()),
        ...[...statements.values()].map((resource) => resource.refresh()),
      ]);
    },
    createDraft: (input, signal) => mutate(() => api.createDraft(input, signal)),
    saveDraft: (input, signal) => mutate(() => api.saveDraft(input, signal), input.invoiceId),
    issue: (invoiceId, input, signal) => mutate(() => api.issue(invoiceId, input, signal), invoiceId),
    retryIssue: (invoiceId, input, signal) => mutate(() => api.retryIssue(invoiceId, input, signal), invoiceId),
    send: (invoiceId, input, signal) => mutate(() => api.send(invoiceId, input, signal), invoiceId),
    createCreditNote: (input, signal) => mutate(() => api.createCreditNote(input, signal), input.invoiceId),
    discardDraft: (invoiceId, input, signal) => mutate(() => api.discardDraft(invoiceId, input, signal), invoiceId),
    voidInvoice: (invoiceId, input, signal) => mutate(() => api.voidInvoice(invoiceId, input, signal), invoiceId),
    async allocateReceivable(command, signal) {
      const invoice = await api.get(command.invoiceId, signal);
      if (invoice.lifecycleState !== "ISSUED") throw new Error("Allocation requires an ISSUED Invoice.");
      if (invoice.version !== command.expectedInvoiceVersion) throw new Error("INVOICE_VERSION_CONFLICT");
      const entries = await receivablesApi.list({}, signal);
      const receivable = entries.find((item) => item.invoiceId === command.invoiceId);
      if (!receivable) throw new Error("Receivable was not found.");
      const result = await paymentApi.allocate({
        paymentRecordId: command.paymentRecordId,
        customerCreditId: command.customerCreditId,
        expectedSourceVersion: command.expectedSourceVersion,
        now: command.now,
        allocations: [{
          id: `allocation_${crypto.randomUUID()}`,
          invoice: { invoiceId: invoice.id, buyerRef: invoice.buyerRef, outstandingAmount: receivable.outstandingAmount, version: invoice.version },
          amount: command.amount,
          idempotencyKey: command.idempotencyKey,
        }],
      }, signal);
      await refreshInvoice(command.invoiceId, invoice.buyerRef.id);
      return result;
    },
  };
}
