import type { BuyerRef } from "@/platform/identity";
import type { AuthoritativePage, ModuleListQuery } from "@/shared/application";
import type { MoneyDto } from "@/shared/money";
import type { PaymentAgreementSnapshot } from "@/shared/order-to-cash";
import type {
  Quote,
  QuoteApprovalReason,
  QuoteDeliveryChannel,
  QuoteDeliveryRecord,
  QuoteSourcePath,
  SalesDocumentAdjustmentCalculation,
  SalesDocumentAdjustmentType,
} from "../../domain/model/quote.types";

export type QuoteApiRuntimeMode = "demo" | "connected" | "test";

export interface QuoteListQuery extends ModuleListQuery {
  filters?: {
    status?: Quote["status"];
    sourceDealId?: string;
    buyerType?: BuyerRef["type"];
    buyerId?: string;
  };
}

export interface QuoteDraftLineInput {
  productId?: string;
  skuSnapshot?: string;
  productNameSnapshot: string;
  productTypeSnapshot?: string;
  descriptionSnapshot?: string;
  quantity: string;
  unitPrice: MoneyDto;
  discountRate: string;
  taxRate?: string;
  taxMode: "EXCLUSIVE" | "INCLUSIVE" | "NONE";
  billingCycleSnapshot?: string;
}

export interface QuoteAdjustmentInput {
  id: string;
  label: string;
  type: SalesDocumentAdjustmentType;
  calculation: SalesDocumentAdjustmentCalculation;
  value: string;
}

export interface QuoteDraftInput {
  buyerRef: BuyerRef;
  sourcePath: QuoteSourcePath;
  sourceDealId?: string;
  contactId?: string;
  sourceLeadId?: string;
  title: string;
  currency: string;
  ownerId?: string;
  recipientEmail?: string;
  lineItems: readonly QuoteDraftLineInput[];
  adjustments?: readonly QuoteAdjustmentInput[];
  validUntil?: string;
  notes?: string;
  paymentAgreement?: PaymentAgreementSnapshot;
}

export interface RequestQuoteApprovalInput { note?: string; }
export interface ApproveQuoteInput { note?: string; }
export interface RequestQuoteApprovalChangesInput { note: string; }
export interface RecordQuoteSendEvidenceInput {
  deliveryId: string;
  channel: QuoteDeliveryChannel;
  evidenceType: NonNullable<QuoteDeliveryRecord["evidenceType"]>;
  recipientEmail?: string;
  recipient?: string;
  note?: string;
  sentAt?: string;
  fileName?: string;
}
export interface RejectQuoteInput { reason: string; note?: string; }
export interface ExpireQuoteInput { reason?: string; }
export interface ReviseQuoteInput { reason?: string; }
export interface ArchiveQuoteInput { reason: string; }
export interface QuoteBatchVersionInput { items: readonly { quoteId: string; expectedVersion: number }[]; }
export interface RequestQuoteApprovalBatchInput extends QuoteBatchVersionInput { note?: string; }
export interface ExpireQuotesBatchInput extends QuoteBatchVersionInput { reason?: string; }
export interface ArchiveQuotesBatchInput extends QuoteBatchVersionInput { reason: string; }

export interface QuoteCommandOptions {
  idempotencyKey: string;
  correlationId?: string;
  signal?: AbortSignal;
}
export interface QuoteVersionedCommandOptions extends QuoteCommandOptions { expectedVersion: number; }

export interface QuoteMutationEvidence {
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

export interface QuoteMutationResult { quote: Quote; evidence: QuoteMutationEvidence; }
export interface QuoteBatchMutationResult { quotes: readonly Quote[]; evidence: QuoteMutationEvidence; }

export interface QuoteQueryPort {
  list(query?: QuoteListQuery, signal?: AbortSignal): Promise<AuthoritativePage<Quote>>;
  get(quoteId: string, signal?: AbortSignal): Promise<Quote>;
}

export interface QuoteCommandPort {
  createDraft(input: QuoteDraftInput, options: QuoteCommandOptions): Promise<QuoteMutationResult>;
  createDraftForDeal(dealId: string, input: QuoteDraftInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult>;
  replaceDraft(quoteId: string, input: QuoteDraftInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult>;
  repriceDraft(quoteId: string, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult>;
  requestApproval(quoteId: string, input: RequestQuoteApprovalInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult>;
  requestApprovalBatch(input: RequestQuoteApprovalBatchInput, options: QuoteCommandOptions): Promise<QuoteBatchMutationResult>;
  approve(quoteId: string, input: ApproveQuoteInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult>;
  requestApprovalChanges(quoteId: string, input: RequestQuoteApprovalChangesInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult>;
  recordSendEvidence(quoteId: string, input: RecordQuoteSendEvidenceInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult>;
  reject(quoteId: string, input: RejectQuoteInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult>;
  expire(quoteId: string, input: ExpireQuoteInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult>;
  expireBatch(input: ExpireQuotesBatchInput, options: QuoteCommandOptions): Promise<QuoteBatchMutationResult>;
  revise(quoteId: string, input: ReviseQuoteInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult>;
  archive(quoteId: string, input: ArchiveQuoteInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult>;
  archiveBatch(input: ArchiveQuotesBatchInput, options: QuoteCommandOptions): Promise<QuoteBatchMutationResult>;
}

export interface QuoteApiRuntime {
  mode: QuoteApiRuntimeMode;
  queries: QuoteQueryPort;
  commands: QuoteCommandPort;
}

export type { QuoteApprovalReason };
