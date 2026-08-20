import { FinancialApiClient } from "@/platform/api";
import type { HttpClient } from "@/platform/api";
import type {
  CreateInvoiceCreditNoteRequest,
  CreditNoteList,
  DiscardInvoiceDraftRequest,
  InvoiceCreditNoteMutationResponse,
  InvoiceDeliveryList,
  InvoiceDeliveryMutationResponse,
  InvoiceDocument,
  InvoiceDraftMutationResponse,
  InvoiceList,
  InvoiceMutationResponse,
  IssueInvoiceResponse,
  RetryInvoiceIssueRequest,
  SendInvoiceRequest,
  VoidInvoiceRequest,
} from "@/platform/api/generated/financialApi";
import type { InvoiceApiPort } from "../../application/ports/InvoiceApiPort";
import type { Invoice } from "../../domain/model/invoice.types";
import {
  mapCreditNoteDocument,
  mapInvoiceDeliveryDocument,
  mapInvoiceDocument,
} from "./InvoiceApiMapper";

export class InvoiceHttpAdapter implements InvoiceApiPort {
  private readonly api: FinancialApiClient;

  constructor(client: HttpClient) {
    this.api = new FinancialApiClient(client);
  }

  async list(signal?: AbortSignal) {
    const values = await this.api.listInvoices<InvoiceList>({}, signal);
    return values.map(mapInvoiceDocument);
  }

  async listCreditNotes(invoiceId?: string, signal?: AbortSignal) {
    const values = await this.api.listCreditNotes<CreditNoteList>({ invoiceId }, signal);
    return values.map(mapCreditNoteDocument);
  }

  async listDeliveries(invoiceId?: string, signal?: AbortSignal) {
    const values = await this.api.listInvoiceDeliveries<InvoiceDeliveryList>({ invoiceId }, signal);
    return values.map(mapInvoiceDeliveryDocument);
  }

  async get(invoiceId: string, signal?: AbortSignal) {
    return mapInvoiceDocument(await this.api.getInvoice<InvoiceDocument>(invoiceId, {}, signal));
  }

  async createDraft(input: Parameters<InvoiceApiPort["createDraft"]>[0], signal?: AbortSignal) {
    const { idempotencyKey, ...body } = input;
    const response = await this.api.createInvoiceDraft<InvoiceDraftMutationResponse, typeof body>(body, {
      signal,
      idempotencyKey,
      retry: "idempotent",
    });
    return requireDirectInvoiceMutationResult(response, "createInvoiceDraft");
  }

  async saveDraft(input: Parameters<InvoiceApiPort["saveDraft"]>[0], signal?: AbortSignal) {
    const { invoiceId, expectedVersion, idempotencyKey, ...body } = input;
    const response = await this.api.saveInvoiceDraft<InvoiceDraftMutationResponse, typeof body>(invoiceId, body, {
      signal,
      idempotencyKey,
      expectedVersion,
      retry: "idempotent",
    });
    return requireDirectInvoiceMutationResult(response, "saveInvoiceDraft", invoiceId);
  }

  getIssueReadiness(invoiceId: string, signal?: AbortSignal) {
    return this.api.getInvoiceIssueReadiness<Awaited<ReturnType<InvoiceApiPort["getIssueReadiness"]>>>(invoiceId, {}, signal);
  }

  async issue(invoiceId: string, input: Parameters<InvoiceApiPort["issue"]>[1], signal?: AbortSignal) {
    const response = await this.api.issueInvoice<IssueInvoiceResponse, typeof input>(invoiceId, input, {
      signal,
      idempotencyKey: `invoice-issue:${invoiceId}:${input.expectedVersion}`,
      expectedVersion: input.expectedVersion,
      retry: "idempotent",
    });
    return requireDirectInvoiceMutationResult(response, "issueInvoice", invoiceId);
  }

  async retryIssue(invoiceId: string, input: Parameters<InvoiceApiPort["retryIssue"]>[1], signal?: AbortSignal) {
    const body: RetryInvoiceIssueRequest = { expectedVersion: input.expectedVersion };
    const response = await this.api.retryInvoiceIssue<InvoiceMutationResponse, RetryInvoiceIssueRequest>(invoiceId, body, {
      signal,
      idempotencyKey: `invoice-retry-issue:${invoiceId}:${input.expectedVersion}`,
      expectedVersion: input.expectedVersion,
      retry: "idempotent",
    });
    return requireNestedInvoiceMutationResult(response, "retryInvoiceIssue", invoiceId);
  }

  async send(invoiceId: string, input: Parameters<InvoiceApiPort["send"]>[1], signal?: AbortSignal) {
    const body: SendInvoiceRequest = {
      channel: input.channel,
      ...(input.recipient?.trim() ? { recipient: input.recipient.trim() } : {}),
    };
    const response = await this.api.sendInvoice<InvoiceDeliveryMutationResponse, SendInvoiceRequest>(invoiceId, body, {
      signal,
      idempotencyKey: input.idempotencyKey,
      expectedVersion: input.expectedVersion,
      retry: "idempotent",
    });
    assertAggregate(response, "sendInvoice", invoiceId);
    return mapInvoiceDeliveryDocument(response.result.delivery);
  }

  async createCreditNote(input: Parameters<InvoiceApiPort["createCreditNote"]>[0], signal?: AbortSignal) {
    const lines = input.lines?.length
      ? input.lines.map((line) => ({
          ...(line.invoiceLineId ? { invoiceLineId: line.invoiceLineId } : {}),
          ...(line.description?.trim() ? { description: line.description.trim() } : {}),
          ...(line.quantity ? { quantity: line.quantity } : {}),
          ...(line.netAmount ? { netAmount: line.netAmount } : {}),
          ...(line.taxAmount ? { taxAmount: line.taxAmount } : {}),
          ...(line.reasonCode?.trim() ? { reasonCode: line.reasonCode.trim() } : {}),
          amount: line.amount,
        }))
      : input.amount
        ? [{ description: input.reason, reasonCode: input.reasonCode, amount: input.amount }]
        : [];
    if (lines.length === 0) throw new Error("INVOICE_CREDIT_NOTE_LINES_REQUIRED");
    const body: CreateInvoiceCreditNoteRequest = {
      ...(input.sourceReturnId ? { sourceReturnId: input.sourceReturnId } : {}),
      reasonCode: input.reasonCode,
      reason: input.reason,
      lines,
    };
    const response = await this.api.createInvoiceCreditNote<InvoiceCreditNoteMutationResponse, CreateInvoiceCreditNoteRequest>(input.invoiceId, body, {
      signal,
      idempotencyKey: input.idempotencyKey,
      expectedVersion: input.expectedInvoiceVersion,
      retry: "idempotent",
    });
    assertAggregate(response, "createInvoiceCreditNote", input.invoiceId);
    return mapCreditNoteDocument(response.result.creditNote);
  }

  async discardDraft(invoiceId: string, input: Parameters<InvoiceApiPort["discardDraft"]>[1], signal?: AbortSignal) {
    const body: DiscardInvoiceDraftRequest = { expectedVersion: input.expectedVersion };
    const response = await this.api.discardInvoiceDraft<InvoiceMutationResponse, DiscardInvoiceDraftRequest>(invoiceId, body, {
      signal,
      idempotencyKey: `invoice-discard:${invoiceId}:${input.expectedVersion}`,
      expectedVersion: input.expectedVersion,
      retry: "idempotent",
    });
    return requireNestedInvoiceMutationResult(response, "discardInvoiceDraft", invoiceId);
  }

  async voidInvoice(invoiceId: string, input: Parameters<InvoiceApiPort["voidInvoice"]>[1], signal?: AbortSignal) {
    const body: VoidInvoiceRequest = { expectedVersion: input.expectedVersion, reason: input.reason };
    const response = await this.api.voidInvoice<InvoiceMutationResponse, VoidInvoiceRequest>(invoiceId, body, {
      signal,
      idempotencyKey: `invoice-void:${invoiceId}:${input.expectedVersion}:${input.reason.trim()}`,
      expectedVersion: input.expectedVersion,
      retry: "idempotent",
    });
    return requireNestedInvoiceMutationResult(response, "voidInvoice", invoiceId);
  }
}

interface DirectInvoiceMutationEnvelope {
  aggregateId: string;
  result: InvoiceDocument;
}

interface NestedInvoiceMutationEnvelope {
  aggregateId: string;
  result: { invoice: InvoiceDocument };
}

function assertAggregate(response: { aggregateId: string }, operationId: string, expectedInvoiceId?: string): void {
  if (!response || typeof response !== "object" || typeof response.aggregateId !== "string") {
    throw new Error(`CONNECTED_CONTRACT_VIOLATION:${operationId}:missing-aggregate`);
  }
  if (expectedInvoiceId && response.aggregateId !== expectedInvoiceId) {
    throw new Error(`CONNECTED_CONTRACT_VIOLATION:${operationId}:aggregate-id-mismatch`);
  }
}

function requireDirectInvoiceMutationResult(response: DirectInvoiceMutationEnvelope, operationId: string, expectedInvoiceId?: string): Invoice {
  assertAggregate(response, operationId, expectedInvoiceId);
  if (!response.result || response.result.id !== response.aggregateId) {
    throw new Error(`CONNECTED_CONTRACT_VIOLATION:${operationId}:result-id-mismatch`);
  }
  return mapInvoiceDocument(response.result);
}

function requireNestedInvoiceMutationResult(response: NestedInvoiceMutationEnvelope, operationId: string, expectedInvoiceId?: string): Invoice {
  assertAggregate(response, operationId, expectedInvoiceId);
  if (!response.result?.invoice || response.result.invoice.id !== response.aggregateId) {
    throw new Error(`CONNECTED_CONTRACT_VIOLATION:${operationId}:result-id-mismatch`);
  }
  return mapInvoiceDocument(response.result.invoice);
}
