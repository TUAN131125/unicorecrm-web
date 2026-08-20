import type {
  PaymentAgreementInput,
  PaymentAgreementSnapshotDocument,
  PaymentAmountRule as ApiPaymentAmountRule,
  PaymentDueRule as ApiPaymentDueRule,
  PaymentIntentDocument,
  PaymentPlanDocument,
  PaymentPlanPreviewResponse,
  PaymentScheduleLineDocument,
} from "@/platform/api/generated/financialApi";
import type { PaymentIntent } from "../../domain/model/paymentCollection.types";
import type {
  PaymentAgreementSnapshot,
  PaymentAmountRule,
  PaymentDueRule,
  PaymentPlan,
  PaymentPlanPreview,
  PaymentScheduleLine,
} from "../../domain/model/paymentPlan.types";

const contractViolation = (field: string): never => { throw new Error(`CONNECTED_CONTRACT_VIOLATION:${field}`); };

function projectAmountRule(rule: ApiPaymentAmountRule): PaymentAmountRule {
  if (rule.type === "FIXED") return { type: "FIXED", amount: rule.amount ?? contractViolation("amountRule.amount") };
  if (rule.type === "PERCENTAGE") return { type: "PERCENTAGE", percentage: rule.percentage ?? contractViolation("amountRule.percentage") };
  return { type: "REMAINDER" };
}

function projectDueRule(rule: ApiPaymentDueRule): PaymentDueRule {
  switch (rule.type) {
    case "FIXED_DATE": return { type: "FIXED_DATE", date: rule.date ?? contractViolation("dueRule.date") };
    case "EVENT_RELATIVE": return {
      type: "EVENT_RELATIVE",
      event: rule.event ?? contractViolation("dueRule.event"),
      offsetDays: rule.offsetDays ?? contractViolation("dueRule.offsetDays"),
      dayBasis: rule.dayBasis ?? contractViolation("dueRule.dayBasis"),
    };
    case "OPERATIONAL_PRECONDITION": return {
      type: "OPERATIONAL_PRECONDITION",
      operation: rule.operation ?? contractViolation("dueRule.operation"),
      leadDays: rule.leadDays ?? contractViolation("dueRule.leadDays"),
    };
    case "MILESTONE": return {
      type: "MILESTONE",
      milestoneCode: rule.milestoneCode ?? contractViolation("dueRule.milestoneCode"),
      offsetDays: rule.offsetDays ?? contractViolation("dueRule.offsetDays"),
    };
    case "RECURRING_FINITE": return {
      type: "RECURRING_FINITE",
      firstDueDate: rule.firstDueDate ?? contractViolation("dueRule.firstDueDate"),
      interval: rule.interval ?? contractViolation("dueRule.interval"),
      count: rule.count ?? contractViolation("dueRule.count"),
    };
  }
}

function projectAgreementSnapshot(document: PaymentAgreementSnapshotDocument): PaymentAgreementSnapshot {
  return {
    version: document.version,
    kind: document.kind,
    currency: document.currency,
    lines: document.lines.map((line) => ({
      id: line.id,
      sequence: line.sequence,
      label: line.label,
      purpose: line.purpose,
      amountRule: projectAmountRule(line.amountRule),
      previewAmount: line.previewAmount,
      dueRule: projectDueRule(line.dueRule),
      allowedMethodCodes: line.allowedMethodCodes,
      preferredMethodCode: line.preferredMethodCode,
      channel: line.channel,
      fulfillmentGate: line.fulfillmentGate,
      invoicePolicyCode: line.invoicePolicyCode,
    })),
    acceptedAt: document.acceptedAt,
    sourceQuoteId: document.sourceQuoteId,
    policyVersion: document.policyVersion,
  };
}

export function projectPaymentAgreementInput(snapshot: PaymentAgreementSnapshot): PaymentAgreementInput {
  return {
    kind: snapshot.kind,
    currency: snapshot.currency,
    lines: snapshot.lines.map((line) => ({
      sequence: line.sequence,
      label: line.label,
      purpose: line.purpose,
      amountRule: line.amountRule,
      dueRule: line.dueRule,
      allowedMethodCodes: line.allowedMethodCodes,
      preferredMethodCode: line.preferredMethodCode,
      channel: line.channel,
      fulfillmentGate: line.fulfillmentGate,
      invoicePolicyCode: line.invoicePolicyCode,
    })),
    policyVersion: snapshot.policyVersion,
  };
}

export function projectPaymentPlan(document: PaymentPlanDocument): PaymentPlan {
  return {
    id: document.id,
    workspaceId: document.workspaceId,
    orderId: document.orderId,
    buyerRef: document.buyerRef,
    version: document.resourceVersion,
    kind: document.kind,
    state: document.state,
    currency: document.currency,
    agreementSnapshot: projectAgreementSnapshot(document.agreementSnapshot),
    scheduleLineIds: document.scheduleLineIds,
    supersedesPlanId: document.supersedesPlanId,
    supersededByPlanId: document.supersededByPlanId,
    evidenceCount: document.evidenceCount,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    activatedAt: document.activatedAt,
    completedAt: document.completedAt,
    cancelledAt: document.cancelledAt,
  };
}

export function projectPaymentScheduleLine(document: PaymentScheduleLineDocument): PaymentScheduleLine {
  return {
    id: document.id,
    workspaceId: document.workspaceId,
    planId: document.planId,
    planVersion: document.planVersion,
    orderId: document.orderId,
    buyerRef: document.buyerRef,
    sequence: document.sequence,
    label: document.label,
    purpose: document.purpose,
    amountRule: projectAmountRule(document.amountRule),
    amount: document.amount,
    dueRule: projectDueRule(document.dueRule),
    resolvedDueDate: document.resolvedDueDate,
    allowedMethodCodes: document.allowedMethodCodes,
    preferredMethodCode: document.preferredMethodCode,
    channel: document.channel,
    fulfillmentGate: document.fulfillmentGate,
    invoicePolicyCode: document.invoicePolicyCode,
    state: document.state,
    satisfiedAmount: document.satisfiedAmount,
    outstandingAmount: document.outstandingAmount,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function projectPaymentPlanPreview(document: PaymentPlanPreviewResponse): PaymentPlanPreview {
  return {
    ready: document.ready,
    orderAmount: document.orderAmount,
    scheduledAmount: document.scheduledAmount,
    remainingAmount: document.remainingAmount,
    resolvedLines: document.resolvedLines.map(projectPaymentScheduleLine),
    warnings: document.warnings,
    blockers: document.blockers,
    version: document.prospectiveVersion,
  };
}

export function projectPaymentIntent(document: PaymentIntentDocument): PaymentIntent {
  return {
    id: document.id,
    workspaceId: document.workspaceId,
    buyerRef: document.buyerRef,
    orderId: document.orderId,
    invoiceIds: document.invoiceIds,
    scheduleLineIds: document.scheduleLineIds,
    amount: document.amount,
    methodCode: document.methodCode,
    providerCode: document.providerCode,
    state: document.state,
    checkoutUrl: document.checkoutUrl,
    expiresAt: document.expiresAt,
    version: document.resourceVersion,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    failureCode: document.failureCode,
    purpose: document.purpose,
  };
}
