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

export class QuoteHttpApiAdapter implements QuoteQueryPort, QuoteCommandPort {
  constructor(private readonly api: CommercialApiClient) {}

  async list(query: QuoteListQuery = {}, signal?: AbortSignal): Promise<AuthoritativePage<Quote>> {
    const filters = query.filters ?? {};
    const response = await this.api.listQuotes<QuoteListResponse>(compact({
      cursor: query.cursor,
      limit: query.limit,
      search: query.search,
      sortBy: query.sortBy as "updatedAt" | "createdAt" | "validUntil" | "grandTotal" | "quoteNumber" | undefined,
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
