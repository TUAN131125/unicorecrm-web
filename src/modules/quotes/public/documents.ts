import { createMutationMetadata, MutationCommandError, type MutationOutcome } from "@/shared/application";
import { getQuoteApiRuntime } from "../application/composition/quoteApplicationServices";
import { getQuoteDetailResource } from "../application/vertical-slice/quoteAuthoritativeQueries";
import type { QuoteDocumentIssueResult } from "../application/read-models/quoteDocumentModels";
export type { IssuedQuoteDocument, QuoteSellerReadiness } from "../application/read-models/quoteDocumentModels";

function runtime() {
  const port = getQuoteApiRuntime().documents;
  if (!port || getQuoteApiRuntime().mode !== "connected") throw new MutationCommandError({ code: "BLOCKED_CONTRACT", message: "Authoritative document service unavailable.", category: "INFRASTRUCTURE", retryable: false });
  return port;
}
export function readQuoteDocumentSeller(signal?: AbortSignal) { return runtime().seller(signal); }
export function readQuoteDocuments(quoteId: string, cursor?: string, signal?: AbortSignal) { return runtime().listDocuments(quoteId, cursor, signal); }
export function downloadIssuedQuoteDocument(quoteId: string, documentId: string, signal?: AbortSignal) { return runtime().downloadDocument(quoteId, documentId, signal); }
export async function issueQuoteDocumentCommand(quoteId: string, version: number, reason: string, idempotencyKey: string): Promise<MutationOutcome<QuoteDocumentIssueResult>> {
  const metadata = createMutationMetadata(`quote.issue-document:${quoteId}`, { expectedVersion: version, idempotencyKey });
  const result = await runtime().issueDocument(quoteId, reason, { expectedVersion: version, idempotencyKey: metadata.idempotencyKey });
  void getQuoteDetailResource(quoteId).refresh();
  const e = result.evidence;
  return { data: result, commandId: e.commandId, commandType: "quote.issue-document", aggregateType: e.aggregateType,
    aggregateId: e.aggregateId, idempotencyKey: metadata.idempotencyKey, correlationId: e.correlationId, occurredAt: e.occurredAt,
    version: e.version, outcome: e.outcome, warnings: [...e.warnings], emittedEvents: [...e.emittedEventIds],
    audit: { authority: "backend", evidenceIds: [...e.auditEvidenceIds] } };
}

export function readQuoteCommercialPreview(quoteId: string, signal?: AbortSignal) { return runtime().preview(quoteId, signal); }
