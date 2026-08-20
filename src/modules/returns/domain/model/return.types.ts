import type { BuyerRef } from "@/platform/identity";
import type { MoneyDto } from "@/shared/money";

export type ReturnStatus = "REQUESTED" | "APPROVED" | "AWAITING_ITEM" | "RECEIVED" | "RESOLVED" | "CLOSED" | "REJECTED";
export type ReturnReason = "DEFECTIVE" | "WRONG_ITEM" | "DAMAGED" | "NOT_AS_DESCRIBED" | "CUSTOMER_CHANGED_MIND" | "OTHER";
export type RequestedReturnResolution = "REFUND" | "REPLACEMENT" | "EXCHANGE" | "REPAIR";
export type ReturnMethod = "CARRIER_PICKUP" | "CUSTOMER_SELF_SHIP" | "DROP_OFF" | "NO_PHYSICAL_RETURN";
export type ReturnItemDisposition = "RESTOCK" | "QUARANTINE" | "SCRAP" | "RETURN_TO_SUPPLIER" | "RETURN_TO_CUSTOMER";

export interface ReturnItem {
  orderLineId: string;
  productId: string;
  productNameSnapshot: string;
  orderedQuantity: number;
  previouslyAcceptedReturnQuantity: number;
  requestedQuantity: number;
  approvedQuantity?: number;
  approvalReason?: string;
  receivedQuantity?: number;
  acceptedQuantity?: number;
  rejectedQuantity?: number;
  condition?: string;
  disposition?: ReturnItemDisposition;
  inspectionNote?: string;
  evidenceRefs?: string[];
}
export interface ReturnEligibilityResult { eligible: boolean; reasonCode: string; explanation: string; evaluatedAt: string; }
export interface ReturnDecision { outcome: "APPROVED" | "REJECTED"; reason: string; decidedAt: string; decidedBy: string; override?: boolean; overrideReason?: string; }
export interface ManualDeliveryEvidence { deliveredAt: string; source: "MANUAL"; reason: string; actorId: string; actorName?: string; createdAt: string; evidenceRef: string; }
export interface ReturnMethodDetails { method: ReturnMethod; configuredAt: string; configuredBy: string; carrier?: string; trackingCode?: string; dropOffLocation?: string; returnByDate?: string; }
export interface ReturnInspection { inspectedAt: string; inspectedBy: string; note: string; }
export interface RepairJob { reference: string; provider?: string; receivedAt?: string; expectedCompletionAt?: string; status: "CREATED" | "IN_PROGRESS" | "COMPLETED" | "FAILED"; result?: string; }
export type ReturnResolution =
  | { type: "REFUND"; creditNoteIds: string[]; refundIntentId?: string; refundIntentIds?: string[]; refundPaymentRecordIds?: string[]; refundTransactionId?: string; refundTransactionIds?: string[]; creditedAmount: MoneyDto; refundedAmount: MoneyDto }
  | { type: "REPLACEMENT"; replacementLines: Array<{ productId: string; productNameSnapshot: string; quantity: number }>; shippingBookingId?: string }
  | { type: "EXCHANGE"; exchangeLines: Array<{ productId: string; productNameSnapshot: string; quantity: number }>; commercialDelta?: number; currency?: string; commercialAdjustmentNote?: string; paymentIntentId?: string; shippingBookingId?: string; creditNoteIds?: string[]; refundIntentIds?: string[]; refundPaymentRecordIds?: string[]; creditedAmount?: MoneyDto; refundedAmount?: MoneyDto }
  | { type: "REPAIR"; repairJob: RepairJob; returnShippingBookingId?: string }
  | { type: "REJECT_AFTER_INSPECTION"; reason: string; evidenceRefs?: string[]; returnToCustomerShippingBookingId?: string };
export type ReturnIntentTarget = "INVOICE" | "PAYMENT" | "SHIPPING" | "REPAIR";
export type ReturnIntentStatus = "PENDING" | "SUCCEEDED" | "FAILED";
export type ReturnIntentAction = "CREDIT_NOTE" | "REFUND" | "COLLECT_EXCHANGE_DELTA" | "RETURN_PICKUP" | "REPLACEMENT_OUTBOUND" | "RETURN_TO_CUSTOMER" | "REPAIR";
export interface ReturnResolutionIntent { id: string; workspaceId: string; returnId: string; target: ReturnIntentTarget; action: ReturnIntentAction; payload: Record<string, unknown>; status: ReturnIntentStatus; idempotencyKey: string; correlationId: string; createdAt: string; completedAt?: string; externalReference?: string; externalReferences?: string[]; failureReason?: string; }
export interface ReturnRequest {
  id: string;
  workspaceId?: string;
  code: string;
  orderId: string;
  buyerRef: BuyerRef;
  ownerId: string;
  items: ReturnItem[];
  reason: ReturnReason;
  requestedResolution: RequestedReturnResolution;
  note?: string;
  status: ReturnStatus;
  deliveredAt?: string;
  deliveryEvidenceShippingBookingId?: string;
  manualDeliveryEvidence?: ManualDeliveryEvidence;
  returnMethod?: ReturnMethodDetails;
  returnPickupShippingBookingId?: string;
  requestedAt: string;
  eligibilityResult: ReturnEligibilityResult;
  decision?: ReturnDecision;
  receivedAt?: string;
  receivedBy?: string;
  receiveConditionNote?: string;
  inspection?: ReturnInspection;
  resolution?: ReturnResolution;
  resolvedAt?: string;
  closedAt?: string;
  correlationId?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}
export interface ReturnSnapshot { requests: ReturnRequest[]; intents: ReturnResolutionIntent[]; }
