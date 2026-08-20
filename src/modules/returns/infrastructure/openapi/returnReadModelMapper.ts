import type { ReturnReadModel, ReturnResolutionInput } from "@/platform/api/generated/commercialApi";
import { ApiClientError } from "@/platform/api";
import type { RepairJob, ReturnEligibilityResult, ReturnRequest } from "../../domain/model/return.types";

export function mapReturnReadModelToApplication(dto: ReturnReadModel): ReturnRequest {
  return {
    id: dto.id,
    code: dto.code,
    orderId: dto.orderId,
    buyerRef: dto.buyerRef,
    ownerId: dto.ownerId,
    items: dto.items.map((item) => ({
      orderLineId: item.orderLineId,
      productId: item.productId,
      productNameSnapshot: item.productName,
      orderedQuantity: item.orderedQuantity,
      previouslyAcceptedReturnQuantity: item.previouslyAcceptedReturnQuantity,
      requestedQuantity: item.requestedQuantity,
      approvedQuantity: item.approvedQuantity,
      approvalReason: item.approvalReason,
      receivedQuantity: item.receivedQuantity,
      acceptedQuantity: item.acceptedQuantity,
      rejectedQuantity: item.rejectedQuantity,
      condition: item.condition,
      disposition: item.disposition,
      inspectionNote: item.inspectionNote,
      evidenceRefs: item.evidenceRefs,
    })),
    reason: dto.reason,
    requestedResolution: dto.requestedResolution,
    note: dto.note,
    status: dto.status,
    deliveredAt: dto.deliveredAt,
    deliveryEvidenceShippingBookingId: dto.deliveryEvidenceShippingBookingId,
    decision: dto.decision,
    returnMethod: dto.returnMethod,
    returnPickupShippingBookingId: dto.returnPickupShippingBookingId,
    requestedAt: dto.requestedAt,
    eligibilityResult: mapEligibility(dto.eligibility),
    receivedAt: dto.receivedAt,
    receivedBy: dto.receivedBy,
    receiveConditionNote: dto.receiveConditionNote,
    inspection: dto.inspection,
    resolution: mapResolution(dto.resolution),
    resolvedAt: dto.resolvedAt,
    closedAt: dto.closedAt,
    correlationId: dto.correlationId,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    version: dto.resourceVersion,
  };
}

function mapResolution(value: ReturnResolutionInput | undefined): ReturnRequest["resolution"] {
  if (!value) return undefined;
  if (value.type === "REFUND" && value.creditedAmount && value.refundedAmount) {
    return {
      type: "REFUND",
      creditNoteIds: value.creditNoteIds ?? [],
      refundIntentId: value.refundIntentId,
      refundIntentIds: value.refundIntentIds,
      refundPaymentRecordIds: value.refundPaymentRecordIds,
      refundTransactionId: value.refundTransactionId,
      refundTransactionIds: value.refundTransactionIds,
      creditedAmount: value.creditedAmount,
      refundedAmount: value.refundedAmount,
    };
  }
  if (value.type === "REPLACEMENT") {
    return {
      type: "REPLACEMENT",
      replacementLines: (value.replacementLines ?? []).map((line) => ({
        productId: line.productId,
        productNameSnapshot: line.productName,
        quantity: line.quantity,
      })),
      shippingBookingId: value.shippingBookingId,
    };
  }
  if (value.type === "EXCHANGE") {
    return {
      type: "EXCHANGE",
      exchangeLines: (value.exchangeLines ?? []).map((line) => ({
        productId: line.productId,
        productNameSnapshot: line.productName,
        quantity: line.quantity,
      })),
      commercialDelta: value.commercialDelta === undefined ? undefined : Number(value.commercialDelta.amount),
      currency: value.commercialDelta?.currency,
      commercialAdjustmentNote: value.commercialAdjustmentNote,
      paymentIntentId: value.paymentIntentId,
      shippingBookingId: value.shippingBookingId,
      creditNoteIds: value.creditNoteIds,
      refundIntentIds: value.refundIntentIds,
      refundPaymentRecordIds: value.refundPaymentRecordIds,
      creditedAmount: value.creditedAmount,
      refundedAmount: value.refundedAmount,
    };
  }
  if (value.type === "REPAIR") {
    const repairJob = mapRepairJob(value.repairJob);
    if (repairJob) return { type: "REPAIR", repairJob, returnShippingBookingId: value.returnShippingBookingId };
  }
  if (value.type === "REJECT_AFTER_INSPECTION" && value.reason) {
    return {
      type: "REJECT_AFTER_INSPECTION",
      reason: value.reason,
      evidenceRefs: value.evidenceRefs,
      returnToCustomerShippingBookingId: value.returnToCustomerShippingBookingId,
    };
  }
  throw new ApiClientError({
    code: "CONNECTED_QUERY_CONTRACT_VIOLATION",
    message: "Return resolution projection is incomplete.",
    retryable: false,
    details: { operationId: "getReturn/listReturns", authority: "docs/api/openapi.json" },
  });
}

function mapRepairJob(value: Record<string, unknown> | undefined): RepairJob | undefined {
  if (
    !value
    || typeof value.reference !== "string"
    || !["CREATED", "IN_PROGRESS", "COMPLETED", "FAILED"].includes(String(value.status))
  ) return undefined;
  return {
    reference: value.reference,
    status: value.status as RepairJob["status"],
    ...(typeof value.provider === "string" ? { provider: value.provider } : {}),
    ...(typeof value.receivedAt === "string" ? { receivedAt: value.receivedAt } : {}),
    ...(typeof value.expectedCompletionAt === "string" ? { expectedCompletionAt: value.expectedCompletionAt } : {}),
    ...(typeof value.result === "string" ? { result: value.result } : {}),
  };
}

function mapEligibility(value: Record<string, unknown>): ReturnEligibilityResult {
  if (typeof value.eligible !== "boolean" || typeof value.reasonCode !== "string" || typeof value.evaluatedAt !== "string") {
    throw new ApiClientError({
      code: "CONNECTED_QUERY_CONTRACT_VIOLATION",
      message: "Return eligibility projection is incomplete.",
      retryable: false,
      details: { operationId: "getReturn/listReturns", authority: "docs/api/openapi.json" },
    });
  }
  return {
    eligible: value.eligible,
    reasonCode: value.reasonCode,
    explanation: typeof value.explanation === "string" ? value.explanation : "",
    evaluatedAt: value.evaluatedAt,
  };
}
