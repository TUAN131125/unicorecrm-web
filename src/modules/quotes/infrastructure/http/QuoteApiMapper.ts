import type {
  ApproveQuoteRequest,
  ArchiveQuoteRequest,
  ArchiveQuotesBatchRequest,
  CreateQuoteDraftRequest,
  CreateQuoteForDealRequest,
  ExpireQuoteRequest,
  ExpireQuotesBatchRequest,
  QuoteBatchMutationResponse,
  QuoteMutationResponse,
  QuoteReadModel as ApiQuoteReadModel,
  RecordQuoteSendEvidenceRequest,
  RejectQuoteRequest,
  ReplaceQuoteDraftRequest,
  RequestQuoteApprovalBatchRequest,
  RequestQuoteApprovalChangesRequest,
  RequestQuoteApprovalRequest,
  ReviseQuoteRequest,
} from "@/platform/api/generated/commercialApi";
import { normalizeDecimal } from "@/shared/money";
import type {
  ApproveQuoteInput,
  ArchiveQuoteInput,
  ArchiveQuotesBatchInput,
  QuoteBatchMutationResult,
  ExpireQuotesBatchInput,
  QuoteDraftInput,
  QuoteMutationEvidence,
  QuoteMutationResult,
  RecordQuoteSendEvidenceInput,
  RejectQuoteInput,
  RequestQuoteApprovalBatchInput,
  RequestQuoteApprovalChangesInput,
  RequestQuoteApprovalInput,
  ReviseQuoteInput,
} from "../../application/ports/QuoteApiRuntime";
import { projectQuoteReadModel, type QuoteReadModel } from "../../application/read-models/quoteReadModel";
import type { Quote } from "../../domain/model/quote.types";

export function mapQuoteReadModel(value: ApiQuoteReadModel): Quote {
  return projectQuoteReadModel(value as QuoteReadModel);
}

export function mapCreateQuoteDraftRequest(input: QuoteDraftInput): CreateQuoteDraftRequest {
  return mapDraft(input);
}

export function mapCreateQuoteForDealRequest(input: QuoteDraftInput): CreateQuoteForDealRequest {
  const {
    buyerRef: _buyerRef,
    sourcePath: _sourcePath,
    sourceDealId: _sourceDealId,
    ...draft
  } = mapDraft(input);
  return draft;
}

export function mapReplaceQuoteDraftRequest(input: QuoteDraftInput): ReplaceQuoteDraftRequest {
  return mapDraft(input);
}

export function mapRequestQuoteApprovalRequest(input: RequestQuoteApprovalInput): RequestQuoteApprovalRequest {
  return compact({ note: input.note?.trim() });
}

export function mapApproveQuoteRequest(input: ApproveQuoteInput): ApproveQuoteRequest {
  return compact({ note: input.note?.trim() });
}

export function mapRequestQuoteApprovalChangesRequest(input: RequestQuoteApprovalChangesInput): RequestQuoteApprovalChangesRequest {
  return { note: input.note.trim() };
}

export function mapRecordQuoteSendEvidenceRequest(input: RecordQuoteSendEvidenceInput): RecordQuoteSendEvidenceRequest {
  return compact({
    deliveryId: input.deliveryId,
    channel: input.channel,
    evidenceType: input.evidenceType,
    recipientEmail: input.recipientEmail?.trim(),
    recipient: input.recipient?.trim(),
    note: input.note?.trim(),
    sentAt: input.sentAt,
    fileName: input.fileName?.trim(),
  });
}

export function mapRejectQuoteRequest(input: RejectQuoteInput): RejectQuoteRequest {
  return compact({ reason: input.reason.trim(), note: input.note?.trim() });
}

export function mapExpireQuoteRequest(input: { reason?: string }): ExpireQuoteRequest {
  return compact({ reason: input.reason?.trim() });
}

export function mapReviseQuoteRequest(input: ReviseQuoteInput): ReviseQuoteRequest {
  return compact({ reason: input.reason?.trim() });
}


export function mapRequestQuoteApprovalBatchRequest(input: RequestQuoteApprovalBatchInput): RequestQuoteApprovalBatchRequest {
  return compact({ items: input.items.map((item) => ({ quoteId: item.quoteId, expectedVersion: item.expectedVersion })), note: input.note?.trim() });
}

export function mapExpireQuotesBatchRequest(input: ExpireQuotesBatchInput): ExpireQuotesBatchRequest {
  return compact({ items: input.items.map((item) => ({ quoteId: item.quoteId, expectedVersion: item.expectedVersion })), reason: input.reason?.trim() });
}

export function mapArchiveQuoteRequest(input: ArchiveQuoteInput): ArchiveQuoteRequest {
  return { reason: input.reason.trim() };
}

export function mapArchiveQuotesBatchRequest(input: ArchiveQuotesBatchInput): ArchiveQuotesBatchRequest {
  return { items: input.items.map((item) => ({ quoteId: item.quoteId, expectedVersion: item.expectedVersion })), reason: input.reason.trim() };
}

export function mapQuoteMutationResponse(response: QuoteMutationResponse): QuoteMutationResult {
  return { quote: mapQuoteReadModel(response.result.quote), evidence: mapEvidence(response) };
}

export function mapQuoteBatchMutationResponse(response: QuoteBatchMutationResponse): QuoteBatchMutationResult {
  return { quotes: response.result.quotes.map(mapQuoteReadModel), evidence: mapEvidence(response) };
}

function mapDraft(input: QuoteDraftInput): CreateQuoteDraftRequest {
  return compact({
    buyerRef: input.buyerRef,
    sourcePath: input.sourcePath,
    sourceDealId: input.sourceDealId,
    contactId: input.contactId,
    sourceLeadId: input.sourceLeadId,
    title: input.title.trim(),
    currency: input.currency.trim().toUpperCase(),
    ownerId: input.ownerId?.trim(),
    recipientEmail: input.recipientEmail?.trim(),
    lineItems: input.lineItems.map((line) => compact({
      productId: line.productId?.trim(),
      skuSnapshot: line.skuSnapshot?.trim(),
      productNameSnapshot: line.productNameSnapshot.trim(),
      productTypeSnapshot: line.productTypeSnapshot?.trim(),
      descriptionSnapshot: line.descriptionSnapshot?.trim(),
      quantity: normalizeDecimal(line.quantity),
      unitPrice: { amount: normalizeDecimal(line.unitPrice.amount), currency: line.unitPrice.currency.toUpperCase() },
      discountRate: normalizeDecimal(line.discountRate),
      taxRate: line.taxRate === undefined ? undefined : normalizeDecimal(line.taxRate),
      taxMode: line.taxMode,
      billingCycleSnapshot: line.billingCycleSnapshot?.trim(),
    })),
    adjustments: input.adjustments?.map((item) => ({
      id: item.id,
      label: item.label.trim(),
      type: item.type,
      calculation: item.calculation,
      value: normalizeDecimal(item.value),
    })),
    validUntil: input.validUntil,
    notes: input.notes?.trim(),
    paymentAgreement: input.paymentAgreement,
  });
}

function mapEvidence(response: QuoteMutationResponse | QuoteBatchMutationResponse): QuoteMutationEvidence {
  return {
    authority: "backend",
    commandId: response.commandId,
    correlationId: response.correlationId,
    aggregateId: response.aggregateId,
    aggregateType: response.aggregateType,
    version: response.version,
    occurredAt: response.occurredAt,
    outcome: response.outcome,
    warnings: response.warnings ?? [],
    emittedEventIds: response.emittedEventIds ?? [],
    auditEvidenceIds: response.auditEvidenceIds ?? [],
  };
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
