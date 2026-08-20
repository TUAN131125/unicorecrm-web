import { buildPaymentPlanPreview } from "../domain/rules/paymentPlanRules";
import { activatePaymentPlan, cancelPaymentPlan, savePaymentPlanDraft } from "../application/commands/paymentPlanCommands";
import { allocatePaymentToInvoices, recordManualPayment, reverseInvoiceAllocation } from "../application/commands/paymentAllocationCommands";
import { cancelPaymentIntent, createPaymentIntent, retryPaymentIntent } from "../application/commands/paymentIntentCommands";
import { reconcilePaymentRecord } from "../application/commands/paymentRecordCommands";
import { recordCodCustomerCollectionEvidence, recordCodMerchantRemittanceEvidence } from "../application/commands/paymentCodCommands";
import { recordPaymentRequestDelivery } from "../application/commands/paymentRequestCommunicationCommands";
import { getPaymentRecordDetail } from "../application/queries/paymentRecordDetail";
import { getOperationalAuditSnapshot } from "@/platform/operational-audit";
import { completeRefundIntent, createRefundIntent } from "../application/commands/paymentRefundCommands";
import { createDurableId } from "@/shared/ids";
import type { PaymentApiPort } from "../application/ports/PaymentApiPort";
import type { PaymentRepository } from "../application/ports/PaymentRepository";
import type { RefundProviderAttempt } from "../domain/model/paymentCollection.types";

export class InMemoryPaymentApiAdapter implements PaymentApiPort {
  private readonly demoRefundAttempts = new Map<string, RefundProviderAttempt[]>();
  constructor(private readonly repository: PaymentRepository) {}
  async getMethodCatalog() { return { methods: this.repository.listPaymentMethods(), providers: this.repository.listPaymentProviders() }; }
  async listPlans(orderId?: string) { return this.repository.listPlans().filter((item) => !orderId || item.orderId === orderId); }
  async listScheduleLines(planId?: string) { return this.repository.listScheduleLines().filter((item) => !planId || item.planId === planId); }
  async listIntents(orderId?: string) { return this.repository.listIntents().filter((item) => !orderId || item.orderId === orderId); }
  async listPaymentRecords(buyerId?: string) { return this.repository.listPaymentRecords().filter((item) => !buyerId || item.buyerRef.id === buyerId); }
  async getPaymentRecordDetail(paymentRecordId: string) { const detail = getPaymentRecordDetail(this.repository, paymentRecordId, getOperationalAuditSnapshot("payments", paymentRecordId)); if (!detail) throw new Error(`Payment Record ${paymentRecordId} not found.`); return detail; }
  async listRefundIntents(orderId?: string) { return this.repository.listRefundIntents().filter((item) => !orderId || item.orderId === orderId); }
  async listCustomerCredits(buyerId?: string) { return this.repository.listCustomerCredits().filter((item) => !buyerId || item.buyerRef.id === buyerId); }
  async listAllocations(invoiceId?: string) { return this.repository.listAllocations().filter((item) => !invoiceId || item.invoiceId === invoiceId); }
  async previewPlan(command: Parameters<PaymentApiPort["previewPlan"]>[0]) {
    return buildPaymentPlanPreview(command.agreementSnapshot, command.orderAmount, this.repository.listPaymentMethods(), { requiresPhysicalShipping: command.requiresPhysicalShipping, now: command.now, planId: command.id, planVersion: command.version, orderId: command.orderId, buyerRef: command.buyerRef });
  }
  async savePlanDraft(command: Parameters<PaymentApiPort["savePlanDraft"]>[0]) { return savePaymentPlanDraft(this.repository, command).plan; }
  async activatePlan(planId: string, expectedVersion: number) { return activatePaymentPlan(this.repository, planId, { expectedVersion, now: new Date().toISOString() }); }
  async cancelPlan(planId: string, input: Parameters<PaymentApiPort["cancelPlan"]>[1]) { return cancelPaymentPlan(this.repository, planId, { ...input, now: new Date().toISOString() }); }
  async createIntent(command: Parameters<PaymentApiPort["createIntent"]>[0]) {
    const provider = this.repository.listPaymentProviders().find((item) => item.code === command.providerCode && item.enabled);
    const origin = provider?.checkoutOrigins?.[0];
    return createPaymentIntent(this.repository, { ...command, checkoutUrl: origin ? `${origin}/pay/${encodeURIComponent(command.id)}` : undefined });
  }
  async getIntent(intentId: string) { const value = this.repository.listIntents().find((item) => item.id === intentId); if (!value) throw new Error(`Payment Intent ${intentId} not found.`); return value; }
  async getIntentStatus(intentId: string) { return this.getIntent(intentId); }
  async cancelIntent(intentId: string, expectedVersion: number) { return cancelPaymentIntent(this.repository, intentId, { expectedVersion, now: new Date().toISOString() }); }
  async retryIntent(intentId: string, command: Parameters<PaymentApiPort["retryIntent"]>[1]) {
    const current = this.repository.listIntents().find((item) => item.id === intentId);
    const provider = this.repository.listPaymentProviders().find((item) => item.code === current?.providerCode && item.enabled);
    const origin = provider?.checkoutOrigins?.[0];
    return retryPaymentIntent(this.repository, intentId, { ...command, checkoutUrl: origin ? `${origin}/pay/${encodeURIComponent(command.id)}` : undefined });
  }
  async recordManualPayment(command: Parameters<PaymentApiPort["recordManualPayment"]>[0]) { return recordManualPayment(this.repository, command); }
  async allocate(command: Parameters<PaymentApiPort["allocate"]>[0]) { return allocatePaymentToInvoices(this.repository, command); }
  async reverseAllocation(allocationId: string, input: Parameters<PaymentApiPort["reverseAllocation"]>[1]) { return reverseInvoiceAllocation(this.repository, allocationId, { ...input, now: new Date().toISOString(), reasonCode: input.reasonCode ?? "API_REVERSAL", reason: input.reason ?? "Allocation reversal requested through Payment API adapter." }); }
  async reconcilePaymentRecord(paymentRecordId: string, command: Parameters<PaymentApiPort["reconcilePaymentRecord"]>[1]) { return reconcilePaymentRecord(this.repository, paymentRecordId, command); }
  async recordCodCustomerCollection(paymentRecordId: string, input: Parameters<PaymentApiPort["recordCodCustomerCollection"]>[1]) { return recordCodCustomerCollectionEvidence(this.repository, paymentRecordId, input as Parameters<typeof recordCodCustomerCollectionEvidence>[2]); }
  async recordCodMerchantRemittance(paymentRecordId: string, input: Parameters<PaymentApiPort["recordCodMerchantRemittance"]>[1]) { return recordCodMerchantRemittanceEvidence(this.repository, paymentRecordId, input as Parameters<typeof recordCodMerchantRemittanceEvidence>[2]); }
  async recordPaymentRequestDelivery(intentId: string, command: Parameters<PaymentApiPort["recordPaymentRequestDelivery"]>[1]) {
    const now = new Date().toISOString();
    return recordPaymentRequestDelivery(this.repository, intentId, {
      expectedVersion: command.expectedVersion,
      actorId: "demo-local-runtime",
      actorName: "Demo local runtime",
      correlationId: command.idempotencyKey,
      delivery: {
        id: command.idempotencyKey,
        channel: command.channel,
        state: "SENT",
        templateKey: command.templateKey,
        renderedContent: command.renderedContent ?? "",
        ...(command.recipient ? { recipient: command.recipient } : {}),
        sentAt: now,
        createdAt: now,
      },
    });
  }
  async createRefundIntent(command: Parameters<PaymentApiPort["createRefundIntent"]>[0]) {
    const created = createRefundIntent(this.repository, command);
    if (created.state === "SUCCEEDED") return created;
    const now = new Date().toISOString();
    const completed = completeRefundIntent(this.repository, created.id, {
      expectedVersion: created.version,
      paymentRecordId: createDurableId("refund_payment"),
      externalReference: `DEV-REFUND-${created.id}`,
      occurredAt: now,
      now,
    });
    this.demoRefundAttempts.set(completed.id, [{ id: createDurableId("refund_attempt"), refundIntentId: completed.id, providerCode: "demo-local", sequenceNumber: 1, state: "SUCCEEDED", providerReference: `DEV-REFUND-${completed.id}`, submittedAt: now, completedAt: now, version: 1, createdAt: now, updatedAt: now }]);
    return completed;
  }
  async getRefund(refundIntentId: string) {
    const value = this.repository.listRefundIntents().find((item) => item.id === refundIntentId);
    if (!value) throw new Error(`Refund Intent ${refundIntentId} not found.`);
    return value;
  }
  async listRefundProviderAttempts(refundIntentId: string) { return [...(this.demoRefundAttempts.get(refundIntentId) ?? [])]; }
  async requestRefundCancellation(refundIntentId: string, command: Parameters<PaymentApiPort["requestRefundCancellation"]>[1]) {
    const current = await this.getRefund(refundIntentId);
    const attempts = this.demoRefundAttempts.get(refundIntentId) ?? [];
    const latest = attempts.at(-1);
    if (!latest || current.state === "SUCCEEDED") throw new Error("REFUND_CANCELLATION_NOT_SUPPORTED");
    const now = new Date().toISOString();
    const attempt = { ...latest, state: "CANCELLATION_REQUESTED" as const, cancellationReasonCode: command.reasonCode, cancellationReason: command.reason, cancellationRequestedAt: now, version: latest.version + 1, updatedAt: now };
    this.demoRefundAttempts.set(refundIntentId, [...attempts.slice(0, -1), attempt]);
    return { refundIntent: current, providerAttempt: attempt };
  }
  async retryRefund(refundIntentId: string, command: Parameters<PaymentApiPort["retryRefund"]>[1]) {
    const current = await this.getRefund(refundIntentId);
    const attempts = this.demoRefundAttempts.get(refundIntentId) ?? [];
    const previous = attempts.at(-1);
    if (!previous || previous.state !== "FAILED" || current.state !== "FAILED") throw new Error("REFUND_RETRY_NOT_ALLOWED");
    const now = new Date().toISOString();
    const attempt: RefundProviderAttempt = { id: createDurableId("refund_attempt"), refundIntentId, providerCode: previous.providerCode, sequenceNumber: previous.sequenceNumber + 1, state: "QUEUED", retryOfAttemptId: previous.id, version: 1, createdAt: now, updatedAt: now };
    const refundIntent = this.repository.saveRefundIntent({ ...current, state: "PROCESSING", latestProviderAttemptId: attempt.id, version: command.expectedVersion + 1, updatedAt: now });
    this.demoRefundAttempts.set(refundIntentId, [...attempts, attempt]);
    return { refundIntent, providerAttempt: attempt };
  }
}
