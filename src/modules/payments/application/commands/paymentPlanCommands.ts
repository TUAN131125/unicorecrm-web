import { CAPABILITIES, assertRuntimeCapability } from "@/platform/access-control";
import { compareMoney, money, type MoneyDto } from "@/shared/money";
import type { PaymentRepository } from "../ports/PaymentRepository";
import type { PaymentAgreementSnapshot, PaymentPlan, PaymentScheduleLine } from "../../domain/model/paymentPlan.types";
import { buildPaymentPlanPreview, paymentPlanHasFinancialEvidence } from "../../domain/rules/paymentPlanRules";
import { getEffectivePaymentMethodCatalog } from "../queries/effectivePaymentMethodCatalog";
import type { PaymentConfiguration } from "../../domain/model/paymentConfiguration.types";

export interface SavePaymentPlanDraftCommand {
  id: string;
  orderId: string;
  buyerRef: PaymentPlan["buyerRef"];
  version: number;
  agreementSnapshot: PaymentAgreementSnapshot;
  orderAmount: MoneyDto;
  requiresPhysicalShipping: boolean;
  idempotencyKey: string;
  now: string;
}

export function savePaymentPlanDraft(repository: PaymentRepository, command: SavePaymentPlanDraftCommand, configuration?: PaymentConfiguration): { plan: PaymentPlan; lines: PaymentScheduleLine[] } {
  assertRuntimeCapability(CAPABILITIES.PAYMENTS_PLAN_CREATE);
  const existingByKey = repository.listPlans().find((plan) => plan.idempotencyKey === command.idempotencyKey);
  if (existingByKey && existingByKey.id !== command.id) throw new Error("Payment Plan idempotency key already belongs to another plan.");
  const existing = repository.listPlans().find((plan) => plan.id === command.id);
  if (existing?.state === "ACTIVE" && paymentPlanHasFinancialEvidence(existing)) throw new Error("ACTIVE Payment Plan with financial evidence cannot be edited. Supersede it instead.");
  if (existing && existing.state !== "DRAFT") throw new Error(`Only DRAFT Payment Plan can be edited; received ${existing.state}.`);

  const preview = buildPaymentPlanPreview(command.agreementSnapshot, command.orderAmount, getEffectivePaymentMethodCatalog(repository.listPaymentMethods(), configuration), {
    requiresPhysicalShipping: command.requiresPhysicalShipping,
    now: command.now,
    planId: command.id,
    planVersion: command.version,
    orderId: command.orderId,
    buyerRef: command.buyerRef,
  });
  if (!preview.ready) throw new Error(preview.blockers.map((item) => item.code).join(", "));

  const lines = preview.resolvedLines.map((line) => repository.saveScheduleLine({
    ...line,
    planId: command.id,
    planVersion: command.version,
    idempotencyKey: `${command.idempotencyKey}:line:${line.sequence}`,
  }));
  const plan = repository.savePlan({
    id: command.id,
    orderId: command.orderId,
    buyerRef: command.buyerRef,
    version: command.version,
    kind: command.agreementSnapshot.kind,
    state: "DRAFT",
    currency: command.orderAmount.currency,
    agreementSnapshot: structuredClone(command.agreementSnapshot),
    scheduleLineIds: lines.map((line) => line.id),
    evidenceCount: existing?.evidenceCount ?? 0,
    idempotencyKey: command.idempotencyKey,
    createdAt: existing?.createdAt ?? command.now,
    updatedAt: command.now,
  });
  return { plan, lines };
}

export function activatePaymentPlan(repository: PaymentRepository, planId: string, input: { expectedVersion: number; now: string }): PaymentPlan {
  assertRuntimeCapability(CAPABILITIES.PAYMENTS_PLAN_ACTIVATE);
  const current = repository.listPlans().find((plan) => plan.id === planId);
  if (!current) throw new Error(`Payment Plan ${planId} not found.`);
  if (current.version !== input.expectedVersion) throw new Error("PAYMENT_PLAN_VERSION_CONFLICT");
  if (current.state === "ACTIVE") return current;
  if (current.state !== "DRAFT") throw new Error(`Only DRAFT Payment Plan can be activated; received ${current.state}.`);
  if (current.scheduleLineIds.length === 0) throw new Error("PAYMENT_PLAN_LINE_INVALID");
  return repository.savePlan({ ...current, state: "ACTIVE", activatedAt: input.now, updatedAt: input.now });
}

export function supersedePaymentPlan(
  repository: PaymentRepository,
  currentPlanId: string,
  replacement: SavePaymentPlanDraftCommand,
): { superseded: PaymentPlan; replacement: PaymentPlan; lines: PaymentScheduleLine[] } {
  assertRuntimeCapability(CAPABILITIES.PAYMENTS_PLAN_SUPERSEDE);
  const current = repository.listPlans().find((plan) => plan.id === currentPlanId);
  if (!current) throw new Error(`Payment Plan ${currentPlanId} not found.`);
  if (current.state !== "ACTIVE") throw new Error("Only ACTIVE Payment Plan can be superseded.");
  if (replacement.version <= current.version) throw new Error("Replacement Payment Plan version must be greater than the active version.");
  const created = savePaymentPlanDraft(repository, replacement);
  const activated = activatePaymentPlan(repository, created.plan.id, { expectedVersion: created.plan.version, now: replacement.now });
  const superseded = repository.savePlan({ ...current, state: "SUPERSEDED", supersededByPlanId: activated.id, updatedAt: replacement.now });
  const savedReplacement = repository.savePlan({ ...activated, supersedesPlanId: current.id, updatedAt: replacement.now });
  return { superseded, replacement: savedReplacement, lines: created.lines };
}

export function cancelPaymentPlan(repository: PaymentRepository, planId: string, input: { expectedVersion: number; reason: string; now: string }): PaymentPlan {
  assertRuntimeCapability(CAPABILITIES.PAYMENTS_PLAN_SUPERSEDE);
  const current = repository.listPlans().find((plan) => plan.id === planId);
  if (!current) throw new Error(`Payment Plan ${planId} not found.`);
  if (current.version !== input.expectedVersion) throw new Error("PAYMENT_PLAN_VERSION_CONFLICT");
  if (current.state === "CANCELLED") return current;
  if (!input.reason.trim()) throw new Error("Payment Plan cancellation reason is required.");
  if (!["DRAFT", "ACTIVE"].includes(current.state)) throw new Error(`Payment Plan ${planId} cannot be cancelled from ${current.state}.`);
  if (current.evidenceCount > 0) throw new Error("Payment Plan with financial evidence cannot be cancelled directly.");
  for (const line of repository.listScheduleLines().filter((item) => item.planId === current.id && item.state !== "VOIDED")) {
    repository.saveScheduleLine({ ...line, state: "VOIDED", outstandingAmount: money("0", line.outstandingAmount.currency), updatedAt: input.now });
  }
  return repository.savePlan({ ...current, state: "CANCELLED", cancelledAt: input.now, updatedAt: input.now });
}

export function evaluateScheduleGate(repository: PaymentRepository, orderId: string, gate: PaymentScheduleLine["fulfillmentGate"]): { ready: boolean; blockers: string[] } {
  const lines = repository.listScheduleLines().filter((line) => line.orderId === orderId && line.fulfillmentGate === gate && line.state !== "VOIDED");
  const blockers = lines.filter((line) => compareMoney(line.outstandingAmount, money("0", line.outstandingAmount.currency)) > 0).map((line) => `${line.label}: ${line.outstandingAmount.amount} ${line.outstandingAmount.currency}`);
  return { ready: blockers.length === 0, blockers };
}
