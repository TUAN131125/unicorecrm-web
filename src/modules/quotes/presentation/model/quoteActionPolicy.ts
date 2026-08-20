import { QuoteApprovalStatus, QuoteStatus, type Quote } from "../../domain/model/quote.types";
import { isQuoteVersionImmutable } from "../../domain/rules/quoteVersioning";
import { isQuotePastValidity } from "../../domain/rules/quoteConversion";

export const QUOTE_ACTION_IDS = [
  "view",
  "edit",
  "request-approval",
  "approve",
  "request-changes",
  "send",
  "confirm-sent",
  "accept",
  "reject",
  "expire",
  "create-order",
  "revise",
  "duplicate",
  "optimize-price",
  "export-pdf",
  "delete",
] as const;

export type QuoteActionId = (typeof QUOTE_ACTION_IDS)[number];

export interface QuoteActionPermissions {
  canView: boolean;
  canUpdate: boolean;
  canApprove: boolean;
  canCreate: boolean;
  canDelete: boolean;
  canCreateOrder: boolean;
}

export function resolveQuoteActionIds(
  quote: Pick<Quote, "status" | "approvalRequired" | "approvalStatus" | "approvalRequestedAt" | "validUntil" | "expiryDate">,
  permissions: QuoteActionPermissions,
): QuoteActionId[] {
  const actions: QuoteActionId[] = [];
  const mutable = !isQuoteVersionImmutable(quote.status);
  const approvalPending = quote.approvalRequired
    && quote.approvalStatus === QuoteApprovalStatus.PENDING
    && Boolean(quote.approvalRequestedAt);
  const approvalSatisfied = !quote.approvalRequired || quote.approvalStatus === QuoteApprovalStatus.APPROVED;

  if (permissions.canView) actions.push("view", "export-pdf");
  if (permissions.canUpdate && mutable) actions.push("edit");

  if (mutable) {
    if (quote.approvalRequired) {
      if (approvalPending) {
        if (permissions.canApprove) actions.push("approve", "request-changes");
      } else if (!approvalSatisfied && permissions.canUpdate) {
        actions.push("request-approval");
      }
    }
    if (approvalSatisfied && permissions.canUpdate) actions.push("send", "confirm-sent");
  }

  if (quote.status === QuoteStatus.SENT && permissions.canUpdate) {
    actions.push("confirm-sent", "accept", "reject", "expire");
  }

  if (quote.status === QuoteStatus.ACCEPTED && permissions.canCreateOrder && !isQuotePastValidity(quote)) actions.push("create-order");
  if (permissions.canCreate && isQuoteVersionImmutable(quote.status)) actions.push("revise");
  if (permissions.canCreate) actions.push("duplicate");
  if (permissions.canView) actions.push("optimize-price");
  if (permissions.canDelete && mutable) actions.push("delete");

  return actions;
}

export function resolveQuoteHeaderActionIds(
  quote: Pick<Quote, "status" | "approvalRequired" | "approvalStatus" | "approvalRequestedAt" | "validUntil" | "expiryDate">,
  permissions: QuoteActionPermissions,
): QuoteActionId[] {
  return resolveQuoteActionIds(quote, permissions).filter(
    (actionId) => actionId !== "view" && actionId !== "optimize-price",
  );
}
