import type { AuthoritativePage } from "@/shared/application";
import {
  approveQuote,
  changeQuoteStatus,
  recordQuoteDelivery,
  requestQuoteApproval,
  requestQuoteApprovalChanges,
  reviseQuote,
} from "../application/commands/quoteCommands";
import {
  allocateQuoteIdentity,
  archiveQuote,
  archiveQuotes,
  saveQuote,
} from "../application/commands/quoteRepositoryCommands";
import type {
  ApproveQuoteInput,
  ArchiveQuoteInput,
  ArchiveQuotesBatchInput,
  QuoteApiRuntime,
  QuoteBatchMutationResult,
  QuoteCommandOptions,
  ExpireQuotesBatchInput,
  QuoteDraftInput,
  QuoteListQuery,
  QuoteMutationEvidence,
  QuoteMutationResult,
  QuoteVersionedCommandOptions,
  RecordQuoteSendEvidenceInput,
  RejectQuoteInput,
  RequestQuoteApprovalBatchInput,
  RequestQuoteApprovalChangesInput,
  RequestQuoteApprovalInput,
  ReviseQuoteInput,
} from "../application/ports/QuoteApiRuntime";
import type { QuoteRepository } from "../application/ports/QuoteRepository";
import {
  QuoteStatus,
  type Quote,
  type QuoteLineItem,
  type SalesDocumentAdjustment,
} from "../domain/model/quote.types";
import { applyQuoteApprovalAssessment } from "../domain/rules/quoteApprovalPolicy";

export function createQuoteDemoApiRuntime(repository: QuoteRepository): QuoteApiRuntime {
  return {
    mode: "demo",
    queries: {
      async list(query: QuoteListQuery = {}): Promise<AuthoritativePage<Quote>> {
        const items = filterQuotes(repository.list().filter((quote) => !quote.archivedAt), query);
        return { items, pageInfo: { hasNextPage: false, totalCount: items.length }, loadedAt: new Date().toISOString(), authority: "demo" };
      },
      async get(quoteId: string): Promise<Quote> { return requireQuote(repository, quoteId); },
    },
    commands: {
      async createDraft(input: QuoteDraftInput, options: QuoteCommandOptions): Promise<QuoteMutationResult> {
        return createDraft(repository, input, options);
      },
      async createDraftForDeal(dealId: string, input: QuoteDraftInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult> {
        return createDraft(repository, { ...input, sourcePath: "DEAL", sourceDealId: dealId }, options);
      },
      async replaceDraft(quoteId: string, input: QuoteDraftInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult> {
        const current = requireVersion(repository, quoteId, options.expectedVersion);
        if (![QuoteStatus.DRAFT, QuoteStatus.REVIEW].includes(current.status)) throw new Error("QUOTE_DRAFT_IMMUTABLE");
        const now = new Date().toISOString();
        const updated = saveQuote(repository, applyQuoteApprovalAssessment({
          ...current,
          ...draftFields(input),
          id: current.id,
          quoteNumber: current.quoteNumber,
          version: current.version,
          rootQuoteId: current.rootQuoteId,
          status: QuoteStatus.DRAFT,
          updatedAt: now,
          resourceVersion: currentVersion(current) + 1,
        }));
        return result(updated, options, now);
      },
      async repriceDraft(quoteId: string, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult> {
        const current = requireVersion(repository, quoteId, options.expectedVersion);
        if (![QuoteStatus.DRAFT, QuoteStatus.REVIEW].includes(current.status)) throw new Error("QUOTE_DRAFT_IMMUTABLE");
        const now = new Date().toISOString();
        const updated = saveQuote(repository, { ...current, updatedAt: now, resourceVersion: currentVersion(current) + 1 });
        return result(updated, options, now);
      },
      async requestApproval(quoteId: string, input: RequestQuoteApprovalInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult> {
        requireVersion(repository, quoteId, options.expectedVersion);
        const updated = requireUpdated(requestQuoteApproval(repository, quoteId, { actorId: "demo-user" }), quoteId);
        return commit(repository, updated, options);
      },
      async requestApprovalBatch(input: RequestQuoteApprovalBatchInput, options: QuoteCommandOptions): Promise<QuoteBatchMutationResult> {
        for (const item of input.items) requireVersion(repository, item.quoteId, item.expectedVersion);
        const quotes = input.items.map((item) => {
          const updated = requireUpdated(requestQuoteApproval(repository, item.quoteId, { actorId: "demo-user" }), item.quoteId);
          return saveQuote(repository, { ...updated, resourceVersion: item.expectedVersion + 1 });
        });
        const now = quotes[0]?.updatedAt ?? new Date().toISOString();
        return { quotes, evidence: evidence(`quotes:${input.items.map((item) => item.quoteId).join(",")}`, Math.max(1, ...quotes.map(currentVersion)), options, now) };
      },
      async approve(quoteId: string, input: ApproveQuoteInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult> {
        requireVersion(repository, quoteId, options.expectedVersion);
        const updated = requireUpdated(approveQuote(repository, quoteId, { actorId: "demo-user", note: input.note }), quoteId);
        return commit(repository, updated, options);
      },
      async requestApprovalChanges(quoteId: string, input: RequestQuoteApprovalChangesInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult> {
        requireVersion(repository, quoteId, options.expectedVersion);
        const updated = requireUpdated(requestQuoteApprovalChanges(repository, quoteId, { actorId: "demo-user", note: input.note }), quoteId);
        return commit(repository, updated, options);
      },
      async recordSendEvidence(quoteId: string, input: RecordQuoteSendEvidenceInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult> {
        requireVersion(repository, quoteId, options.expectedVersion);
        const updated = requireUpdated(recordQuoteDelivery(repository, quoteId, {
          id: input.deliveryId,
          channel: input.channel,
          evidenceType: input.evidenceType,
          recipientEmail: input.recipientEmail,
          recipient: input.recipient,
          note: input.note,
          sentAt: input.sentAt ?? new Date().toISOString(),
          sentBy: "demo-user",
          fileName: input.fileName,
        }), quoteId);
        return commit(repository, updated, options);
      },
      async reject(quoteId: string, input: RejectQuoteInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult> {
        requireVersion(repository, quoteId, options.expectedVersion);
        const updated = requireUpdated(changeQuoteStatus(repository, quoteId, QuoteStatus.REJECTED), quoteId);
        return commit(repository, { ...updated, approvalDecisionNote: input.note ?? input.reason }, options);
      },
      async expire(quoteId: string, _input: { reason?: string }, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult> {
        requireVersion(repository, quoteId, options.expectedVersion);
        return commit(repository, requireUpdated(changeQuoteStatus(repository, quoteId, QuoteStatus.EXPIRED), quoteId), options);
      },
      async expireBatch(input: ExpireQuotesBatchInput, options: QuoteCommandOptions): Promise<QuoteBatchMutationResult> {
        for (const item of input.items) requireVersion(repository, item.quoteId, item.expectedVersion);
        const quotes = input.items.map((item) => {
          const updated = requireUpdated(changeQuoteStatus(repository, item.quoteId, QuoteStatus.EXPIRED), item.quoteId);
          return saveQuote(repository, { ...updated, resourceVersion: item.expectedVersion + 1 });
        });
        const now = quotes[0]?.updatedAt ?? new Date().toISOString();
        return { quotes, evidence: evidence(`quotes:${input.items.map((item) => item.quoteId).join(",")}`, Math.max(1, ...quotes.map(currentVersion)), options, now) };
      },
      async revise(quoteId: string, _input: ReviseQuoteInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult> {
        requireVersion(repository, quoteId, options.expectedVersion);
        const updated = requireUpdated(reviseQuote(repository, quoteId), quoteId);
        const now = updated.updatedAt ?? new Date().toISOString();
        const versioned = saveQuote(repository, { ...updated, resourceVersion: 1 });
        return result(versioned, options, now);
      },
      async archive(quoteId: string, input: ArchiveQuoteInput, options: QuoteVersionedCommandOptions): Promise<QuoteMutationResult> {
        const current = requireVersion(repository, quoteId, options.expectedVersion);
        const updated = archiveQuote(repository, quoteId, { reason: input.reason, actorId: "demo-user" });
        const versioned = saveQuote(repository, { ...updated, resourceVersion: currentVersion(current) + 1 });
        return result(versioned, options, versioned.updatedAt ?? new Date().toISOString());
      },
      async archiveBatch(input: ArchiveQuotesBatchInput, options: QuoteCommandOptions): Promise<QuoteBatchMutationResult> {
        for (const item of input.items) requireVersion(repository, item.quoteId, item.expectedVersion);
        const archived = archiveQuotes(repository, input.items.map((item) => item.quoteId), { reason: input.reason, actorId: "demo-user" });
        const quotes = archived.map((quote) => saveQuote(repository, { ...quote, resourceVersion: currentVersion(quote) + 1 }));
        const now = quotes[0]?.updatedAt ?? new Date().toISOString();
        return { quotes, evidence: evidence(`quotes:${input.items.map((item) => item.quoteId).join(",")}`, Math.max(1, ...quotes.map(currentVersion)), options, now) };
      },
    },
  };
}

function createDraft(repository: QuoteRepository, input: QuoteDraftInput, options: QuoteCommandOptions): QuoteMutationResult {
  const now = new Date().toISOString();
  const identity = allocateQuoteIdentity(repository, now);
  const quote = saveQuote(repository, applyQuoteApprovalAssessment({
    ...draftFields(input),
    id: identity.id,
    quoteNumber: identity.quoteNumber,
    version: 1,
    rootQuoteId: identity.id,
    status: QuoteStatus.DRAFT,
    subtotal: 0,
    discountTotal: 0,
    taxTotal: 0,
    grandTotal: 0,
    createdAt: now,
    updatedAt: now,
    resourceVersion: 1,
    deliveryHistory: [],
  }));
  return result(quote, options, now);
}

function draftFields(input: QuoteDraftInput): Pick<Quote, "buyerRef" | "sourcePath" | "dealId" | "sourceDealId" | "contactId" | "sourceLeadId" | "title" | "currency" | "ownerId" | "recipientEmail" | "lineItems" | "adjustments" | "validUntil" | "notes" | "paymentAgreement"> {
  return {
    buyerRef: input.buyerRef,
    sourcePath: input.sourcePath,
    ...(input.sourceDealId ? { dealId: input.sourceDealId, sourceDealId: input.sourceDealId } : {}),
    ...(input.contactId ? { contactId: input.contactId } : {}),
    ...(input.sourceLeadId ? { sourceLeadId: input.sourceLeadId } : {}),
    title: input.title,
    currency: input.currency,
    ...(input.ownerId ? { ownerId: input.ownerId } : {}),
    ...(input.recipientEmail ? { recipientEmail: input.recipientEmail } : {}),
    lineItems: input.lineItems.map(mapLine),
    adjustments: input.adjustments?.map(mapAdjustment),
    ...(input.validUntil ? { validUntil: input.validUntil } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.paymentAgreement ? { paymentAgreement: structuredClone(input.paymentAgreement) } : {}),
  };
}

function mapLine(line: QuoteDraftInput["lineItems"][number]): QuoteLineItem {
  return {
    id: `line_${crypto.randomUUID()}`,
    productId: line.productId,
    skuSnapshot: line.skuSnapshot,
    productNameSnapshot: line.productNameSnapshot,
    productTypeSnapshot: line.productTypeSnapshot,
    descriptionSnapshot: line.descriptionSnapshot,
    quantity: Number(line.quantity),
    unitPriceSnapshot: Number(line.unitPrice.amount),
    discountPercent: Number(line.discountRate),
    taxRateSnapshot: line.taxRate === undefined ? undefined : Number(line.taxRate),
    taxModeSnapshot: line.taxMode.toLowerCase() as QuoteLineItem["taxModeSnapshot"],
    billingCycleSnapshot: line.billingCycleSnapshot,
  };
}
function mapAdjustment(item: QuoteDraftInput["adjustments"] extends readonly (infer T)[] | undefined ? T : never): SalesDocumentAdjustment {
  return { id: item.id, label: item.label, type: item.type, calculation: item.calculation, value: Number(item.value), amount: 0 };
}
function filterQuotes(quotes: readonly Quote[], query: QuoteListQuery): Quote[] {
  const filters = query.filters ?? {};
  const search = query.search?.trim().toLowerCase();
  return quotes.filter((quote) => {
    if (search && !`${quote.quoteNumber} ${quote.title}`.toLowerCase().includes(search)) return false;
    if (filters.status && quote.status !== filters.status) return false;
    if (filters.sourceDealId && (quote.sourceDealId ?? quote.dealId) !== filters.sourceDealId) return false;
    if (filters.buyerType && quote.buyerRef.type !== filters.buyerType) return false;
    if (filters.buyerId && quote.buyerRef.id !== filters.buyerId) return false;
    return true;
  });
}
function currentVersion(quote: Quote): number { return quote.resourceVersion ?? 1; }
function requireQuote(repository: QuoteRepository, quoteId: string): Quote { const quote = repository.getById(quoteId); if (!quote) throw new Error(`QUOTE_NOT_FOUND:${quoteId}`); return quote; }
function requireVersion(repository: QuoteRepository, quoteId: string, expectedVersion: number): Quote { const quote = requireQuote(repository, quoteId); if (currentVersion(quote) !== expectedVersion) throw new Error(`QUOTE_VERSION_CONFLICT:${quoteId}`); return quote; }
function requireUpdated(value: Quote | undefined, quoteId: string): Quote { if (!value) throw new Error(`QUOTE_NOT_FOUND:${quoteId}`); return value; }
function commit(repository: QuoteRepository, quote: Quote, options: QuoteVersionedCommandOptions): QuoteMutationResult {
  const now = quote.updatedAt ?? new Date().toISOString();
  const versioned = saveQuote(repository, { ...quote, resourceVersion: options.expectedVersion + 1 });
  return result(versioned, options, now);
}
function result(quote: Quote, options: QuoteCommandOptions, now: string): QuoteMutationResult { return { quote, evidence: evidence(quote.id, currentVersion(quote), options, now) }; }
function evidence(aggregateId: string, version: number, options: QuoteCommandOptions, occurredAt: string): QuoteMutationEvidence {
  return { authority: "demo", commandId: options.idempotencyKey, correlationId: options.correlationId ?? options.idempotencyKey, aggregateId, aggregateType: "quote", version, occurredAt, outcome: "DEMO_COMMITTED", warnings: [], emittedEventIds: [], auditEvidenceIds: [] };
}
