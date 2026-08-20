import {
  createMutationMetadata,
  MutationCommandError,
  runBackendProjection,
  type MutationCommandMetadata,
  type MutationOutcome,
} from "@/shared/application";
import type { QuoteDraftInput, QuoteMutationEvidence } from "../application/ports/QuoteApiRuntime";
import type { Quote } from "../domain/model/quote.types";
import {
  allocateQuoteIdentity,
  archiveQuote,
  archiveQuotes,
  saveQuote,
  updateQuoteCollection,
  type QuoteCollectionUpdater,
} from "../application/commands/quoteRepositoryCommands";
import {
  approveQuote,
  changeQuoteStatus,
  duplicateQuote,
  recordQuoteDelivery,
  requestQuoteApproval,
  requestQuoteApprovalChanges,
  reviseQuote,
} from "../application/commands/quoteCommands";
import {
  getQuoteApiRuntime,
  isQuoteConnectedApiRuntime,
  quotePreferences,
  quoteRepository,
} from "../application/composition/quoteApplicationServices";
import { QuoteStatus } from "../domain/model/quote.types";
import { executeFrontendRequest } from "@/platform/request-simulation";

export function getQuotesSnapshot(): Quote[] { return quoteRepository.list().filter((quote) => !quote.archivedAt); }
export function getRetainedQuotesSnapshot(): Quote[] { return quoteRepository.list(); }
export function getQuoteSnapshot(quoteId: string): Quote | undefined { return quoteRepository.getById(quoteId); }
export function replaceQuotes(quotes: Quote[]): void { quoteRepository.replace(quotes); }
export function updateQuotes(updater: QuoteCollectionUpdater): Quote[] { return updateQuoteCollection(quoteRepository, updater); }
export function allocateQuoteIdentitySnapshot(now?: Date | string): { id: string; quoteNumber: string } { return allocateQuoteIdentity(quoteRepository, now); }
export function saveQuoteSnapshot(quote: Quote): Quote { assertDemoQuoteMutationAllowed("saveQuoteSnapshot"); return saveQuote(quoteRepository, quote); }
export function saveQuoteSnapshotAsync(quote: Quote): Promise<Quote> { return executeFrontendRequest("quotes.save", () => saveQuoteSnapshot(quote)); }

export type QuoteLifecycleMutationMetadata = Partial<MutationCommandMetadata>;

export async function saveQuoteCommand(quote: Quote, metadata: QuoteLifecycleMutationMetadata = {}): Promise<MutationOutcome<Quote>> {
  const current = getQuoteSnapshot(quote.id);
  const commandType = current ? "quote.update-draft" : "quote.create";
  const commandMetadata = createMutationMetadata(`${commandType}:${quote.id}`, metadata);
  const result = current
    ? await getQuoteApiRuntime().commands.replaceDraft(current.id, toDraftInput(quote), versionedOptions(current, commandMetadata, "replace-draft"))
    : await getQuoteApiRuntime().commands.createDraft(toDraftInput(quote), commandOptions(commandMetadata));
  projectQuote(result.quote);
  return quoteOutcome(commandType, commandMetadata, result.quote, result.evidence);
}

export async function repriceQuoteDraftCommand(quoteId: string, metadata: QuoteLifecycleMutationMetadata = {}): Promise<MutationOutcome<Quote>> {
  const current = requireQuote(quoteId);
  const commandMetadata = createMutationMetadata(`quote.reprice:${quoteId}`, metadata);
  const result = await getQuoteApiRuntime().commands.repriceDraft(quoteId, versionedOptions(current, commandMetadata, "reprice"));
  projectQuote(result.quote);
  return quoteOutcome("quote.reprice", commandMetadata, result.quote, result.evidence);
}

export async function duplicateQuoteCommand(quoteId: string, title: string, _now?: string, metadata: QuoteLifecycleMutationMetadata = {}): Promise<MutationOutcome<Quote>> {
  const source = requireQuote(quoteId);
  const commandMetadata = createMutationMetadata(`quote.create-copy:${quoteId}:${title.trim()}`, metadata);
  const result = await getQuoteApiRuntime().commands.createDraft({ ...toDraftInput(source), title: title.trim() }, commandOptions(commandMetadata));
  projectQuote(result.quote);
  return quoteOutcome("quote.create", commandMetadata, result.quote, result.evidence);
}

export async function createQuoteRevisionCommand(quoteId: string, _now?: string, metadata: QuoteLifecycleMutationMetadata = {}): Promise<MutationOutcome<Quote>> {
  const current = requireQuote(quoteId);
  const commandMetadata = createMutationMetadata(`quote.revise:${quoteId}`, metadata);
  const result = await getQuoteApiRuntime().commands.revise(quoteId, {}, versionedOptions(current, commandMetadata, "revise"));
  projectQuote(result.quote);
  return quoteOutcome("quote.revise", commandMetadata, result.quote, result.evidence);
}

export async function recordQuoteDeliveryCommand(quoteId: string, input: Parameters<typeof recordQuoteDelivery>[2], metadata: QuoteLifecycleMutationMetadata = {}): Promise<MutationOutcome<Quote>> {
  const current = requireQuote(quoteId);
  const commandMetadata = createMutationMetadata(`quote.send:${quoteId}`, { ...metadata, actor: metadata.actor ?? { id: input.sentBy } });
  const result = await getQuoteApiRuntime().commands.recordSendEvidence(quoteId, {
    deliveryId: input.id,
    channel: input.channel,
    evidenceType: input.evidenceType ?? "USER_CONFIRMED_SENT",
    recipientEmail: input.recipientEmail,
    recipient: input.recipient,
    note: input.note,
    sentAt: input.sentAt,
    fileName: input.fileName,
  }, versionedOptions(current, commandMetadata, "send"));
  projectQuote(result.quote);
  return quoteOutcome("quote.send", commandMetadata, result.quote, result.evidence);
}

/** Typed lifecycle entry point retained for existing presentation callers. */
export async function transitionQuoteStatusCommand(quoteId: string, status: QuoteStatus, _now?: string, metadata: QuoteLifecycleMutationMetadata = {}): Promise<MutationOutcome<Quote>> {
  const current = requireQuote(quoteId);
  const commandMetadata = createMutationMetadata(`quote.lifecycle:${quoteId}:${status}`, metadata);
  if (status === QuoteStatus.REJECTED) {
    const result = await getQuoteApiRuntime().commands.reject(quoteId, { reason: "CUSTOMER_REJECTED" }, versionedOptions(current, commandMetadata, "reject"));
    projectQuote(result.quote);
    return quoteOutcome("quote.reject", commandMetadata, result.quote, result.evidence);
  }
  if (status === QuoteStatus.EXPIRED) {
    const result = await getQuoteApiRuntime().commands.expire(quoteId, {}, versionedOptions(current, commandMetadata, "expire"));
    projectQuote(result.quote);
    return quoteOutcome("quote.expire", commandMetadata, result.quote, result.evidence);
  }
  throw new MutationCommandError({
    code: status === QuoteStatus.SENT ? "QUOTE_SEND_EVIDENCE_REQUIRED" : "QUOTE_TYPED_LIFECYCLE_COMMAND_REQUIRED",
    message: status === QuoteStatus.SENT
      ? "Quote delivery requires authenticated delivery evidence."
      : `Quote lifecycle status ${status} requires its dedicated command.`,
    category: "VALIDATION",
    retryable: false,
    details: { quoteId, status },
  });
}

export async function requestQuoteApprovalCommand(quoteId: string, input: { actorId: string; now?: string }, metadata: QuoteLifecycleMutationMetadata = {}): Promise<MutationOutcome<Quote>> {
  const current = requireQuote(quoteId);
  const commandMetadata = createMutationMetadata(`quote.request-approval:${quoteId}`, { ...metadata, actor: metadata.actor ?? { id: input.actorId } });
  const result = await getQuoteApiRuntime().commands.requestApproval(quoteId, {}, versionedOptions(current, commandMetadata, "request-approval"));
  projectQuote(result.quote);
  return quoteOutcome("quote.request-approval", commandMetadata, result.quote, result.evidence);
}


export async function requestQuoteApprovalBatchCommand(quoteIds: readonly string[], actorId: string, metadata: QuoteLifecycleMutationMetadata = {}): Promise<MutationOutcome<Quote[]>> {
  const items = quoteIds.map((quoteId) => ({ quoteId, expectedVersion: requireQuoteVersion(quoteId, "request-approval-batch") }));
  const aggregateId = [...quoteIds].sort().join(",");
  const commandMetadata = createMutationMetadata(`quote.request-approval-batch:${aggregateId}`, { ...metadata, actor: metadata.actor ?? { id: actorId } });
  const result = await getQuoteApiRuntime().commands.requestApprovalBatch({ items }, commandOptions(commandMetadata));
  projectQuotes(result.quotes);
  return quoteBatchOutcome("quote.request-approval-batch", commandMetadata, result.quotes, result.evidence);
}

export async function approveQuoteCommand(quoteId: string, input: { actorId: string; note?: string; now?: string }, metadata: QuoteLifecycleMutationMetadata = {}): Promise<MutationOutcome<Quote>> {
  const current = requireQuote(quoteId);
  const commandMetadata = createMutationMetadata(`quote.approve:${quoteId}`, { ...metadata, actor: metadata.actor ?? { id: input.actorId } });
  const result = await getQuoteApiRuntime().commands.approve(quoteId, { note: input.note }, versionedOptions(current, commandMetadata, "approve"));
  projectQuote(result.quote);
  return quoteOutcome("quote.approve", commandMetadata, result.quote, result.evidence);
}

export async function requestQuoteApprovalChangesCommand(quoteId: string, input: { actorId: string; note: string; now?: string }, metadata: QuoteLifecycleMutationMetadata = {}): Promise<MutationOutcome<Quote>> {
  const current = requireQuote(quoteId);
  const commandMetadata = createMutationMetadata(`quote.request-approval-changes:${quoteId}`, { ...metadata, actor: metadata.actor ?? { id: input.actorId } });
  const result = await getQuoteApiRuntime().commands.requestApprovalChanges(quoteId, { note: input.note }, versionedOptions(current, commandMetadata, "request-approval-changes"));
  projectQuote(result.quote);
  return quoteOutcome("quote.request-approval-changes", commandMetadata, result.quote, result.evidence);
}


export async function expireQuotesBatchCommand(quoteIds: readonly string[], metadata: QuoteLifecycleMutationMetadata = {}): Promise<MutationOutcome<Quote[]>> {
  const items = quoteIds.map((quoteId) => ({ quoteId, expectedVersion: requireQuoteVersion(quoteId, "expire-batch") }));
  const aggregateId = [...quoteIds].sort().join(",");
  const commandMetadata = createMutationMetadata(`quote.expire-batch:${aggregateId}`, metadata);
  const result = await getQuoteApiRuntime().commands.expireBatch({ items }, commandOptions(commandMetadata));
  projectQuotes(result.quotes);
  return quoteBatchOutcome("quote.expire-batch", commandMetadata, result.quotes, result.evidence);
}

export async function archiveQuoteCommand(quoteId: string, input: Parameters<typeof archiveQuote>[2], metadata: QuoteLifecycleMutationMetadata = {}): Promise<MutationOutcome<Quote>> {
  const current = requireQuote(quoteId);
  const commandMetadata = createMutationMetadata(`quote.archive:${quoteId}`, { ...metadata, actor: metadata.actor ?? { id: input.actorId, name: input.actorName } });
  const result = await getQuoteApiRuntime().commands.archive(quoteId, { reason: input.reason }, versionedOptions(current, commandMetadata, "archive"));
  projectQuote(result.quote);
  return quoteOutcome("quote.archive", commandMetadata, result.quote, result.evidence);
}

export async function archiveQuotesCommand(quoteIds: readonly string[], input: Parameters<typeof archiveQuotes>[2], metadata: QuoteLifecycleMutationMetadata = {}): Promise<MutationOutcome<Quote[]>> {
  const items = quoteIds.map((quoteId) => ({ quoteId, expectedVersion: requireQuoteVersion(quoteId, "archive-batch") }));
  const aggregateId = [...quoteIds].sort().join(",");
  const commandMetadata = createMutationMetadata(`quote.archive-many:${aggregateId}`, { ...metadata, actor: metadata.actor ?? { id: input.actorId, name: input.actorName } });
  const result = await getQuoteApiRuntime().commands.archiveBatch({ items, reason: input.reason }, commandOptions(commandMetadata));
  projectQuotes(result.quotes);
  return quoteBatchOutcome("quote.archive-many", commandMetadata, result.quotes, result.evidence);
}

/** Demo-only snapshot mutation. */
export function transitionQuoteStatus(quoteId: string, status: QuoteStatus, now?: string): Quote | undefined { assertDemoQuoteMutationAllowed("transitionQuoteStatus"); return changeQuoteStatus(quoteRepository, quoteId, status, now); }
/** Demo-only snapshot mutation. */
export function requestQuoteApprovalSnapshot(quoteId: string, input: { actorId: string; now?: string }): Quote | undefined { assertDemoQuoteMutationAllowed("requestQuoteApprovalSnapshot"); return requestQuoteApproval(quoteRepository, quoteId, input); }
/** Demo-only snapshot mutation. */
export function approveQuoteSnapshot(quoteId: string, input: { actorId: string; note?: string; now?: string }): Quote | undefined { assertDemoQuoteMutationAllowed("approveQuoteSnapshot"); return approveQuote(quoteRepository, quoteId, input); }
/** Demo-only snapshot mutation. */
export function requestQuoteApprovalChangesSnapshot(quoteId: string, input: { actorId: string; note: string; now?: string }): Quote | undefined { assertDemoQuoteMutationAllowed("requestQuoteApprovalChangesSnapshot"); return requestQuoteApprovalChanges(quoteRepository, quoteId, input); }
/** Demo-only snapshot mutation. */
export function recordQuoteDeliverySnapshot(quoteId: string, input: Parameters<typeof recordQuoteDelivery>[2]): Quote | undefined { assertDemoQuoteMutationAllowed("recordQuoteDeliverySnapshot"); return recordQuoteDelivery(quoteRepository, quoteId, input); }
/** Demo-only snapshot mutation. */
export function copyQuote(quoteId: string, title: string, now?: string): Quote | undefined { assertDemoQuoteMutationAllowed("copyQuote"); return duplicateQuote(quoteRepository, quoteId, title, now); }
/** Demo-only snapshot mutation. */
export function createQuoteRevision(quoteId: string, now?: string): Quote | undefined { assertDemoQuoteMutationAllowed("createQuoteRevision"); return reviseQuote(quoteRepository, quoteId, now); }

export function subscribeToQuotes(listener: (quotes: Quote[]) => void): () => void { return quoteRepository.subscribe((quotes) => listener(quotes.filter((quote) => !quote.archivedAt))); }
export function getQuotePreference<T>(key: string, fallback: T): T { return quotePreferences.get(key, fallback); }
export function setQuotePreference<T>(key: string, value: T): void { quotePreferences.set(key, value); }
export function removeQuotePreference(key: string): void { quotePreferences.remove(key); }

function toDraftInput(quote: Quote): QuoteDraftInput {
  const currency = (quote.currency || "VND").toUpperCase();
  return {
    buyerRef: quote.buyerRef,
    sourcePath: quote.sourcePath,
    sourceDealId: quote.sourceDealId ?? quote.dealId,
    contactId: quote.contactId,
    sourceLeadId: quote.sourceLeadId ?? quote.leadId,
    title: quote.title,
    currency,
    ownerId: quote.ownerId,
    recipientEmail: quote.recipientEmail,
    lineItems: quote.lineItems.map((line) => ({
      productId: line.productId,
      skuSnapshot: line.skuSnapshot,
      productNameSnapshot: line.productNameSnapshot ?? line.productName ?? "",
      productTypeSnapshot: line.productTypeSnapshot,
      descriptionSnapshot: line.descriptionSnapshot ?? line.description,
      quantity: String(line.quantity),
      unitPrice: { amount: String(line.unitPriceSnapshot ?? line.unitPrice ?? 0), currency },
      discountRate: String(line.discountPercent ?? 0),
      taxRate: line.taxRateSnapshot === undefined ? undefined : String(line.taxRateSnapshot),
      taxMode: (line.taxModeSnapshot ?? "none").toUpperCase() as "EXCLUSIVE" | "INCLUSIVE" | "NONE",
      billingCycleSnapshot: line.billingCycleSnapshot,
    })),
    adjustments: quote.adjustments?.map((item) => ({ id: item.id, label: item.label, type: item.type, calculation: item.calculation, value: String(item.value) })),
    validUntil: quote.validUntil ?? quote.expiryDate,
    notes: quote.notes ?? quote.termsAndNotes,
    paymentAgreement: quote.paymentAgreement,
  };
}

function requireQuote(quoteId: string): Quote { const quote = getQuoteSnapshot(quoteId); if (!quote) throw new MutationCommandError({ code: "RESOURCE_NOT_FOUND", message: `Quote ${quoteId} was not found.`, category: "NOT_FOUND", retryable: false }); return quote; }
function requireQuoteVersion(quoteId: string, operation: string): number { return readQuoteVersion(requireQuote(quoteId), operation); }
function readQuoteVersion(quote: Quote, operation: string): number {
  if (typeof quote.resourceVersion === "number" && Number.isInteger(quote.resourceVersion) && quote.resourceVersion > 0) return quote.resourceVersion;
  if (getQuoteApiRuntime().mode === "demo") return 1;
  throw new MutationCommandError({ code: "QUOTE_RESOURCE_VERSION_REQUIRED", message: `Quote ${quote.id} is missing backend resourceVersion for ${operation}.`, category: "CONFLICT", retryable: true, details: { quoteId: quote.id, operation } });
}
function commandOptions(metadata: MutationCommandMetadata) { return { idempotencyKey: metadata.idempotencyKey, correlationId: metadata.correlationId, signal: metadata.signal }; }
function versionedOptions(quote: Quote, metadata: MutationCommandMetadata, operation: string) { return { ...commandOptions(metadata), expectedVersion: typeof metadata.expectedVersion === "number" ? metadata.expectedVersion : readQuoteVersion(quote, operation) }; }
function projectQuote(quote: Quote): void { runBackendProjection("quotes", () => { const current = quoteRepository.list(); quoteRepository.replace(current.some((item) => item.id === quote.id) ? current.map((item) => item.id === quote.id ? structuredClone(quote) : item) : [structuredClone(quote), ...current]); }); }
function projectQuotes(quotes: readonly Quote[]): void { for (const quote of quotes) projectQuote(quote); }
function quoteOutcome(commandType: string, metadata: MutationCommandMetadata, quote: Quote, evidence: QuoteMutationEvidence): MutationOutcome<Quote> { return { data: quote, commandId: evidence.commandId, commandType, aggregateType: evidence.aggregateType, aggregateId: evidence.aggregateId, idempotencyKey: metadata.idempotencyKey, correlationId: evidence.correlationId, occurredAt: evidence.occurredAt, version: evidence.version, outcome: evidence.outcome, warnings: [...evidence.warnings], emittedEvents: [...evidence.emittedEventIds], audit: { authority: evidence.authority === "backend" ? "backend" : "demo", evidenceIds: [...evidence.auditEvidenceIds] } }; }
function quoteBatchOutcome(commandType: string, metadata: MutationCommandMetadata, quotes: readonly Quote[], evidence: QuoteMutationEvidence): MutationOutcome<Quote[]> { return { ...quoteOutcome(commandType, metadata, quotes[0] ?? ({ id: evidence.aggregateId } as Quote), evidence), data: [...quotes], aggregateType: "quote-batch" }; }
function assertDemoQuoteMutationAllowed(operation: string): void { if (!isQuoteConnectedApiRuntime()) return; throw new MutationCommandError({ code: "QUOTE_CONNECTED_MUTATION_REQUIRES_API", message: `Connected Quote mutation ${operation} requires the dedicated Quote API runtime.`, category: "INFRASTRUCTURE", retryable: false, details: { operation } }); }
