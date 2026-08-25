import { assertMutationCommandSupported, isBusinessOperationUnavailable, createMutationMetadata, executeMutationCommand, isMutationCommandUnavailable, type MutationCommandMetadata, type MutationOutcome } from "@/shared/application";
import type { ManualPaymentCommandResult, PaymentMutationEvidence } from "../application/ports/PaymentApiPort";
import type { PaymentIntent } from "../domain/model/paymentCollection.types";
import { createDurableId } from "@/shared/ids";
import {
  recordFailedPayment,
  recordSucceededPayment,
  recordSucceededRefund,
  markCodRemitted,
  reconcilePayment,
  retryFailedPayment,
  savePaymentPlan,
} from "../application/commands/paymentCommands";
import {
  evaluatePaymentBookingReadiness,
  evaluatePaymentCompletionReadiness,
  getCodCollectibleAmountForOrder,
  getRefundablePaymentTransactionsForOrder,
  getPaymentObligations,
  getPaymentObligationsForOrder,
  getTransactionsForOrder,
  isCodCollectibleObligation,
  projectPaymentSummary,
  queryPaymentTransactions,
} from "../application/queries/paymentQueries";
import { paymentApi, paymentConfiguration, paymentRepository, paymentVerticalSlice } from "../application/composition/paymentApplicationServices";
import {
  getActivePaymentPlanForOrder,
  getCustomerCredits,
  getEffectiveAllocationsForInvoice,
  getPaymentIntents,
  getPaymentMethodCatalog,
  getPaymentPlansForOrder,
  getPaymentRecords,
  getRefundIntents,
  getRefundablePaymentRecordsForOrder,
  getPaymentRecordAvailableAmount,
  getScheduleLinesForPlan,
  evaluatePaymentFulfillmentGate,
  getCodCollectibleFromActivePlan,
} from "../application/queries/paymentPlanQueries";
import { activatePaymentPlan, cancelPaymentPlan, evaluateScheduleGate, savePaymentPlanDraft, supersedePaymentPlan } from "../application/commands/paymentPlanCommands";
import { cancelPaymentIntent, createPaymentIntent, retryPaymentIntent, applyAuthoritativePaymentIntentSnapshot } from "../application/commands/paymentIntentCommands";
import { allocatePaymentToInvoices, recordManualPayment, reverseInvoiceAllocation } from "../application/commands/paymentAllocationCommands";
import { getPaymentRecordDetail } from "../application/queries/paymentRecordDetail";
import { recordPaymentRequestDelivery } from "../application/commands/paymentRequestCommunicationCommands";
import { reconcilePaymentRecord, type PaymentReconciliationInput } from "../application/commands/paymentRecordCommands";
import { getOperationalAuditSnapshot } from "@/platform/operational-audit";
import { recordCodCustomerCollectionEvidence, recordCodMerchantRemittanceEvidence } from "../application/commands/paymentCodCommands";
export type {
  CodCollectionState,
  PaymentAllocation,
  PaymentCompletionReadiness,
  PaymentDueRule,
  PaymentDueRuleType,
  PaymentFulfillmentGate,
  PaymentMethod,
  PaymentObligation,
  PaymentObligationStatus,
  PaymentPlanType,
  PaymentPurpose,
  PaymentTerm,
  PaymentTiming,
  PaymentMigrationReview,
  PaymentReconciliationState,
  PaymentSummary,
  PaymentSummaryState,
  PaymentTransaction,
  PaymentTransactionKind,
  PaymentTransactionStatus,
} from "../domain/model/payment.types";
import { getEffectivePaymentMethodCatalog } from "../application/queries/effectivePaymentMethodCatalog";
import type { PaymentRepositorySnapshot } from "../application/ports/PaymentRepository";
export type { PaymentRepositorySnapshot } from "../application/ports/PaymentRepository";
export type { ManualPaymentCommandResult, PaymentApiPort, PaymentMutationEvidence, PaymentRequestDeliveryCommandResult } from "../application/ports/PaymentApiPort";
export type { PaymentPlan, PaymentPlanPreview, PaymentPlanState, PaymentScheduleLine, PaymentScheduleLineState, PaymentAgreementSnapshot, PaymentAgreementLineSnapshot, PaymentDueRule as PaymentPlanDueRule } from "../domain/model/paymentPlan.types";
export type { PaymentRecordDetailDto } from "../application/queries/paymentRecordDetail";
export type { CustomerCredit, CustomerCreditState, InvoicePaymentAllocation, PaymentAllocationState, PaymentIntent, PaymentIntentState, PaymentRequestDelivery, PaymentMethodAvailability, PaymentMethodCatalogItem, PaymentMethodKind, PaymentProviderCatalogItem, PaymentRecord, PaymentRecordState, RefundIntent, RefundIntentState, RefundProviderAttempt, RefundProviderAttemptState } from "../domain/model/paymentCollection.types";
export { getPaymentObligations, getPaymentObligationsForOrder } from "../application/queries/paymentQueries";
export { PaymentValidationError } from "../domain/rules/paymentValidation";
export type { PaymentValidationDetails, PaymentValidationFieldErrors } from "../domain/rules/paymentValidation";
export const getPaymentsSnapshot = () => { const snapshot = paymentRepository.snapshot(); return { ...snapshot, methodCatalog: getEffectivePaymentMethodCatalog(snapshot.methodCatalog, paymentConfiguration.getSnapshot()) }; };
/**
 * True when payment configuration cannot be saved authoritatively. Only
 * `listPaymentReceivingAccounts` is READY; the receiving-account write is BLOCKED and no
 * endpoint owns the wider payment configuration.
 */
export function isPaymentConfigurationSaveUnavailable(): boolean {
  return isBusinessOperationUnavailable("Payment configuration save");
}

export const getPaymentConfigurationSnapshot = () => paymentConfiguration.getSnapshot();
export const savePaymentConfiguration = (value: Parameters<typeof paymentConfiguration.saveConfiguration>[0]) => paymentConfiguration.saveConfiguration(value);
export const saveReceivingAccounts = (accounts: Parameters<typeof paymentConfiguration.saveReceivingAccounts>[0]) => paymentConfiguration.saveReceivingAccounts(accounts);
export const subscribeToPaymentConfiguration = (listener: Parameters<typeof paymentConfiguration.subscribe>[0]) => paymentConfiguration.subscribe(listener);
export type { PaymentConfiguration, ReceivingAccount } from "../domain/model/paymentConfiguration.types";
export { buildLocalVietQrPayload, renderPaymentTransferContent } from "../domain/rules/paymentInstructions";
export const replacePaymentsSnapshot = (snapshot: PaymentRepositorySnapshot) => paymentRepository.replace(snapshot);
export const getPaymentObligationsSnapshot = () => getPaymentObligations(paymentRepository);
export const getPaymentObligationsForOrderSnapshot = (orderId: string) => getPaymentObligationsForOrder(paymentRepository, orderId);
export const getPaymentTransactionSnapshot = (transactionId: string) => paymentRepository.listTransactions().find((item) => item.id === transactionId);
export const subscribeToPayments = (listener: Parameters<typeof paymentRepository.subscribe>[0]) => paymentRepository.subscribe(listener);
export const getPaymentTransactionsForOrder = (orderId: string) => getTransactionsForOrder(paymentRepository, orderId);
export const getPaymentSummaryForOrder = (orderId: string, orderTotal: number, currency = "VND") => projectPaymentSummary(paymentRepository, orderId, orderTotal, currency);
export const getPaymentCompletionReadinessForOrder = (orderId: string) => evaluatePaymentCompletionReadiness(paymentRepository, orderId);
export const getPaymentBookingReadinessForOrder = (orderId: string) => evaluatePaymentBookingReadiness(paymentRepository, orderId);
export const getCodCollectibleAmountForOrderSnapshot = (orderId: string) => getCodCollectibleAmountForOrder(paymentRepository, orderId);
export const isCodCollectiblePaymentObligation = isCodCollectibleObligation;
export const getRefundablePaymentTransactionsForOrderSnapshot = (orderId: string) => getRefundablePaymentTransactionsForOrder(paymentRepository, orderId);
export const queryPaymentSnapshot = (input?: Parameters<typeof queryPaymentTransactions>[1]) => queryPaymentTransactions(paymentRepository, input);
export const projectPaymentSummaryFromSnapshot = projectPaymentSummary;
export const evaluatePaymentCompletionReadinessFromSnapshot = evaluatePaymentCompletionReadiness;
export const savePaymentPlanSnapshot = (command: Parameters<typeof savePaymentPlan>[1]) => savePaymentPlan(paymentRepository, command);
export const recordPayment = (command: Parameters<typeof recordSucceededPayment>[1]) => recordSucceededPayment(paymentRepository, command);
export const recordFailedPaymentAttempt = (command: Parameters<typeof recordFailedPayment>[1]) => recordFailedPayment(paymentRepository, command);
export const recordRefund = (command: Parameters<typeof recordSucceededRefund>[1]) => recordSucceededRefund(paymentRepository, command);
export const retryPayment = (failedTransactionId: string, command: Parameters<typeof retryFailedPayment>[2]) => retryFailedPayment(paymentRepository, failedTransactionId, command);
export const reconcilePaymentTransaction = (transactionId: string, input: Parameters<typeof reconcilePayment>[2]) => reconcilePayment(paymentRepository, transactionId, input);
export const markCodPaymentRemitted = (transactionId: string, input: Parameters<typeof markCodRemitted>[2]) => markCodRemitted(paymentRepository, transactionId, input);

export const evaluatePaymentFulfillmentGateSnapshot = (source: PaymentRepositorySnapshot, orderId: string, gate: Parameters<typeof evaluatePaymentFulfillmentGate>[2]) => evaluatePaymentFulfillmentGate(source, orderId, gate);
export const evaluatePaymentFulfillmentGateForOrder = (orderId: string, gate: Parameters<typeof evaluatePaymentFulfillmentGate>[2]) => evaluatePaymentFulfillmentGate(paymentRepository, orderId, gate);
export const getCodCollectibleFromActivePlanSnapshot = (orderId: string) => getCodCollectibleFromActivePlan(paymentRepository, orderId);
export const getPaymentPlansForOrderSnapshot = (orderId: string) => getPaymentPlansForOrder(paymentRepository, orderId);
export const getActivePaymentPlanForOrderSnapshot = (orderId: string) => getActivePaymentPlanForOrder(paymentRepository, orderId);
export const getPaymentScheduleLinesForPlanSnapshot = (planId: string) => getScheduleLinesForPlan(paymentRepository, planId);
export const getPaymentMethodCatalogSnapshot = (input?: Parameters<typeof getPaymentMethodCatalog>[1]) => getPaymentMethodCatalog(paymentRepository, input, paymentConfiguration.getSnapshot());
export const getPaymentIntentsSnapshot = (input?: Parameters<typeof getPaymentIntents>[1]) => getPaymentIntents(paymentRepository, input);
export const getPaymentRecordsSnapshot = (input?: Parameters<typeof getPaymentRecords>[1]) => getPaymentRecords(paymentRepository, input);
export const getRefundIntentsSnapshot = (input?: Parameters<typeof getRefundIntents>[1]) => getRefundIntents(paymentRepository, input);
export const getRefundablePaymentRecordsForOrderSnapshot = (orderId: string) => getRefundablePaymentRecordsForOrder(paymentRepository, orderId);
export const getPaymentRecordAvailableAmountSnapshot = (paymentRecordId: string) => getPaymentRecordAvailableAmount(paymentRepository, paymentRecordId);
export const getEffectiveAllocationsForInvoiceSnapshot = (invoiceId: string) => getEffectiveAllocationsForInvoice(paymentRepository, invoiceId);
export const getCustomerCreditsSnapshot = (buyerId?: string) => getCustomerCredits(paymentRepository, buyerId);
export const savePaymentPlanDraftSnapshot = (input: Parameters<typeof savePaymentPlanDraft>[1]) => savePaymentPlanDraft(paymentRepository, input, paymentConfiguration.getSnapshot());
export const activatePaymentPlanSnapshot = (planId: string, input: Parameters<typeof activatePaymentPlan>[2]) => activatePaymentPlan(paymentRepository, planId, input);
export const supersedePaymentPlanSnapshot = (planId: string, input: Parameters<typeof supersedePaymentPlan>[2]) => supersedePaymentPlan(paymentRepository, planId, input);
export const cancelPaymentPlanSnapshot = (planId: string, input: Parameters<typeof cancelPaymentPlan>[2]) => cancelPaymentPlan(paymentRepository, planId, input);
export const evaluatePaymentPlanGateSnapshot = (orderId: string, gate: Parameters<typeof evaluateScheduleGate>[2]) => evaluateScheduleGate(paymentRepository, orderId, gate);
export const createPaymentIntentSnapshot = (input: Parameters<typeof createPaymentIntent>[1]) => createPaymentIntent(paymentRepository, input, paymentConfiguration.getSnapshot());
export const cancelPaymentIntentSnapshot = (intentId: string, input: Parameters<typeof cancelPaymentIntent>[2]) => cancelPaymentIntent(paymentRepository, intentId, input);
export const retryPaymentIntentSnapshot = (intentId: string, input: Parameters<typeof retryPaymentIntent>[2]) => retryPaymentIntent(paymentRepository, intentId, input);
export const applyPaymentIntentProviderSnapshot = (snapshot: Parameters<typeof applyAuthoritativePaymentIntentSnapshot>[1]) => applyAuthoritativePaymentIntentSnapshot(paymentRepository, snapshot);
export const recordManualPaymentSnapshot = (input: Parameters<typeof recordManualPayment>[1]) => recordManualPayment(paymentRepository, input, paymentConfiguration.getSnapshot());
export const allocatePaymentToInvoicesSnapshot = (input: Parameters<typeof allocatePaymentToInvoices>[1]) => allocatePaymentToInvoices(paymentRepository, input, paymentConfiguration.getSnapshot());
export const reverseInvoiceAllocationSnapshot = (allocationId: string, input: Parameters<typeof reverseInvoiceAllocation>[2]) => reverseInvoiceAllocation(paymentRepository, allocationId, input);

export const getPaymentIntentAuthoritative = (intentId: string, signal?: AbortSignal) => paymentApi.getIntent(intentId, signal);
export const getPaymentIntentStatusAuthoritative = (intentId: string, signal?: AbortSignal) => paymentApi.getIntentStatus(intentId, signal);
export const createPaymentIntentAuthoritative = (input: Parameters<typeof paymentApi.createIntent>[0], signal?: AbortSignal) => paymentApi.createIntent(input, signal);
export const cancelPaymentIntentAuthoritative = (intentId: string, expectedVersion: number, signal?: AbortSignal) => paymentApi.cancelIntent(intentId, expectedVersion, signal);
export const retryPaymentIntentAuthoritative = (intentId: string, input: Parameters<typeof paymentApi.retryIntent>[1], signal?: AbortSignal) => paymentApi.retryIntent(intentId, input, signal);
export const createRefundIntentAuthoritative = (input: Parameters<typeof paymentApi.createRefundIntent>[0], signal?: AbortSignal) => paymentApi.createRefundIntent(input, signal);
export const listRefundProviderAttemptsAuthoritative = (refundIntentId: string, signal?: AbortSignal) => paymentApi.listRefundProviderAttempts(refundIntentId, signal);
export const getRefundAuthoritative = (refundIntentId: string, signal?: AbortSignal) => paymentApi.getRefund(refundIntentId, signal);

export const recordCodCustomerCollectionEvidenceSnapshot = (paymentRecordId: string, input: Parameters<typeof recordCodCustomerCollectionEvidence>[2]) => recordCodCustomerCollectionEvidence(paymentRepository, paymentRecordId, input, paymentConfiguration.getSnapshot());
export const recordCodMerchantRemittanceEvidenceSnapshot = (paymentRecordId: string, input: Parameters<typeof recordCodMerchantRemittanceEvidence>[2]) => recordCodMerchantRemittanceEvidence(paymentRepository, paymentRecordId, input, paymentConfiguration.getSnapshot());

export const getPaymentRecordDetailSnapshot = (paymentRecordId: string) => getPaymentRecordDetail(paymentRepository, paymentRecordId, getOperationalAuditSnapshot("payments", paymentRecordId));
export const recordPaymentRequestDeliverySnapshot = (intentId: string, command: Parameters<typeof recordPaymentRequestDelivery>[2]) => recordPaymentRequestDelivery(paymentRepository, intentId, command);

export const reconcilePaymentRecordSnapshot = (paymentRecordId: string, command: Parameters<typeof reconcilePaymentRecord>[2]) => reconcilePaymentRecord(paymentRepository, paymentRecordId, command);


export type { PaymentWorkspaceDto, PaymentVerticalSlice } from "../application/vertical-slice/paymentVerticalSlice";
export const getPaymentWorkspaceResource = () => paymentVerticalSlice.workspace;
export const getPaymentRecordDetailResource = (paymentRecordId: string) => paymentVerticalSlice.detail(paymentRecordId);
export const refreshPaymentWorkspace = () => paymentVerticalSlice.refreshAll();
/**
 * `payment.record-manual` and `payment.record-request-delivery` are
 * DEDICATED_MODULE_HTTP_ADAPTER in the canonical command registry, so the OpenAPI
 * generator deliberately keeps them out of PRODUCTION_COMMAND_CONTRACTS and
 * RoutedHttpMutationAuthority refuses them. They execute through the Payment
 * dedicated adapter and report the backend's own mutation evidence. Every other
 * Payment command here stays on the routed authority because it is a routed command.
 */
export const recordManualPaymentCanonical = async (input: Parameters<typeof paymentVerticalSlice.recordManualPayment>[0], signal?: AbortSignal): Promise<MutationOutcome<Omit<ManualPaymentCommandResult, "evidence">>> => {
  const options = createMutationMetadata(`payment.record-manual:${input.id}`, { idempotencyKey: input.idempotencyKey, signal });
  const { evidence, ...data } = await paymentVerticalSlice.recordManualPayment(input, signal);
  return paymentMutationOutcome("payment.record-manual", options, data, evidence);
};
export const createPaymentIntentCanonical = (input: Parameters<typeof paymentVerticalSlice.createIntent>[0], signal?: AbortSignal) => executeMutationCommand(
  { commandType: "payment.create-intent", aggregateType: "payment-intent", aggregateId: input.id, payload: input },
  createMutationMetadata(`payment.create-intent:${input.id}`, { idempotencyKey: input.idempotencyKey, signal }),
  () => paymentVerticalSlice.createIntent(input, signal),
);
export const cancelPaymentIntentCanonical = (intentId: string, expectedVersion: number, signal?: AbortSignal) => executeMutationCommand(
  { commandType: "payment.cancel-intent", aggregateType: "payment-intent", aggregateId: intentId, payload: { expectedVersion } },
  createMutationMetadata(`payment.cancel-intent:${intentId}`, { expectedVersion, signal }),
  () => paymentVerticalSlice.cancelIntent(intentId, expectedVersion, signal),
);
export const retryPaymentIntentCanonical = (intentId: string, input: Parameters<typeof paymentVerticalSlice.retryIntent>[1], signal?: AbortSignal) => executeMutationCommand(
  { commandType: "payment.retry-intent", aggregateType: "payment-intent", aggregateId: intentId, payload: input },
  createMutationMetadata(`payment.retry-intent:${intentId}`, { idempotencyKey: input.idempotencyKey, expectedVersion: input.expectedVersion, signal }),
  () => paymentVerticalSlice.retryIntent(intentId, input, signal),
);
/**
 * `payment.refresh-intent-status` is BLOCKED in the canonical registry, so it is absent from
 * `PRODUCTION_COMMAND_CONTRACTS` and cannot be carried by the routed authority. Connected mode
 * refuses here, before the mutation authority is entered; demo keeps its local executor.
 */
export function isPaymentIntentRefreshUnavailable(): boolean {
  return isMutationCommandUnavailable("payment.refresh-intent-status");
}

export const refreshPaymentIntentCanonical = (intentId: string, signal?: AbortSignal) => {
  assertMutationCommandSupported("payment.refresh-intent-status", "Payment intent status refresh");
  return executeMutationCommand(
    { commandType: "payment.refresh-intent-status", aggregateType: "payment-intent", aggregateId: intentId, payload: {} },
    createMutationMetadata(`payment.refresh-intent-status:${intentId}`, { signal }),
    () => paymentVerticalSlice.refreshIntentStatus(intentId, signal),
  );
};
function paymentAllocationBatchKey(input: Parameters<typeof paymentVerticalSlice.allocate>[0]): string {
  const sourceId = input.paymentRecordId ?? input.customerCreditId ?? "unknown";
  const targetFingerprint = input.allocations
    .map((item) => `${item.invoice.invoiceId}:${item.scheduleLineId ?? "-"}:${item.amount.amount}:${item.amount.currency}`)
    .sort()
    .join("|");
  return `payment.allocate:${sourceId}:${input.expectedSourceVersion}:${targetFingerprint}`;
}

export const allocatePaymentCanonical = (input: Parameters<typeof paymentVerticalSlice.allocate>[0], signal?: AbortSignal) => executeMutationCommand(
  { commandType: "payment.allocate", aggregateType: input.paymentRecordId ? "payment-record" : "customer-credit", aggregateId: input.paymentRecordId ?? input.customerCreditId ?? "unknown", payload: input },
  createMutationMetadata(`payment.allocate:${input.paymentRecordId ?? input.customerCreditId ?? "unknown"}`, { idempotencyKey: paymentAllocationBatchKey(input), expectedVersion: input.expectedSourceVersion, signal }),
  () => paymentVerticalSlice.allocate(input, signal),
);
export const reversePaymentAllocationCanonical = (allocationId: string, input: Parameters<typeof paymentVerticalSlice.reverseAllocation>[1], signal?: AbortSignal) => executeMutationCommand(
  { commandType: "payment.reverse-allocation", aggregateType: "payment-allocation", aggregateId: allocationId, payload: input },
  createMutationMetadata(`payment.reverse-allocation:${allocationId}`, { idempotencyKey: `payment.reverse-allocation:${allocationId}:${input.expectedVersion}`, expectedVersion: input.expectedVersion, signal }),
  () => paymentVerticalSlice.reverseAllocation(allocationId, input, signal),
);
export const createRefundIntentCanonical = (input: Parameters<typeof paymentVerticalSlice.createRefund>[0], signal?: AbortSignal) => executeMutationCommand(
  { commandType: "payment.create-refund", aggregateType: "refund-intent", aggregateId: input.id, payload: input },
  createMutationMetadata(`payment.create-refund:${input.id}`, { idempotencyKey: input.idempotencyKey, expectedVersion: input.expectedSourceVersion, signal }),
  () => paymentVerticalSlice.createRefund(input, signal),
);
export const requestRefundCancellationCanonical = (refundIntentId: string, input: Parameters<typeof paymentVerticalSlice.requestRefundCancellation>[1], signal?: AbortSignal) => executeMutationCommand(
  { commandType: "payment.request-refund-cancellation", aggregateType: "refund-intent", aggregateId: refundIntentId, payload: input },
  createMutationMetadata(`payment.request-refund-cancellation:${refundIntentId}`, { idempotencyKey: input.idempotencyKey, expectedVersion: input.expectedVersion, signal }),
  () => paymentVerticalSlice.requestRefundCancellation(refundIntentId, input, signal),
);
export const retryRefundIntentCanonical = (refundIntentId: string, input: Parameters<typeof paymentVerticalSlice.retryRefund>[1], signal?: AbortSignal) => executeMutationCommand(
  { commandType: "payment.retry-refund", aggregateType: "refund-intent", aggregateId: refundIntentId, payload: input },
  createMutationMetadata(`payment.retry-refund:${refundIntentId}`, { idempotencyKey: input.idempotencyKey, expectedVersion: input.expectedVersion, signal }),
  () => paymentVerticalSlice.retryRefund(refundIntentId, input, signal),
);
export const reconcilePaymentRecordCanonical = (paymentRecordId: string, input: PaymentReconciliationInput, signal?: AbortSignal) => executeMutationCommand(
  { commandType: "payment.reconcile-record", aggregateType: "payment-record", aggregateId: paymentRecordId, payload: input },
  createMutationMetadata(`payment.reconcile-record:${paymentRecordId}`, { expectedVersion: input.expectedVersion, signal }),
  async () => {
    const record = await paymentVerticalSlice.reconcileRecord(paymentRecordId, {
      ...input,
      actorId: "demo-local-runtime",
      actorName: "Demo local runtime",
      correlationId: createDurableId("payment_reconciliation"),
      now: new Date().toISOString(),
    }, signal);
    return {
      paymentRecordId: record.id,
      reconciliationState: record.reconciliationState === "MISMATCH" ? "MISMATCH" as const : "MATCHED" as const,
      version: record.version,
      reconciledAt: record.updatedAt,
    };
  },
);
export const recordCodCustomerCollectionCanonical = (paymentRecordId: string, input: Parameters<typeof paymentVerticalSlice.recordCodCustomerCollection>[1], signal?: AbortSignal) => executeMutationCommand(
  { commandType: "payment.record-cod-collection", aggregateType: "payment-record", aggregateId: paymentRecordId, payload: input },
  createMutationMetadata(`payment.record-cod-collection:${paymentRecordId}`, { idempotencyKey: `payment.cod.collection:${paymentRecordId}:${input.expectedVersion}:${input.state ?? "UNKNOWN"}`, expectedVersion: input.expectedVersion, signal }),
  () => paymentVerticalSlice.recordCodCustomerCollection(paymentRecordId, input, signal),
);
export const recordCodMerchantRemittanceCanonical = (paymentRecordId: string, input: Parameters<typeof paymentVerticalSlice.recordCodMerchantRemittance>[1], signal?: AbortSignal) => executeMutationCommand(
  { commandType: "payment.record-cod-remittance", aggregateType: "payment-record", aggregateId: paymentRecordId, payload: input },
  createMutationMetadata(`payment.record-cod-remittance:${paymentRecordId}`, { idempotencyKey: `payment.cod.remittance:${paymentRecordId}:${input.expectedVersion}:${input.state ?? "UNKNOWN"}`, expectedVersion: input.expectedVersion, signal }),
  () => paymentVerticalSlice.recordCodMerchantRemittance(paymentRecordId, input, signal),
);
export const recordPaymentRequestDeliveryCanonical = async (intentId: string, input: Parameters<typeof paymentVerticalSlice.recordRequestDelivery>[1], signal?: AbortSignal): Promise<MutationOutcome<PaymentIntent>> => {
  const options = createMutationMetadata(`payment.record-request-delivery:${intentId}`, { idempotencyKey: input.idempotencyKey, expectedVersion: input.expectedVersion, signal });
  const result = await paymentVerticalSlice.recordRequestDelivery(intentId, input, signal);
  return paymentMutationOutcome("payment.record-request-delivery", options, result.intent, result.evidence);
};

/** Projects a dedicated Payment adapter result into the public MutationOutcome contract. */
function paymentMutationOutcome<T>(
  commandType: string,
  options: MutationCommandMetadata,
  data: T,
  evidence: PaymentMutationEvidence,
): MutationOutcome<T> {
  return {
    data,
    commandId: evidence.commandId,
    commandType,
    aggregateType: evidence.aggregateType,
    aggregateId: evidence.aggregateId,
    idempotencyKey: options.idempotencyKey,
    correlationId: evidence.correlationId,
    occurredAt: evidence.occurredAt,
    version: evidence.version,
    outcome: evidence.outcome,
    warnings: [...evidence.warnings],
    emittedEvents: [...evidence.emittedEventIds],
    audit: { authority: evidence.authority === "backend" ? "backend" : "demo", evidenceIds: [...evidence.auditEvidenceIds] },
  };
}
