import { QuoteStatus, type Quote } from "../../domain/model/quote.types";
import { isQuoteVersionImmutable } from "../../domain/rules/quoteVersioning";
import { isQuotePastValidity } from "../../domain/rules/quoteConversion";

export const QUOTE_ACTION_IDS = [
  "view",
  "edit",
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
  draftCoreOnly?: boolean;
  /** @deprecated Historical caller compatibility; never gates active actions. */
  approvalCommandsReady?: boolean;
  deliveryCommandsReady?: boolean;
  canUpdate: boolean;
  /** @deprecated Historical caller compatibility; no internal approval action is exposed. */
  canApprove: boolean;
  canCreate: boolean;
  canDelete: boolean;
  canCreateOrder: boolean;
}

export function resolveQuoteActionIds(
  quote: Pick<Quote, "ordinarySales" | "status" | "approvalRequired" | "approvalStatus" | "approvalRequestedAt" | "validUntil" | "expiryDate" | "archivedAt" | "validity">,
  permissions: QuoteActionPermissions,
): QuoteActionId[] {
  const actions: QuoteActionId[] = [];
  const mutable = !isQuoteVersionImmutable(quote.status);

  if (permissions.canView) actions.push("view", "export-pdf");
  if (quote.archivedAt) return actions;
  if (permissions.canUpdate && mutable) actions.push("edit");
  if (permissions.draftCoreOnly) {
    if (permissions.deliveryCommandsReady && permissions.canView && permissions.canUpdate
      && quote.validity?.state !== "OVERDUE" && quote.validity?.state !== "TIMEZONE_UNAVAILABLE"
      && (mutable || quote.status === QuoteStatus.SENT)) actions.push("send", "confirm-sent");
    return actions;
  }

  if (mutable) {
    if (permissions.canUpdate) actions.push("send", "confirm-sent");
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
  quote: Pick<Quote, "ordinarySales" | "status" | "approvalRequired" | "approvalStatus" | "approvalRequestedAt" | "validUntil" | "expiryDate" | "archivedAt" | "validity">,
  permissions: QuoteActionPermissions,
): QuoteActionId[] {
  return resolveQuoteActionIds(quote, permissions).filter(
    (actionId) => actionId !== "view" && actionId !== "optimize-price",
  );
}


/** Connected lifecycle visibility is an intersection of current access and Backend hints. */
export function resolveQuoteLifecycleAvailability(quote: Pick<Quote, "resourceVersion" | "archivedAt" | "authoritativeActions">,
  access: { canView: boolean; canCreate: boolean; canUpdate: boolean; canArchive: boolean }) {
  const usable = access.canView && !quote.archivedAt && Number.isSafeInteger(quote.resourceVersion) && (quote.resourceVersion ?? 0) >= 1;
  return {
    revise: usable && access.canCreate && quote.authoritativeActions?.revise?.allowed === true,
    expire: usable && access.canUpdate && quote.authoritativeActions?.expire?.allowed === true,
    archive: usable && access.canArchive && quote.authoritativeActions?.archive?.allowed === true,
  };
}
