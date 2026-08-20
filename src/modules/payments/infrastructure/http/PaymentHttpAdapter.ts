import { FinancialApiClient } from "@/platform/api";
import type {
  AllocatePaymentSourceRequest,
  AllocatePaymentSourceResponse,
  CodPaymentEvidenceResponse,
  CreateRefundIntentRequest,
  CreateRefundIntentResponse,
  ActivatePaymentPlanResponse,
  CancelPaymentIntentResponse,
  CancelPaymentPlanRequest,
  CancelPaymentPlanResponse,
  CreatePaymentIntentRequest,
  CreatePaymentIntentResponse,
  EmptyCommandRequest,
  PaymentIntentDocument,
  PaymentIntentList,
  PaymentPlanList,
  PaymentPlanPreviewRequest,
  PaymentPlanPreviewResponse,
  PaymentScheduleLineList,
  RetryPaymentIntentRequest,
  RetryPaymentIntentResponse,
  SavePaymentPlanDraftRequest,
  SavePaymentPlanDraftResponse,
  PaymentAllocationList,
  PaymentRecordDetailResponse,
  PaymentRecordList,
  RecordCodCustomerCollectionRequest,
  RecordCodMerchantRemittanceRequest,
  RefundIntentDocument,
  RefundIntentList,
  RefundProviderAttemptList,
  RequestRefundCancellationRequest,
  RequestRefundCancellationResponse,
  RetryRefundIntentRequest,
  RetryRefundIntentResponse,
  ReversePaymentAllocationRequest,
  ReversePaymentAllocationResponse,
  CustomerCreditList,
  ManualPaymentRequest,
  ManualPaymentResponse,
  PaymentRequestDeliveryRequest,
  PaymentRequestDeliveryResponse,
} from "@/platform/api/generated/financialApi";
import {
  projectCustomerCredit,
  projectPaymentAllocation,
  projectPaymentRecord,
  projectPaymentRecordDetail,
  projectRefundIntent,
  projectRefundProviderAttempt,
} from "./paymentLedgerDtoMapper";
import {
  projectPaymentAgreementInput,
  projectPaymentIntent,
  projectPaymentPlan,
  projectPaymentPlanPreview,
  projectPaymentScheduleLine,
} from "./paymentPlanIntentDtoMapper";
import type { HttpClient } from "@/platform/api";
import type { PaymentApiPort } from "../../application/ports/PaymentApiPort";

export class PaymentHttpAdapter implements PaymentApiPort {
  private readonly api: FinancialApiClient;

  constructor(client: HttpClient) {
    this.api = new FinancialApiClient(client);
  }

  getMethodCatalog(signal?: AbortSignal) {
    return this.api.getPaymentMethodCatalog<Awaited<ReturnType<PaymentApiPort["getMethodCatalog"]>>>({}, signal);
  }

  async listPlans(orderId?: string, signal?: AbortSignal) {
    const plans = await this.api.listPaymentPlans<PaymentPlanList>({ ...(orderId ? { orderId } : {}) }, signal);
    return plans.map(projectPaymentPlan);
  }

  async listScheduleLines(planId?: string, signal?: AbortSignal) {
    const lines = await this.api.listPaymentScheduleLines<PaymentScheduleLineList>({ ...(planId ? { planId } : {}) }, signal);
    return lines.map(projectPaymentScheduleLine);
  }

  async listIntents(orderId?: string, signal?: AbortSignal) {
    const intents = await this.api.listPaymentIntents<PaymentIntentList>({ ...(orderId ? { orderId } : {}) }, signal);
    return intents.map(projectPaymentIntent);
  }

  async listPaymentRecords(buyerId?: string, signal?: AbortSignal) {
    const records = await this.api.listPaymentRecords<PaymentRecordList>({ ...(buyerId ? { buyerId } : {}) }, signal);
    return records.map(projectPaymentRecord);
  }

  async getPaymentRecordDetail(paymentRecordId: string, signal?: AbortSignal) {
    const detail = await this.api.getPaymentRecordDetail<PaymentRecordDetailResponse>(paymentRecordId, {}, signal);
    return projectPaymentRecordDetail(detail);
  }

  async listRefundIntents(orderId?: string, signal?: AbortSignal) {
    const refunds = await this.api.listRefunds<RefundIntentList>({ ...(orderId ? { orderId } : {}) }, signal);
    return refunds.map(projectRefundIntent);
  }

  async listCustomerCredits(buyerId?: string, signal?: AbortSignal) {
    const credits = await this.api.listCustomerCredits<CustomerCreditList>({ ...(buyerId ? { buyerId } : {}) }, signal);
    return credits.map(projectCustomerCredit);
  }

  async listAllocations(invoiceId?: string, signal?: AbortSignal) {
    const allocations = await this.api.listPaymentAllocations<PaymentAllocationList>({ ...(invoiceId ? { invoiceId } : {}) }, signal);
    return allocations.map(projectPaymentAllocation);
  }

  async previewPlan(command: Parameters<PaymentApiPort["previewPlan"]>[0], signal?: AbortSignal) {
    const body: PaymentPlanPreviewRequest = {
      agreement: projectPaymentAgreementInput(command.agreementSnapshot),
      orderAmount: command.orderAmount,
      requiresPhysicalShipping: command.requiresPhysicalShipping,
    };
    const response = await this.api.previewPaymentPlan<PaymentPlanPreviewResponse, PaymentPlanPreviewRequest>(command.id, body, {
      signal,
      expectedVersion: command.version,
      retry: "never",
    });
    return projectPaymentPlanPreview(response);
  }

  async savePlanDraft(command: Parameters<PaymentApiPort["savePlanDraft"]>[0], signal?: AbortSignal) {
    const body: SavePaymentPlanDraftRequest = {
      agreement: projectPaymentAgreementInput(command.agreementSnapshot),
      orderAmount: command.orderAmount,
      requiresPhysicalShipping: command.requiresPhysicalShipping,
    };
    const response = await this.api.savePaymentPlanDraft<SavePaymentPlanDraftResponse, SavePaymentPlanDraftRequest>(command.id, body, {
      signal,
      idempotencyKey: command.idempotencyKey,
      expectedVersion: command.version,
      retry: "idempotent",
    });
    return projectPaymentPlan(response.result.plan);
  }

  async activatePlan(planId: string, expectedVersion: number, signal?: AbortSignal) {
    const response = await this.api.activatePaymentPlan<ActivatePaymentPlanResponse, EmptyCommandRequest>(planId, {}, {
      signal,
      idempotencyKey: `payment.plan.activate:${planId}:${expectedVersion}`,
      expectedVersion,
      retry: "idempotent",
    });
    return projectPaymentPlan(response.result.plan);
  }

  async cancelPlan(planId: string, input: Parameters<PaymentApiPort["cancelPlan"]>[1], signal?: AbortSignal) {
    const body: CancelPaymentPlanRequest = { reason: input.reason };
    const response = await this.api.cancelPaymentPlan<CancelPaymentPlanResponse, CancelPaymentPlanRequest>(planId, body, {
      signal,
      idempotencyKey: `payment.plan.cancel:${planId}:${input.expectedVersion}:${input.reason.trim()}`,
      expectedVersion: input.expectedVersion,
      retry: "idempotent",
    });
    return projectPaymentPlan(response.result.plan);
  }

  async createIntent(command: Parameters<PaymentApiPort["createIntent"]>[0], signal?: AbortSignal) {
    const body: CreatePaymentIntentRequest = {
      buyerRef: command.buyerRef,
      ...(command.orderId ? { orderId: command.orderId } : {}),
      ...(command.invoiceIds?.length ? { invoiceIds: command.invoiceIds } : {}),
      ...(command.scheduleLineIds?.length ? { scheduleLineIds: command.scheduleLineIds } : {}),
      amount: command.amount,
      methodCode: command.methodCode,
      providerCode: command.providerCode,
      returnRouteKey: command.returnContext.routeKey,
    };
    const response = await this.api.createPaymentIntent<CreatePaymentIntentResponse, CreatePaymentIntentRequest>(body, {
      signal,
      idempotencyKey: command.idempotencyKey,
      retry: "idempotent",
    });
    return projectPaymentIntent(response.result.intent);
  }

  async getIntent(intentId: string, signal?: AbortSignal) {
    return projectPaymentIntent(await this.api.getPaymentIntent<PaymentIntentDocument>(intentId, {}, signal));
  }

  async getIntentStatus(intentId: string, signal?: AbortSignal) {
    // The application model needs amount, provider and expiry as well as state.
    // Use the authoritative detail projection rather than merging a partial status into browser state.
    return this.getIntent(intentId, signal);
  }

  async cancelIntent(intentId: string, expectedVersion: number, signal?: AbortSignal) {
    const response = await this.api.cancelPaymentIntent<CancelPaymentIntentResponse, EmptyCommandRequest>(intentId, {}, {
      signal,
      idempotencyKey: `payment.intent.cancel:${intentId}:${expectedVersion}`,
      expectedVersion,
      retry: "idempotent",
    });
    return projectPaymentIntent(response.result.intent);
  }

  async retryIntent(intentId: string, command: Parameters<PaymentApiPort["retryIntent"]>[1], signal?: AbortSignal) {
    const response = await this.api.retryPaymentIntent<RetryPaymentIntentResponse, RetryPaymentIntentRequest>(intentId, {}, {
      signal,
      idempotencyKey: command.idempotencyKey,
      expectedVersion: command.expectedVersion,
      retry: "idempotent",
    });
    return projectPaymentIntent(response.result.intent);
  }

  async recordManualPayment(command: Parameters<PaymentApiPort["recordManualPayment"]>[0], signal?: AbortSignal) {
    const body: ManualPaymentRequest = {
      buyerRef: command.buyerRef,
      ...(command.orderId ? { orderId: command.orderId } : {}),
      amount: command.amount,
      methodCode: command.methodCode,
      channel: command.channel,
      occurredAt: command.occurredAt,
      ...(command.externalReference?.trim() ? { externalReference: command.externalReference.trim() } : {}),
      ...(command.evidenceMetadata ? { evidenceMetadata: { ...command.evidenceMetadata } } : {}),
      allowUnapplied: command.allowUnapplied,
    };
    const response = await this.api.recordManualPayment<ManualPaymentResponse, ManualPaymentRequest>(body, {
      signal,
      idempotencyKey: command.idempotencyKey,
      retry: "idempotent",
    });
    return {
      payment: projectPaymentRecord(response.result.payment),
      ...(response.result.customerCredit ? { customerCredit: projectCustomerCredit(response.result.customerCredit) } : {}),
    };
  }

  async allocate(command: Parameters<PaymentApiPort["allocate"]>[0], signal?: AbortSignal) {
    const sourceId = command.paymentRecordId ?? command.customerCreditId;
    if (!sourceId || Boolean(command.paymentRecordId) === Boolean(command.customerCreditId)) throw new Error("Allocation requires exactly one source.");
    const body: AllocatePaymentSourceRequest = {
      source: { type: command.paymentRecordId ? "PAYMENT_RECORD" : "CUSTOMER_CREDIT", id: sourceId },
      targets: command.allocations.map((item) => ({ invoiceId: item.invoice.invoiceId, amount: item.amount, ...(item.scheduleLineId ? { scheduleLineId: item.scheduleLineId } : {}) })),
    };
    const response = await this.api.allocatePaymentSource<AllocatePaymentSourceResponse, AllocatePaymentSourceRequest>(body, {
      signal,
      idempotencyKey: allocationBatchKey(command),
      expectedVersion: command.expectedSourceVersion,
      retry: "idempotent",
    });
    return { allocations: response.result.allocations.map(projectPaymentAllocation), remainingAmount: response.result.remainingAmount };
  }

  async reverseAllocation(allocationId: string, input: Parameters<PaymentApiPort["reverseAllocation"]>[1], signal?: AbortSignal) {
    const reasonCode = input.reasonCode?.trim();
    const reason = input.reason?.trim();
    if (!reasonCode || !reason) throw new Error("PAYMENT_ALLOCATION_REVERSAL_REASON_REQUIRED");
    const body: ReversePaymentAllocationRequest = { reasonCode, reason };
    const response = await this.api.reversePaymentAllocation<ReversePaymentAllocationResponse, ReversePaymentAllocationRequest>(allocationId, body, {
      signal,
      idempotencyKey: `payment.reverse-allocation:${allocationId}:${input.expectedVersion}`,
      expectedVersion: input.expectedVersion,
      retry: "idempotent",
    });
    return projectPaymentAllocation(response.result.allocation);
  }

  reconcilePaymentRecord(paymentRecordId: string, command: Parameters<PaymentApiPort["reconcilePaymentRecord"]>[1], signal?: AbortSignal) {
    return this.api.reconcilePaymentRecord<Awaited<ReturnType<PaymentApiPort["reconcilePaymentRecord"]>>, typeof command>(paymentRecordId, command, {
      signal,
      expectedVersion: command.expectedVersion,
      retry: "never",
    });
  }

  async recordCodCustomerCollection(paymentRecordId: string, input: Parameters<PaymentApiPort["recordCodCustomerCollection"]>[1], signal?: AbortSignal) {
    const body = projectCodCollectionRequest(input);
    const response = await this.api.recordCodCustomerCollection<CodPaymentEvidenceResponse, RecordCodCustomerCollectionRequest>(paymentRecordId, body, {
      signal,
      idempotencyKey: `payment.cod.collection:${paymentRecordId}:${input.expectedVersion}:${body.outcome}`,
      expectedVersion: input.expectedVersion,
      retry: "idempotent",
    });
    return projectPaymentRecord(response.result);
  }

  async recordCodMerchantRemittance(paymentRecordId: string, input: Parameters<PaymentApiPort["recordCodMerchantRemittance"]>[1], signal?: AbortSignal) {
    const body = projectCodRemittanceRequest(input);
    const response = await this.api.recordCodMerchantRemittance<CodPaymentEvidenceResponse, RecordCodMerchantRemittanceRequest>(paymentRecordId, body, {
      signal,
      idempotencyKey: `payment.cod.remittance:${paymentRecordId}:${input.expectedVersion}:${body.outcome}`,
      expectedVersion: input.expectedVersion,
      retry: "idempotent",
    });
    return projectPaymentRecord(response.result);
  }

  async recordPaymentRequestDelivery(intentId: string, command: Parameters<PaymentApiPort["recordPaymentRequestDelivery"]>[1], signal?: AbortSignal) {
    const body: PaymentRequestDeliveryRequest = {
      channel: command.channel,
      ...(command.recipient?.trim() ? { recipient: command.recipient.trim() } : {}),
      templateKey: command.templateKey,
      ...(command.renderedContent?.trim() ? { renderedContent: command.renderedContent } : {}),
    };
    const response = await this.api.recordPaymentRequestDelivery<PaymentRequestDeliveryResponse, PaymentRequestDeliveryRequest>(intentId, body, {
      signal,
      idempotencyKey: command.idempotencyKey,
      expectedVersion: command.expectedVersion,
      retry: "idempotent",
    });
    return projectPaymentIntent(response.result.intent);
  }

  async createRefundIntent(command: Parameters<PaymentApiPort["createRefundIntent"]>[0], signal?: AbortSignal) {
    const sourceId = command.paymentRecordId ?? command.customerCreditId;
    if (!sourceId || Boolean(command.paymentRecordId) === Boolean(command.customerCreditId)) throw new Error("Refund requires exactly one source.");
    const body: CreateRefundIntentRequest = {
      source: { type: command.paymentRecordId ? "PAYMENT_RECORD" : "CUSTOMER_CREDIT", id: sourceId },
      amount: command.amount,
      reasonCode: command.reasonCode,
      reason: command.reason,
      ...(command.sourceReturnId ? { sourceReturnId: command.sourceReturnId } : {}),
    };
    const response = await this.api.createRefundIntent<CreateRefundIntentResponse, CreateRefundIntentRequest>(body, {
      signal,
      idempotencyKey: command.idempotencyKey,
      expectedVersion: command.expectedSourceVersion,
      retry: "idempotent",
    });
    return projectRefundIntent(response.result);
  }

  async getRefund(refundIntentId: string, signal?: AbortSignal) {
    return projectRefundIntent(await this.api.getRefund<RefundIntentDocument>(refundIntentId, {}, signal));
  }

  async listRefundProviderAttempts(refundIntentId: string, signal?: AbortSignal) {
    const attempts = await this.api.listRefundProviderAttempts<RefundProviderAttemptList>(refundIntentId, {}, signal);
    return attempts.map(projectRefundProviderAttempt);
  }

  async requestRefundCancellation(refundIntentId: string, command: Parameters<PaymentApiPort["requestRefundCancellation"]>[1], signal?: AbortSignal) {
    const reasonCode = command.reasonCode.trim();
    const reason = command.reason.trim();
    if (!reasonCode || !reason) throw new Error("REFUND_CANCELLATION_REASON_REQUIRED");
    const body: RequestRefundCancellationRequest = { reasonCode, reason };
    const response = await this.api.requestRefundCancellation<RequestRefundCancellationResponse, RequestRefundCancellationRequest>(refundIntentId, body, {
      signal,
      idempotencyKey: command.idempotencyKey,
      expectedVersion: command.expectedVersion,
      retry: "idempotent",
    });
    return { refundIntent: projectRefundIntent(response.result.refundIntent), providerAttempt: projectRefundProviderAttempt(response.result.providerAttempt) };
  }

  async retryRefund(refundIntentId: string, command: Parameters<PaymentApiPort["retryRefund"]>[1], signal?: AbortSignal) {
    const response = await this.api.retryRefundIntent<RetryRefundIntentResponse, RetryRefundIntentRequest>(refundIntentId, {}, {
      signal,
      idempotencyKey: command.idempotencyKey,
      expectedVersion: command.expectedVersion,
      retry: "idempotent",
    });
    return { refundIntent: projectRefundIntent(response.result.refundIntent), providerAttempt: projectRefundProviderAttempt(response.result.providerAttempt) };
  }

}

function allocationBatchKey(command: Parameters<PaymentApiPort["allocate"]>[0]): string {
  const sourceId = command.paymentRecordId ?? command.customerCreditId ?? "unknown";
  const targetFingerprint = command.allocations
    .map((item) => `${item.invoice.invoiceId}:${item.scheduleLineId ?? "-"}:${item.amount.amount}:${item.amount.currency}`)
    .sort()
    .join("|");
  return `payment.allocate:${sourceId}:${command.expectedSourceVersion}:${targetFingerprint}`;
}

function projectCodCollectionRequest(input: Parameters<PaymentApiPort["recordCodCustomerCollection"]>[1]): RecordCodCustomerCollectionRequest {
  if (input.state !== "COLLECTED" && input.state !== "FAILED") throw new Error("COD customer collection accepts COLLECTED or FAILED only.");
  return {
    outcome: input.state,
    evidenceReference: requireEvidenceReference(input.evidenceMetadata),
    ...optionalCodEvidence(input.evidenceMetadata),
  };
}

function projectCodRemittanceRequest(input: Parameters<PaymentApiPort["recordCodMerchantRemittance"]>[1]): RecordCodMerchantRemittanceRequest {
  if (input.state !== "REMITTED" && input.state !== "FAILED") throw new Error("COD merchant remittance accepts REMITTED or FAILED only.");
  return {
    outcome: input.state,
    evidenceReference: requireEvidenceReference(input.evidenceMetadata),
    ...optionalCodEvidence(input.evidenceMetadata),
  };
}

function requireEvidenceReference(metadata?: Record<string, string>): string {
  const value = metadata?.evidenceReference ?? metadata?.customerCollectionEvidenceId ?? metadata?.merchantRemittanceEvidenceId ?? metadata?.providerEvidenceId;
  if (!value?.trim()) throw new Error("COD_EVIDENCE_REFERENCE_REQUIRED");
  return value.trim();
}

function optionalCodEvidence(metadata?: Record<string, string>): Pick<RecordCodCustomerCollectionRequest, "providerReference" | "note"> {
  return {
    ...(metadata?.providerReference?.trim() ? { providerReference: metadata.providerReference.trim() } : {}),
    ...(metadata?.note?.trim() ? { note: metadata.note.trim() } : {}),
  };
}
