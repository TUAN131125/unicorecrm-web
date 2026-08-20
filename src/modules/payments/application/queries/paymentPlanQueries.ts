import { getEffectivePaymentMethodCatalog } from "./effectivePaymentMethodCatalog";
import type { PaymentConfiguration } from "../../domain/model/paymentConfiguration.types";
import type { PaymentRepository, PaymentRepositorySnapshot } from "../ports/PaymentRepository";
import { addMoney, compareMoney, money, subtractMoney, sumMoney, type MoneyDto } from "@/shared/money";
import type { CustomerCredit, InvoicePaymentAllocation, PaymentIntent, PaymentMethodCatalogItem, PaymentRecord, RefundIntent } from "../../domain/model/paymentCollection.types";
import type { PaymentPlan, PaymentScheduleLine } from "../../domain/model/paymentPlan.types";

const snapshotOf = (source: PaymentRepository | PaymentRepositorySnapshot): PaymentRepositorySnapshot => "snapshot" in source ? source.snapshot() : source;

export function getPaymentPlansForOrder(source: PaymentRepository | PaymentRepositorySnapshot, orderId: string): PaymentPlan[] {
  return snapshotOf(source).plans.filter((plan) => plan.orderId === orderId).sort((left, right) => right.version - left.version);
}

export function getActivePaymentPlanForOrder(source: PaymentRepository | PaymentRepositorySnapshot, orderId: string): PaymentPlan | undefined {
  return getPaymentPlansForOrder(source, orderId).find((plan) => plan.state === "ACTIVE");
}

export function getScheduleLinesForPlan(source: PaymentRepository | PaymentRepositorySnapshot, planId: string): PaymentScheduleLine[] {
  return snapshotOf(source).scheduleLines.filter((line) => line.planId === planId).sort((left, right) => left.sequence - right.sequence);
}

export function getPaymentMethodCatalog(source: PaymentRepository | PaymentRepositorySnapshot, input: { currency?: string; supportsIntent?: boolean; supportsManual?: boolean; requiresPhysicalShipping?: boolean } = {}, configuration?: PaymentConfiguration): PaymentMethodCatalogItem[] {
  return getEffectivePaymentMethodCatalog(snapshotOf(source).methodCatalog, configuration)
    .filter((item) => item.enabled)
    .filter((item) => !input.currency || item.supportedCurrencies.includes(input.currency))
    .filter((item) => input.supportsIntent === undefined || item.supportsIntent === input.supportsIntent)
    .filter((item) => input.supportsManual === undefined || item.supportsManualRecording === input.supportsManual)
    .filter((item) => input.requiresPhysicalShipping || !item.requiresPhysicalShipping);
}

export function getPaymentIntents(source: PaymentRepository | PaymentRepositorySnapshot, input: { orderId?: string; invoiceId?: string } = {}): PaymentIntent[] {
  return snapshotOf(source).intents.filter((item) => !input.orderId || item.orderId === input.orderId).filter((item) => !input.invoiceId || item.invoiceIds.includes(input.invoiceId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getPaymentRecords(source: PaymentRepository | PaymentRepositorySnapshot, input: { orderId?: string; buyerId?: string } = {}): PaymentRecord[] {
  return snapshotOf(source).paymentRecords.filter((item) => !input.orderId || item.orderId === input.orderId).filter((item) => !input.buyerId || item.buyerRef.id === input.buyerId).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function getRefundIntents(source: PaymentRepository | PaymentRepositorySnapshot, input: { orderId?: string; buyerId?: string } = {}): RefundIntent[] {
  return snapshotOf(source).refundIntents
    .filter((item) => !input.orderId || item.orderId === input.orderId)
    .filter((item) => !input.buyerId || item.buyerRef.id === input.buyerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getRefundablePaymentRecordsForOrder(source: PaymentRepository | PaymentRepositorySnapshot, orderId: string): Array<PaymentRecord & { refundableAmount: MoneyDto }> {
  const snapshot = snapshotOf(source);
  return snapshot.paymentRecords
    .filter((item) => item.orderId === orderId && item.kind === "PAYMENT" && item.state === "SUCCEEDED")
    .map((payment) => {
      const refunded = sumMoney(snapshot.paymentRecords
        .filter((item) => item.kind === "REFUND" && item.state === "SUCCEEDED" && item.refundOfPaymentRecordId === payment.id)
        .map((item) => item.amount), payment.amount.currency);
      return { ...payment, refundableAmount: subtractMoney(payment.amount, refunded) };
    })
    .filter((item) => compareMoney(item.refundableAmount, money("0", item.refundableAmount.currency)) > 0)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

export function getPaymentRecordAvailableAmount(source: PaymentRepository | PaymentRepositorySnapshot, paymentRecordId: string): MoneyDto | undefined {
  const snapshot = snapshotOf(source);
  const payment = snapshot.paymentRecords.find((item) => item.id === paymentRecordId);
  if (!payment) return undefined;
  if (snapshot.customerCredits.some((credit) => credit.sourcePaymentRecordId === paymentRecordId && credit.state !== "REVERSED")) return money("0", payment.amount.currency);
  const allocated = sumMoney(snapshot.allocations
    .filter((item) => item.paymentRecordId === paymentRecordId && item.state === "EFFECTIVE")
    .map((item) => item.amount), payment.amount.currency);
  return compareMoney(allocated, payment.amount) >= 0 ? money("0", payment.amount.currency) : subtractMoney(payment.amount, allocated);
}

export function getEffectiveAllocationsForInvoice(source: PaymentRepository | PaymentRepositorySnapshot, invoiceId: string): InvoicePaymentAllocation[] {
  return snapshotOf(source).allocations.filter((item) => item.invoiceId === invoiceId && item.state === "EFFECTIVE");
}

export function getCustomerCredits(source: PaymentRepository | PaymentRepositorySnapshot, buyerId?: string): CustomerCredit[] {
  return snapshotOf(source).customerCredits.filter((item) => !buyerId || item.buyerRef.id === buyerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function evaluatePaymentFulfillmentGate(
  source: PaymentRepository | PaymentRepositorySnapshot,
  orderId: string,
  gate: PaymentScheduleLine["fulfillmentGate"],
): { ready: boolean; blockers: string[] } {
  const snapshot = snapshotOf(source);
  const activePlan = getActivePaymentPlanForOrder(snapshot, orderId);
  if (!activePlan) return { ready: true, blockers: [] };
  const lines = getScheduleLinesForPlan(snapshot, activePlan.id)
    .filter((line) => line.fulfillmentGate === gate && line.state !== "VOIDED");
  const blockers = lines
    .filter((line) => line.state !== "SATISFIED" && compareMoney(line.outstandingAmount, money("0", line.outstandingAmount.currency)) > 0)
    .map((line) => `${line.label}: ${line.outstandingAmount.amount} ${line.outstandingAmount.currency}`);
  return { ready: blockers.length === 0, blockers };
}

export function getCodCollectibleFromActivePlan(
  source: PaymentRepository | PaymentRepositorySnapshot,
  orderId: string,
): { amount: string; currency: string } | undefined {
  const snapshot = snapshotOf(source);
  const activePlan = getActivePaymentPlanForOrder(snapshot, orderId);
  if (!activePlan) return undefined;
  const codMethodCodes = new Set(snapshot.methodCatalog.filter((item) => item.enabled && item.kind === "COD").map((item) => item.code));
  const lines = getScheduleLinesForPlan(snapshot, activePlan.id).filter((line) =>
    line.state !== "VOIDED"
    && line.allowedMethodCodes.some((code) => codMethodCodes.has(code))
    && compareMoney(line.outstandingAmount, money("0", line.outstandingAmount.currency)) > 0,
  );
  if (lines.length === 0) return undefined;
  const currency = lines[0].outstandingAmount.currency;
  const total = lines
    .filter((line) => line.outstandingAmount.currency === currency)
    .reduce((sum, line) => addMoney(sum, line.outstandingAmount), money("0", currency));
  return total;
}
