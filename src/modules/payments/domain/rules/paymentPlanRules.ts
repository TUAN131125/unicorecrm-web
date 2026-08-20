import { addMoney, compareMoney, isPositiveMoney, money, subtractMoney, sumMoney, type MoneyDto } from "@/shared/money";
import type { PaymentAgreementSnapshot, PaymentPlanIssue, PaymentPlanPreview, PaymentScheduleLine } from "../model/paymentPlan.types";
import type { PaymentMethodCatalogItem } from "../model/paymentCollection.types";

function issue(code: string, messageKey: string, fieldPath?: string, detail?: string): PaymentPlanIssue {
  return { code, messageKey, fieldPath, detail };
}

export function validatePaymentAgreement(
  agreement: PaymentAgreementSnapshot,
  orderAmount: MoneyDto,
  catalog: readonly PaymentMethodCatalogItem[],
  context: { requiresPhysicalShipping: boolean },
): PaymentPlanIssue[] {
  const blockers: PaymentPlanIssue[] = [];
  if (agreement.lines.length === 0) blockers.push(issue("PAYMENT_PLAN_LINE_INVALID", "payments.plan.linesRequired", "lines"));
  const ids = new Set<string>();
  const sequences = new Set<number>();
  for (const [index, line] of agreement.lines.entries()) {
    const path = `lines.${index}`;
    if (!line.id || ids.has(line.id)) blockers.push(issue("PAYMENT_PLAN_LINE_INVALID", "payments.plan.uniqueLine", `${path}.id`));
    if (sequences.has(line.sequence)) blockers.push(issue("PAYMENT_PLAN_LINE_INVALID", "payments.plan.uniqueSequence", `${path}.sequence`));
    ids.add(line.id); sequences.add(line.sequence);
    if (!isPositiveMoney(line.previewAmount)) blockers.push(issue("PAYMENT_PLAN_LINE_INVALID", "payments.plan.amountPositive", `${path}.previewAmount`));
    if (line.previewAmount.currency !== orderAmount.currency) blockers.push(issue("PAYMENT_PLAN_TOTAL_MISMATCH", "payments.plan.currencyMismatch", `${path}.previewAmount`));
    if (line.allowedMethodCodes.length === 0) blockers.push(issue("PAYMENT_PLAN_LINE_INVALID", "payments.plan.methodRequired", `${path}.allowedMethodCodes`));
    for (const methodCode of line.allowedMethodCodes) {
      const method = catalog.find((item) => item.code === methodCode && item.enabled);
      if (!method) blockers.push(issue("PAYMENT_METHOD_DISABLED", "payments.method.disabled", `${path}.allowedMethodCodes`, methodCode));
      else if (!method.supportedCurrencies.includes(orderAmount.currency)) blockers.push(issue("PAYMENT_METHOD_CURRENCY_UNSUPPORTED", "payments.method.currencyUnsupported", `${path}.allowedMethodCodes`, methodCode));
      else if (method.requiresPhysicalShipping && !context.requiresPhysicalShipping) blockers.push(issue("COD_REQUIRES_PHYSICAL_SHIPPING", "payments.cod.requiresShipping", `${path}.allowedMethodCodes`, methodCode));
    }
    if (line.dueRule.type === "RECURRING_FINITE" && (!Number.isInteger(line.dueRule.count) || line.dueRule.count <= 0)) {
      blockers.push(issue("RECURRING_COUNT_REQUIRED", "payments.plan.recurringCountRequired", `${path}.dueRule.count`));
    }
    const hasCod = line.allowedMethodCodes.some((code) => catalog.find((item) => item.code === code)?.kind === "COD");
    if (hasCod && line.fulfillmentGate !== "NONE") blockers.push(issue("FULFILLMENT_GATE_CONFLICT", "payments.cod.gateConflict", `${path}.fulfillmentGate`));
    if (hasCod && !(line.dueRule.type === "EVENT_RELATIVE" && line.dueRule.event === "DELIVERY_CONFIRMED")) blockers.push(issue("DUE_RULE_INVALID", "payments.cod.deliveryDueRequired", `${path}.dueRule`));
  }
  const scheduled = sumMoney(agreement.lines.map((line) => line.previewAmount), orderAmount.currency);
  if (compareMoney(scheduled, orderAmount) !== 0) blockers.push(issue("PAYMENT_PLAN_TOTAL_MISMATCH", "payments.plan.totalMismatch", "lines"));
  return blockers;
}

export function buildPaymentPlanPreview(
  agreement: PaymentAgreementSnapshot,
  orderAmount: MoneyDto,
  catalog: readonly PaymentMethodCatalogItem[],
  context: { requiresPhysicalShipping: boolean; now: string; planId?: string; planVersion?: number; orderId: string; buyerRef: PaymentScheduleLine["buyerRef"] },
): PaymentPlanPreview {
  const blockers = validatePaymentAgreement(agreement, orderAmount, catalog, context);
  const scheduledAmount = sumMoney(agreement.lines.map((line) => line.previewAmount), orderAmount.currency);
  const remainingAmount = subtractMoney(orderAmount, scheduledAmount);
  const resolvedLines: PaymentScheduleLine[] = agreement.lines.map((line) => ({
    id: line.id,
    planId: context.planId ?? `preview:${context.orderId}`,
    planVersion: context.planVersion ?? 1,
    orderId: context.orderId,
    buyerRef: context.buyerRef,
    sequence: line.sequence,
    label: line.label,
    purpose: line.purpose,
    amountRule: line.amountRule,
    amount: line.previewAmount,
    dueRule: line.dueRule,
    resolvedDueDate: line.dueRule.type === "FIXED_DATE" ? line.dueRule.date : undefined,
    allowedMethodCodes: line.allowedMethodCodes,
    preferredMethodCode: line.preferredMethodCode,
    channel: line.channel,
    fulfillmentGate: line.fulfillmentGate,
    invoicePolicyCode: line.invoicePolicyCode,
    state: "SCHEDULED",
    satisfiedAmount: money("0", line.previewAmount.currency),
    outstandingAmount: line.previewAmount,
    idempotencyKey: `preview:${context.orderId}:${line.id}`,
    createdAt: context.now,
    updatedAt: context.now,
  }));
  return { ready: blockers.length === 0, orderAmount, scheduledAmount, remainingAmount, resolvedLines, warnings: [], blockers, version: context.planVersion ?? 1 };
}

export function paymentPlanHasFinancialEvidence(input: { evidenceCount: number }): boolean {
  return input.evidenceCount > 0;
}

export function applySatisfiedAmount(line: PaymentScheduleLine, delta: MoneyDto): PaymentScheduleLine {
  const satisfiedAmount = addMoney(line.satisfiedAmount, delta);
  if (compareMoney(satisfiedAmount, line.amount) > 0) throw new Error("Payment allocation exceeds the schedule line amount.");
  const outstandingAmount = subtractMoney(line.amount, satisfiedAmount);
  return {
    ...line,
    satisfiedAmount,
    outstandingAmount,
    state: compareMoney(outstandingAmount, money("0", outstandingAmount.currency)) === 0 ? "SATISFIED" : "PARTIAL",
  };
}
