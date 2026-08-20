import type {
  CustomerCreditDocument,
  PaymentAllocationDocument,
  PaymentRecordDetailResponse,
  PaymentRecordDocument,
  RefundIntentDocument,
  RefundProviderAttemptDocument,
} from "@/platform/api/generated/financialApi";
import type {
  CustomerCredit,
  InvoicePaymentAllocation,
  PaymentRecord,
  RefundIntent,
  RefundProviderAttempt,
} from "../../domain/model/paymentCollection.types";
import type { PaymentRecordDetailDto } from "../../application/queries/paymentRecordDetail";

/**
 * Infrastructure-only mapping from authoritative OpenAPI projections into the
 * current frontend application model. It never calculates balances, status,
 * timestamps, versions or evidence and it never fabricates command metadata.
 */
export function projectPaymentRecord(document: PaymentRecordDocument): PaymentRecord {
  return {
    id: document.id,
    workspaceId: document.workspaceId,
    buyerRef: document.buyerRef,
    orderId: document.orderId,
    intentId: document.intentId,
    kind: document.kind,
    state: document.state,
    amount: document.amount,
    methodCode: document.methodCode,
    channel: document.channel,
    providerCode: document.providerCode,
    refundOfPaymentRecordId: document.refundOfPaymentRecordId,
    refundOfCustomerCreditId: document.refundOfCustomerCreditId,
    refundIntentId: document.refundIntentId,
    occurredAt: document.occurredAt,
    externalReference: document.externalReference,
    evidence: document.evidence,
    reconciliationState: document.reconciliationState,
    codCustomerCollectionState: document.codCustomerCollectionState,
    codMerchantRemittanceState: document.codMerchantRemittanceState,
    effectiveForReceivables: document.effectiveForReceivables,
    version: document.resourceVersion,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function projectPaymentAllocation(document: PaymentAllocationDocument): InvoicePaymentAllocation {
  return {
    id: document.id,
    workspaceId: document.workspaceId,
    buyerRef: document.buyerRef,
    invoiceId: document.invoiceId,
    ...(document.sourceType === "PAYMENT_RECORD" ? { paymentRecordId: document.sourceId } : { customerCreditId: document.sourceId }),
    scheduleLineId: document.scheduleLineId,
    amount: document.amount,
    state: document.state,
    version: document.resourceVersion,
    createdAt: document.createdAt,
    reversedAt: document.reversedAt,
    reversalReasonCode: document.reversalReasonCode,
    reversalReason: document.reversalReason,
  };
}

export function projectCustomerCredit(document: CustomerCreditDocument): CustomerCredit {
  return {
    id: document.id,
    workspaceId: document.workspaceId,
    buyerRef: document.buyerRef,
    sourcePaymentRecordId: document.sourcePaymentRecordId,
    originalAmount: document.originalAmount,
    availableAmount: document.availableAmount,
    state: document.state,
    version: document.resourceVersion,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function projectRefundIntent(document: RefundIntentDocument): RefundIntent {
  return {
    id: document.id,
    workspaceId: document.workspaceId,
    sourceReturnId: document.sourceReturnId,
    buyerRef: document.buyerRef,
    orderId: document.orderId,
    invoiceIds: document.invoiceIds ?? [],
    ...(document.source.type === "PAYMENT_RECORD" ? { paymentRecordId: document.source.id } : { customerCreditId: document.source.id }),
    amount: document.amount,
    state: document.state,
    refundPaymentRecordId: document.refundPaymentRecordId,
    providerCode: document.providerCode,
    latestProviderAttemptId: document.latestProviderAttemptId,
    reasonCode: document.reasonCode,
    reason: document.reason,
    version: document.resourceVersion,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    failureCode: document.failureCode,
  };
}

export function projectPaymentRecordDetail(document: PaymentRecordDetailResponse): PaymentRecordDetailDto {
  const record = projectPaymentRecord(document.record);
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    buyerRef: record.buyerRef,
    orderId: record.orderId,
    amount: record.amount,
    methodCode: record.methodCode,
    channelCode: record.channel,
    status: record.state,
    receivedAt: record.state === "SUCCEEDED" ? record.occurredAt : undefined,
    reference: record.externalReference,
    evidence: record.evidence ?? [],
    allocations: document.allocations.map(projectPaymentAllocation),
    customerCredits: document.customerCredits.map(projectCustomerCredit),
    refunds: document.refunds.map(projectRefundIntent),
    refundableAmount: document.refundableAmount,
    unallocatedAmount: document.unallocatedAmount,
    reconciliationState: record.reconciliationState,
    audit: [],
    version: record.version,
  };
}

export function projectRefundProviderAttempt(document: RefundProviderAttemptDocument): RefundProviderAttempt {
  return {
    id: document.id,
    workspaceId: document.workspaceId,
    refundIntentId: document.refundIntentId,
    providerCode: document.providerCode,
    sequenceNumber: document.sequenceNumber,
    state: document.state,
    retryOfAttemptId: document.retryOfAttemptId,
    providerReference: document.providerReference,
    failureCode: document.failureCode,
    cancellationReasonCode: document.cancellationReasonCode,
    cancellationReason: document.cancellationReason,
    cancellationRequestedAt: document.cancellationRequestedAt,
    cancellationAcknowledgedAt: document.cancellationAcknowledgedAt,
    submittedAt: document.submittedAt,
    completedAt: document.completedAt,
    version: document.resourceVersion,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}
