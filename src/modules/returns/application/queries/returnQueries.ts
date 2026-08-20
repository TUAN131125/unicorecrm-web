import type { ReturnRepository } from "../ports/ReturnRepository";
import type { ReturnRequest } from "../../domain/model/return.types";
const requestsOf = (source: ReturnRepository | readonly ReturnRequest[]) => "listRequests" in source ? source.listRequests() : [...source];

export function getReturnOperationalStage(item: ReturnRequest): string {
  if (item.status === "REQUESTED" && !item.eligibilityResult.eligible) return "INELIGIBLE_REVIEW";
  if (item.status === "REQUESTED") return "AWAITING_APPROVAL";
  if (item.status === "APPROVED" && !item.returnMethod) return "AWAITING_RETURN_METHOD";
  if (item.status === "AWAITING_ITEM" && item.items.some((line) => (line.receivedQuantity ?? 0) > 0)) return "PARTIALLY_RECEIVED";
  if (item.status === "AWAITING_ITEM") return "AWAITING_ITEM";
  if (item.status === "RECEIVED" && !item.inspection) return "AWAITING_INSPECTION";
  if (item.status === "RECEIVED") return "PENDING_RESOLUTION";
  return item.status;
}

export function queryReturns(source: ReturnRepository | readonly ReturnRequest[], input: { search?: string; view?: string; reason?: string; resolution?: string } = {}) {
  const search = input.search?.trim().toLowerCase() ?? "";
  const view = input.view ?? "ALL";
  return requestsOf(source).filter((item) => {
    const stage = getReturnOperationalStage(item);
    if (view !== "ALL" && stage !== view) {
      if (view === "COMPLETED" && !["RESOLVED", "CLOSED"].includes(item.status)) return false;
      else if (view !== "COMPLETED") return false;
    }
    if (input.reason && input.reason !== "ALL" && item.reason !== input.reason) return false;
    if (input.resolution && input.resolution !== "ALL" && item.requestedResolution !== input.resolution) return false;
    return !search || [item.code, item.orderId, item.reason, item.requestedResolution, item.ownerId, item.buyerRef.id].some((value) => String(value).toLowerCase().includes(search));
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getReturnStats(source: ReturnRepository | readonly ReturnRequest[]) {
  const items = requestsOf(source);
  return {
    total: items.length,
    requested: items.filter((item) => item.status === "REQUESTED").length,
    awaitingItem: items.filter((item) => ["APPROVED", "AWAITING_ITEM"].includes(item.status)).length,
    received: items.filter((item) => item.status === "RECEIVED").length,
    resolved: items.filter((item) => ["RESOLVED", "CLOSED"].includes(item.status)).length,
    rejected: items.filter((item) => item.status === "REJECTED").length,
    actionRequired: items.filter((item) => ["INELIGIBLE_REVIEW", "AWAITING_APPROVAL", "AWAITING_RETURN_METHOD", "AWAITING_INSPECTION", "PENDING_RESOLUTION"].includes(getReturnOperationalStage(item))).length,
  };
}
