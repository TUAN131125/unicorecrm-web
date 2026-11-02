import type { QuoteAcceptanceReadiness, QuoteAcceptanceReadPort } from "../../application/read-models/quoteAcceptanceReadiness";
import type { QuoteCustomerAcceptanceReadiness as ApiAcceptanceReadiness } from "@/platform/api/generated/commercialApi";
import type { QuoteCommercialPreviewRead as DocumentPreview } from "../../application/read-models/quoteDocumentModels";
import type { QuoteReadModel as ApiDocumentPreview } from "@/platform/api/generated/commercialApi";
import type { QuoteDocumentPort, QuoteDocumentPage, QuoteSellerReadiness, QuoteDocumentIssueResult, IssuedQuoteDocument } from "../../application/read-models/quoteDocumentModels";
import type { QuoteDocumentSeller, QuoteDocumentList, QuoteDocumentIssueResponse, QuoteIssuedDocument } from "@/platform/api/generated/commercialApi";
import { ApiClientError } from "@/platform/api/errors/ApiClientError";
import type {
  CommercialApiClient,
  QuoteBatchMutationResponse,
  QuoteListResponse,
  QuoteMutationResponse,
} from "@/platform/api/generated/commercialApi";
import type { AuthoritativePage } from "@/shared/application";
import type {
  ApproveQuoteInput,
  ArchiveQuoteInput,
  ArchiveQuotesBatchInput,
  ExpireQuotesBatchInput,
  QuoteBatchMutationResult,
  QuoteCommandOptions,
  QuoteCommandPort,
  QuoteDraftInput,
  QuoteListQuery,
  QuoteMutationResult,
  QuoteQueryPort,
  QuoteVersionedCommandOptions,
  RecordQuoteSendEvidenceInput,
  RecordQuoteCustomerDecisionInput,
  RejectQuoteInput,
  RequestQuoteApprovalBatchInput,
  RequestQuoteApprovalChangesInput,
  RequestQuoteApprovalInput,
  ReviseQuoteInput,
} from "../../application/ports/QuoteApiRuntime";
import type { Quote } from "../../domain/model/quote.types";
import {
  mapApproveQuoteRequest,
  mapArchiveQuoteRequest,
  mapArchiveQuotesBatchRequest,
  mapCreateQuoteDraftRequest,
  mapCreateQuoteForDealRequest,
  mapExpireQuoteRequest,
  mapExpireQuotesBatchRequest,
  mapQuoteBatchMutationResponse,
  mapQuoteMutationResponse,
  mapQuoteReadModel,
  mapRecordQuoteSendEvidenceRequest,
  mapRejectQuoteRequest,
  mapReplaceQuoteDraftRequest,
  mapRequestQuoteApprovalBatchRequest,
  mapRequestQuoteApprovalChangesRequest,
  mapRequestQuoteApprovalRequest,
  mapReviseQuoteRequest,
} from "./QuoteApiMapper";

export class QuoteHttpApiAdapter implements QuoteQueryPort, QuoteCommandPort, QuoteDocumentPort, QuoteAcceptanceReadPort {
  constructor(private readonly api: CommercialApiClient) {}

  async acceptanceReadiness(quoteId: string, documentId?: string, signal?: AbortSignal): Promise<QuoteAcceptanceReadiness> {
    const dto = await this.api.getQuoteCustomerAcceptanceReadiness<ApiAcceptanceReadiness>(quoteId, documentId ? { documentId } : {}, signal);
    return { ...dto, blockerCodes: [...dto.blockerCodes], ...(dto.binding ? { binding: { ...dto.binding, buyerRef: { ...dto.binding.buyerRef } } } : {}) };
  }

  async preview(quoteId: string, signal?: AbortSignal): Promise<DocumentPreview> {
    const dto = await this.api.getQuote<ApiDocumentPreview>(quoteId, {}, signal);
    return { quoteNumber: dto.quoteNumber, quoteRevision: dto.quoteRevision, title: dto.title, buyerRef: dto.buyerRef,
      validUntil: dto.validUntil, currency: dto.currency, lineItems: dto.lineItems.map(line => ({ ...line })),
      subtotal: dto.subtotal, discountTotal: dto.discountTotal, taxTotal: dto.taxTotal, grandTotal: dto.grandTotal, notes: dto.notes, adjustments: dto.adjustments?.map(a => ({ id: a.id, label: a.label, amount: { ...a.amount } })) };
  }
  async seller(signal?: AbortSignal): Promise<QuoteSellerReadiness> {
    const result = await this.api.getQuoteDocumentSeller<QuoteDocumentSeller>({}, signal);
    return { ready: result.ready, blockerCodes: result.blockerCodes, ...(result.seller ? { seller: { ...result.seller } } : {}) };
  }
  async listDocuments(quoteId: string, cursor?: string, signal?: AbortSignal): Promise<QuoteDocumentPage> {
    const result = await this.api.listQuoteDocuments<QuoteDocumentList>(quoteId, { limit: 20, ...(cursor ? { cursor } : {}) }, signal);
    return { items: result.items.map(mapIssuedDocument), ...(result.pageInfo.nextCursor ? { nextCursor: result.pageInfo.nextCursor } : {}) };
  }
  async issueDocument(quoteId: string, reason: string, options: QuoteVersionedCommandOptions): Promise<QuoteDocumentIssueResult> {
    const result = await this.api.issueQuoteDocumentCommand<QuoteDocumentIssueResponse>(quoteId, reason ? { reason } : {}, options);
    const mapped = mapQuoteMutationResponse({ ...result, warnings: [], emittedEventIds: result.eventIds ?? [], auditEvidenceIds: result.auditIds ?? [], result: { quote: result.result.quote } });
    return { ...mapped, document: mapIssuedDocument(result.result.document) };
  }
  async downloadDocument(quoteId: string, documentId: string, signal?: AbortSignal): Promise<{ document: IssuedQuoteDocument; blob: Blob }> {
    const metadata = await this.api.getQuoteDocument<QuoteIssuedDocument>(quoteId, documentId, {}, signal);
    const blob = await this.api.downloadQuoteDocument<Blob>(quoteId, documentId, {}, signal);
    const bytes = await blob.arrayBuffer();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), x => x.toString(16).padStart(2, "0")).join("").toUpperCase();
    if (blob.size !== metadata.fileSize || hash !== metadata.pdfSha256.toUpperCase()) throw new ApiClientError({ code: "RESPONSE_DESERIALIZATION_FAILED", message: "Issued PDF integrity mismatch.", retryable: false });
    return { document: mapIssuedDocument(metadata), blob };
  }

  async list(query: QuoteListQuery = {}, signal?: AbortSignal): Promise<AuthoritativePage<Quote>> {
    const filters = query.filters ?? {};
    const response = await this.api.listQuotes<QuoteListResponse>(compact({
      cursor: query.cursor,
      rootQuoteId: filters.rootQuoteId,
      archived: filters.archived,
      limit: query.limit,
      search: query.search,
      sortBy: query.sortBy as "updatedAt" | "createdAt" | "validUntil" | "grandTotal" | "quoteNumber" | "quoteRevision" | undefined,
      sortDirection: query.sortDirection,
      status: filters.status,
      sourceDealId: filters.sourceDealId,
      buyerType: filters.buyerType,
      buyerId: filters.buyerId,
    }), signal);
    return { items: response.items.map(mapQuoteReadModel), pageInfo: response.pageInfo, loadedAt: new Date().toISOString(), authority: "backend" };
  }

  async get(quoteId: string, signal?: AbortSignal): Promise<Quote> {
    return mapQuoteReadModel(await this.api.getQuote(quoteId, signal));
  }

  async createDraft(input: QuoteDraftInput, options: QuoteCommandOptions): Promise<QuoteMutationResult> {
    return mapQuoteMutationResponse(await this.api.createQuoteCommand<QuoteMutationResponse>(mapCreateQuoteDraftRequest(input), options));
  }

  async createDraftForDeal(dealId: string, input: QuoteDraftInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult> {
    return mapQuoteMutationResponse(await this.api.createQuoteForDeal<QuoteMutationResponse>(dealId, mapCreateQuoteForDealRequest(input), options));
  }

  async replaceDraft(quoteId: string, input: QuoteDraftInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult> {
    return mapQuoteMutationResponse(await this.api.updateQuoteDraftCommand<QuoteMutationResponse>(quoteId, mapReplaceQuoteDraftRequest(input), options));
  }

  async repriceDraft(quoteId: string, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult> {
    return mapQuoteMutationResponse(await this.api.repriceQuoteDraft<QuoteMutationResponse>(quoteId, {}, options));
  }

  async requestApproval(quoteId: string, input: RequestQuoteApprovalInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult> {
    return mapQuoteMutationResponse(await this.api.requestQuoteApprovalCommand<QuoteMutationResponse>(quoteId, mapRequestQuoteApprovalRequest(input), options));
  }

  async requestApprovalBatch(input: RequestQuoteApprovalBatchInput, options: QuoteCommandOptions): Promise<QuoteBatchMutationResult> {
    return mapQuoteBatchMutationResponse(await this.api.requestQuoteApprovalBatch<QuoteBatchMutationResponse>(mapRequestQuoteApprovalBatchRequest(input), options));
  }

  async approve(quoteId: string, input: ApproveQuoteInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult> {
    return mapQuoteMutationResponse(await this.api.approveQuoteCommand<QuoteMutationResponse>(quoteId, mapApproveQuoteRequest(input), options));
  }

  async requestApprovalChanges(quoteId: string, input: RequestQuoteApprovalChangesInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult> {
    return mapQuoteMutationResponse(await this.api.requestQuoteApprovalChangesCommand<QuoteMutationResponse>(quoteId, mapRequestQuoteApprovalChangesRequest(input), options));
  }

  async recordSendEvidence(quoteId: string, input: RecordQuoteSendEvidenceInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult> {
    return mapQuoteMutationResponse(await this.api.recordQuoteSendEvidenceCommand<QuoteMutationResponse>(quoteId, mapRecordQuoteSendEvidenceRequest(input), options));
  }

  async recordCustomerDecision(quoteId: string, input: RecordQuoteCustomerDecisionInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult> {
    return mapQuoteMutationResponse(await this.api.recordQuoteCustomerDecisionCommand<QuoteMutationResponse>(quoteId, compact({
      decisionId: input.decisionId, evidenceType: input.evidenceType, sourceChannel: input.sourceChannel,
      sourceDescription: input.sourceDescription, reportedCustomerDecisionAt: input.reportedCustomerDecisionAt, note: input.note,
    }), options));
  }

  async reject(quoteId: string, input: RejectQuoteInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult> {
    return mapQuoteMutationResponse(await this.api.rejectQuoteCommand<QuoteMutationResponse>(quoteId, mapRejectQuoteRequest(input), options));
  }

  async expire(quoteId: string, input: { reason?: string }, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult> {
    return mapQuoteMutationResponse(await this.api.expireQuoteCommand<QuoteMutationResponse>(quoteId, mapExpireQuoteRequest(input), options));
  }

  async expireBatch(input: ExpireQuotesBatchInput, options: QuoteCommandOptions): Promise<QuoteBatchMutationResult> {
    return mapQuoteBatchMutationResponse(await this.api.expireQuotesBatch<QuoteBatchMutationResponse>(mapExpireQuotesBatchRequest(input), options));
  }

  async revise(quoteId: string, input: ReviseQuoteInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult> {
    return mapQuoteMutationResponse(await this.api.reviseQuoteCommand<QuoteMutationResponse>(quoteId, mapReviseQuoteRequest(input), options));
  }

  async archive(quoteId: string, input: ArchiveQuoteInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult> {
    return mapQuoteMutationResponse(await this.api.archiveQuoteCommand<QuoteMutationResponse>(quoteId, mapArchiveQuoteRequest(input), options));
  }

  async archiveBatch(input: ArchiveQuotesBatchInput, options: QuoteCommandOptions): Promise<QuoteBatchMutationResult> {
    return mapQuoteBatchMutationResponse(await this.api.archiveQuotesBatch<QuoteBatchMutationResponse>(mapArchiveQuotesBatchRequest(input), options));
  }
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function mapIssuedDocument(dto: QuoteIssuedDocument): IssuedQuoteDocument { return { ...dto }; }
