import type { CustomerCredit, InvoicePaymentAllocation, PaymentIntent, PaymentMethodCatalogItem, PaymentProviderCatalogItem, PaymentRecord, PaymentRequestDelivery, RefundIntent, RefundProviderAttempt } from "../../domain/model/paymentCollection.types";
import type { PaymentPlan, PaymentPlanPreview, PaymentScheduleLine } from "../../domain/model/paymentPlan.types";
import type { SavePaymentPlanDraftCommand } from "../commands/paymentPlanCommands";
import type { AllocatePaymentCommand, RecordManualPaymentCommand } from "../commands/paymentAllocationCommands";
import type { CreatePaymentIntentCommand, RetryPaymentIntentCommand } from "../commands/paymentIntentCommands";
import type { CreateRefundIntentCommand } from "../commands/paymentRefundCommands";
import type { RequestRefundCancellationCommand, RetryRefundIntentCommand } from "../commands/refundRecoveryCommands";
import type { ReconcilePaymentRecordCommand } from "../commands/paymentRecordCommands";
import type { PaymentRecordDetailDto } from "../queries/paymentRecordDetail";

/**
 * Authoritative evidence returned by a dedicated Payment mutation.
 *
 * Mirrors `DealMutationEvidence`. The connected HTTP adapter fills every field from
 * the backend mutation response envelope; the demo adapter marks itself
 * `authority: "demo"`. Named `...CommandResult` because the generated OpenAPI client
 * already exports `ManualPaymentMutationResult` for the wire payload.
 */
export interface PaymentMutationEvidence {
  authority: "backend" | "demo" | "test";
  commandId: string;
  correlationId: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  occurredAt: string;
  outcome: "COMMITTED" | "REPLAYED" | "DEMO_COMMITTED";
  warnings: readonly string[];
  emittedEventIds: readonly string[];
  auditEvidenceIds: readonly string[];
}

export interface ManualPaymentCommandResult {
  payment: PaymentRecord;
  customerCredit?: CustomerCredit;
  evidence: PaymentMutationEvidence;
}

export interface PaymentRequestDeliveryCommandResult {
  intent: PaymentIntent;
  evidence: PaymentMutationEvidence;
}

export interface RecordPaymentRequestDeliveryInput {
  expectedVersion: number;
  idempotencyKey: string;
  channel: PaymentRequestDelivery["channel"];
  recipient?: string;
  templateKey: string;
  renderedContent?: string;
}

export interface PaymentApiPort {
  getMethodCatalog(signal?: AbortSignal): Promise<{ methods: PaymentMethodCatalogItem[]; providers: PaymentProviderCatalogItem[] }>;
  listPlans(orderId?: string, signal?: AbortSignal): Promise<PaymentPlan[]>;
  listScheduleLines(planId?: string, signal?: AbortSignal): Promise<PaymentScheduleLine[]>;
  listIntents(orderId?: string, signal?: AbortSignal): Promise<PaymentIntent[]>;
  listPaymentRecords(buyerId?: string, signal?: AbortSignal): Promise<PaymentRecord[]>;
  getPaymentRecordDetail(paymentRecordId: string, signal?: AbortSignal): Promise<PaymentRecordDetailDto>;
  listRefundIntents(orderId?: string, signal?: AbortSignal): Promise<RefundIntent[]>;
  listCustomerCredits(buyerId?: string, signal?: AbortSignal): Promise<CustomerCredit[]>;
  listAllocations(invoiceId?: string, signal?: AbortSignal): Promise<InvoicePaymentAllocation[]>;
  previewPlan(command: SavePaymentPlanDraftCommand, signal?: AbortSignal): Promise<PaymentPlanPreview>;
  savePlanDraft(command: SavePaymentPlanDraftCommand, signal?: AbortSignal): Promise<PaymentPlan>;
  activatePlan(planId: string, expectedVersion: number, signal?: AbortSignal): Promise<PaymentPlan>;
  cancelPlan(planId: string, input: { expectedVersion: number; reason: string }, signal?: AbortSignal): Promise<PaymentPlan>;
  createIntent(command: CreatePaymentIntentCommand, signal?: AbortSignal): Promise<PaymentIntent>;
  getIntent(intentId: string, signal?: AbortSignal): Promise<PaymentIntent>;
  getIntentStatus(intentId: string, signal?: AbortSignal): Promise<PaymentIntent>;
  cancelIntent(intentId: string, expectedVersion: number, signal?: AbortSignal): Promise<PaymentIntent>;
  retryIntent(intentId: string, command: RetryPaymentIntentCommand, signal?: AbortSignal): Promise<PaymentIntent>;
  // DEDICATED_MODULE_HTTP_ADAPTER in the canonical command registry: never routed
  // through RoutedHttpMutationAuthority, so it carries backend evidence itself.
  recordManualPayment(command: RecordManualPaymentCommand, signal?: AbortSignal): Promise<ManualPaymentCommandResult>;
  allocate(command: AllocatePaymentCommand, signal?: AbortSignal): Promise<{ allocations: InvoicePaymentAllocation[]; remainingAmount: { amount: string; currency: string } }>;
  reverseAllocation(allocationId: string, input: { expectedVersion: number; reasonCode?: string; reason?: string; actorId?: string }, signal?: AbortSignal): Promise<InvoicePaymentAllocation>;
  reconcilePaymentRecord(paymentRecordId: string, command: ReconcilePaymentRecordCommand, signal?: AbortSignal): Promise<PaymentRecord>;
  recordCodCustomerCollection(paymentRecordId: string, input: { expectedVersion: number; state: PaymentRecord["codCustomerCollectionState"]; evidenceMetadata?: Record<string, string>; now: string }, signal?: AbortSignal): Promise<PaymentRecord>;
  recordCodMerchantRemittance(paymentRecordId: string, input: { expectedVersion: number; state: PaymentRecord["codMerchantRemittanceState"]; evidenceMetadata?: Record<string, string>; now: string }, signal?: AbortSignal): Promise<PaymentRecord>;
  // DEDICATED_MODULE_HTTP_ADAPTER, as above.
  recordPaymentRequestDelivery(intentId: string, command: RecordPaymentRequestDeliveryInput, signal?: AbortSignal): Promise<PaymentRequestDeliveryCommandResult>;
  createRefundIntent(command: CreateRefundIntentCommand, signal?: AbortSignal): Promise<RefundIntent>;
  getRefund(refundIntentId: string, signal?: AbortSignal): Promise<RefundIntent>;
  listRefundProviderAttempts(refundIntentId: string, signal?: AbortSignal): Promise<RefundProviderAttempt[]>;
  requestRefundCancellation(refundIntentId: string, command: RequestRefundCancellationCommand, signal?: AbortSignal): Promise<{ refundIntent: RefundIntent; providerAttempt: RefundProviderAttempt }>;
  retryRefund(refundIntentId: string, command: RetryRefundIntentCommand, signal?: AbortSignal): Promise<{ refundIntent: RefundIntent; providerAttempt: RefundProviderAttempt }>;
}
