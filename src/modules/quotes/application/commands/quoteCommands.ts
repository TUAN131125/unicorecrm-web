import type { QuoteRepository } from "../ports/QuoteRepository";
import {
  QuoteApprovalStatus,
  QuoteStatus,
  type Quote,
  type QuoteDeliveryRecord,
} from "../../domain/model/quote.types";
import { canTransitionQuoteStatus, quoteContentFingerprint } from "../../domain/rules/quoteVersioning";
import { canQuoteBeSent } from "../../domain/rules/quoteApprovalPolicy";
import { allocateQuoteIdentity, saveQuote, updateQuote } from "./quoteRepositoryCommands";
import { CAPABILITIES, assertRuntimeCommandAccess } from "@/platform/access-control";
import { isQuotePastValidity } from "../../domain/rules/quoteConversion";
import { createDurableId } from "@/shared/ids";

export function changeQuoteStatus(repository: QuoteRepository, quoteId: string, status: QuoteStatus, now = currentDateTime()): Quote | undefined {
  const current = repository.getById(quoteId);
  if (!current) return undefined;
  // ACCEPTED / REJECTED are customer reactions, not internal approval decisions.
  assertRuntimeCommandAccess(CAPABILITIES.QUOTES_UPDATE, "quotes", current);
  if (!canTransitionQuoteStatus(current.status, status)) {
    throw new Error(`Quote status transition ${current.status} -> ${status} is not allowed.`);
  }
  if ([QuoteStatus.REVIEW, QuoteStatus.SENT, QuoteStatus.ACCEPTED].includes(status) && isQuotePastValidity(current, now)) {
    throw new Error("Quote validity has expired. Create a revision with current commercial terms instead.");
  }
  if (status === QuoteStatus.SENT && !canQuoteBeSent(current)) {
    throw new Error("Quote requires a current internal approval before it can be sent.");
  }
  return updateQuote(repository, quoteId, (quote) => ({
    ...quote,
    status,
    updatedAt: now,
    reviewRequestedAt: status === QuoteStatus.REVIEW ? now : quote.reviewRequestedAt,
    sentAt: status === QuoteStatus.SENT ? now : quote.sentAt,
    acceptedAt: status === QuoteStatus.ACCEPTED ? now : quote.acceptedAt,
    rejectedAt: status === QuoteStatus.REJECTED ? now : quote.rejectedAt,
    expiredAt: status === QuoteStatus.EXPIRED ? now : quote.expiredAt,
  }));
}

export function requestQuoteApproval(
  repository: QuoteRepository,
  quoteId: string,
  input: { actorId: string; now?: string },
): Quote | undefined {
  const current = repository.getById(quoteId);
  if (!current) return undefined;
  assertRuntimeCommandAccess(CAPABILITIES.QUOTES_UPDATE, "quotes", current);
  if (!current.approvalRequired) throw new Error("Quote does not require internal approval.");
  if (current.status !== QuoteStatus.DRAFT && current.status !== QuoteStatus.REVIEW) throw new Error("Only mutable Quote versions can request approval.");
  const now = input.now ?? currentDateTime();
  return updateQuote(repository, quoteId, (quote) => ({
    ...quote,
    status: QuoteStatus.DRAFT,
    approvalStatus: QuoteApprovalStatus.PENDING,
    approvalRequestedAt: now,
    approvalRequestedBy: input.actorId,
    approvalContentFingerprint: quoteContentFingerprint(quote),
    approvalDecisionNote: undefined,
    updatedAt: now,
  }));
}

export function approveQuote(
  repository: QuoteRepository,
  quoteId: string,
  input: { actorId: string; note?: string; now?: string },
): Quote | undefined {
  const current = repository.getById(quoteId);
  if (!current) return undefined;
  assertRuntimeCommandAccess(CAPABILITIES.QUOTES_APPROVE, "quotes", current);
  if (!current.approvalRequired) throw new Error("Quote does not require approval.");
  if (current.approvalStatus !== QuoteApprovalStatus.PENDING) throw new Error("Quote approval is not pending.");
  const now = input.now ?? currentDateTime();
  return updateQuote(repository, quoteId, (quote) => ({
    ...quote,
    approvalStatus: QuoteApprovalStatus.APPROVED,
    approvedAt: now,
    approvedBy: input.actorId,
    approvalDecisionNote: input.note,
    approvalContentFingerprint: quoteContentFingerprint(quote),
    updatedAt: now,
  }));
}

export function requestQuoteApprovalChanges(
  repository: QuoteRepository,
  quoteId: string,
  input: { actorId: string; note: string; now?: string },
): Quote | undefined {
  const current = repository.getById(quoteId);
  if (!current) return undefined;
  assertRuntimeCommandAccess(CAPABILITIES.QUOTES_APPROVE, "quotes", current);
  if (current.approvalStatus !== QuoteApprovalStatus.PENDING) throw new Error("Quote approval is not pending.");
  const now = input.now ?? currentDateTime();
  return updateQuote(repository, quoteId, (quote) => ({
    ...quote,
    approvalStatus: QuoteApprovalStatus.CHANGES_REQUESTED,
    approvalDecisionNote: input.note,
    approvedAt: undefined,
    approvedBy: undefined,
    updatedAt: now,
  }));
}

export function recordQuoteDelivery(
  repository: QuoteRepository,
  quoteId: string,
  input: Omit<QuoteDeliveryRecord, "contentFingerprint"> & { now?: string },
): Quote | undefined {
  const current = repository.getById(quoteId);
  if (!current) return undefined;
  assertRuntimeCommandAccess(CAPABILITIES.QUOTES_UPDATE, "quotes", current);
  if (![QuoteStatus.DRAFT, QuoteStatus.REVIEW, QuoteStatus.SENT].includes(current.status)) {
    throw new Error("Only a Draft, Review, or Sent Quote can record customer delivery.");
  }
  if (current.status !== QuoteStatus.SENT && !canQuoteBeSent(current)) {
    throw new Error("Quote cannot be sent until the required approval is current.");
  }
  if (current.deliveryHistory?.some((record) => record.id === input.id)) return current;
  const emailChannel = input.channel === "GMAIL" || input.channel === "EMAIL";
  if (emailChannel && !/^\S+@\S+\.\S+$/.test(input.recipientEmail?.trim() ?? "")) {
    throw new Error("Email delivery requires a valid recipient email.");
  }
  if (!emailChannel && input.channel !== "PDF" && !input.recipient?.trim()) {
    throw new Error("Non-email delivery requires a recipient or destination.");
  }
  const sentAt = input.now ?? input.sentAt ?? currentDateTime();
  if (Number.isNaN(new Date(sentAt).getTime())) throw new Error("Quote delivery requires a valid sent time.");
  return updateQuote(repository, quoteId, (quote) => ({
    ...quote,
    status: QuoteStatus.SENT,
    sentAt: quote.sentAt ?? sentAt,
    updatedAt: sentAt,
    recipientEmail: input.recipientEmail ?? quote.recipientEmail,
    deliveryHistory: [
      ...(quote.deliveryHistory ?? []),
      {
        id: input.id,
        channel: input.channel,
        recipientEmail: input.recipientEmail,
        recipient: input.recipient?.trim() || undefined,
        note: input.note?.trim() || undefined,
        sentAt,
        sentBy: input.sentBy,
        fileName: input.fileName,
        contentFingerprint: quoteContentFingerprint(quote),
      },
    ],
  }));
}

export function reviseQuote(
  repository: QuoteRepository,
  quoteId: string,
  now = currentDateTime(),
  idFactory: () => string = () => createDurableId("q_rev"),
): Quote | undefined {
  const source = repository.getById(quoteId);
  if (!source) return undefined;
  assertRuntimeCommandAccess(CAPABILITIES.QUOTES_CREATE, "quotes", source);
  if (source.status === QuoteStatus.DRAFT || source.status === QuoteStatus.REVIEW) {
    throw new Error("Draft or Review Quote should be edited directly; revision is for immutable versions.");
  }
  const revision: Quote = {
    ...source,
    id: idFactory(),
    version: source.version + 1,
    rootQuoteId: source.rootQuoteId || source.id,
    revisionOfQuoteId: source.id,
    status: QuoteStatus.DRAFT,
    createdAt: now,
    updatedAt: now,
    reviewRequestedAt: undefined,
    sentAt: undefined,
    acceptedAt: undefined,
    rejectedAt: undefined,
    expiredAt: undefined,
    approvalStatus: undefined,
    approvalRequired: undefined,
    approvalReasons: undefined,
    approvalRequestedAt: undefined,
    approvalRequestedBy: undefined,
    approvedAt: undefined,
    approvedBy: undefined,
    approvalDecisionNote: undefined,
    approvalContentFingerprint: undefined,
    deliveryHistory: [],
  };
  return saveQuote(repository, revision);
}

export function duplicateQuote(repository: QuoteRepository, quoteId: string, title: string, now = currentDateTime()): Quote | undefined {
  const source = repository.getById(quoteId);
  if (!source) return undefined;
  assertRuntimeCommandAccess(CAPABILITIES.QUOTES_CREATE, "quotes", source);
  const identity = allocateQuoteIdentity(repository, now);
  const quote: Quote = {
    ...source,
    id: identity.id,
    quoteNumber: identity.quoteNumber,
    version: 1,
    rootQuoteId: identity.id,
    revisionOfQuoteId: undefined,
    title,
    status: QuoteStatus.DRAFT,
    createdAt: now,
    updatedAt: now,
    reviewRequestedAt: undefined,
    sentAt: undefined,
    acceptedAt: undefined,
    rejectedAt: undefined,
    expiredAt: undefined,
    approvalStatus: undefined,
    approvalRequired: undefined,
    approvalReasons: undefined,
    approvalRequestedAt: undefined,
    approvalRequestedBy: undefined,
    approvedAt: undefined,
    approvedBy: undefined,
    approvalDecisionNote: undefined,
    approvalContentFingerprint: undefined,
    deliveryHistory: [],
  };
  return saveQuote(repository, quote);
}

function currentDateTime(): string {
  return new Date().toISOString();
}
