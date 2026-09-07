import type { BuyerRef } from "@/platform/identity";
import { CAPABILITIES, assertRuntimeCommandAccess, assertRuntimeCapability } from "@/platform/access-control";
import { recordOperationalAudit } from "@/platform/operational-audit";
import type { PaymentRepository } from "../ports/PaymentRepository";
import type {
  PaymentAllocation,
  PaymentDueRule,
  PaymentFulfillmentGate,
  PaymentMethod,
  PaymentObligation,
  PaymentPlanType,
  PaymentPurpose,
  PaymentTerm,
  PaymentTiming,
  PaymentTransaction,
} from "../../domain/model/payment.types";
import { paymentValidationError } from "../../domain/rules/paymentValidation";

export interface PaymentPlanLineInput {
  id: string;
  label?: string;
  amountDue: number;
  currency: string;
  method: PaymentMethod;
  allowedMethods?: PaymentMethod[];
  term: PaymentTerm;
  planType?: PaymentPlanType;
  sequence?: number;
  purpose?: PaymentPurpose;
  timing?: PaymentTiming;
  dueRule?: PaymentDueRule;
  dueDate?: string;
  fulfillmentGate?: PaymentFulfillmentGate;
  idempotencyKey: string;
}

export interface SavePaymentPlanCommand {
  orderId: string;
  buyerRef: BuyerRef;
  lines: PaymentPlanLineInput[];
  fulfillmentContext?: { requiresPhysicalShipping: boolean };
  planId?: string;
  planVersion?: number;
  planType?: PaymentPlanType;
  actorId?: string;
  actorName?: string;
  now?: string;
}

export interface RecordPaymentCommand {
  id: string;
  orderId: string;
  buyerRef: BuyerRef;
  amount: number;
  currency: string;
  occurredAt: string;
  allocations?: PaymentAllocation[];
  allowUnappliedCredit?: boolean;
  method?: PaymentMethod;
  termSnapshot?: PaymentTerm;
  source?: PaymentTransaction["source"];
  externalReference?: string;
  providerId?: string;
  paymentChannelId?: string;
  carrierReference?: string;
  codCollectionState?: PaymentTransaction["codCollectionState"];
  correlationId?: string;
  idempotencyKey?: string;
  actorId?: string;
  actorName?: string;
}

function validatePayment(command: RecordPaymentCommand): void {
  if (!command.orderId) throw paymentValidationError("ORDER_REQUIRED", "orderId", "Select an Order.");
  if (!command.buyerRef?.id) throw paymentValidationError("BUYER_REQUIRED", "buyerRef", "The selected Order has no canonical buyer.");
  if (!Number.isFinite(command.amount) || !(command.amount > 0)) throw paymentValidationError("AMOUNT_INVALID", "amount", "Payment amount must be a finite number greater than zero.");
  if (!command.currency.trim()) throw paymentValidationError("CURRENCY_REQUIRED", "currency", "Payment currency is required.");
}

function findReplay(repository: PaymentRepository, key?: string): PaymentTransaction | undefined {
  return key ? repository.listTransactions().find((transaction) => transaction.idempotencyKey === key) : undefined;
}

function audit(action: string, transaction: PaymentTransaction, command: RecordPaymentCommand, before?: unknown): void {
  recordOperationalAudit({ moduleKey: "payments", recordId: transaction.id, action, actorId: command.actorId ?? "system", actorName: command.actorName, correlationId: command.correlationId, before, after: transaction });
}

function deriveObligationStatus(amountPaid: number, amountDue: number, dueDate?: string, now = new Date().toISOString()): PaymentObligation["status"] {
  if (amountPaid >= amountDue) return "SETTLED";
  if (dueDate && dueDate < now.slice(0, 10)) return "OVERDUE";
  return amountPaid > 0 ? "PARTIAL" : "OPEN";
}

function deriveTimingFromTerm(term: PaymentTerm): PaymentTiming {
  return term === "POSTPAID" ? "POSTPAID" : "PREPAID";
}

function derivePurposeFromTerm(term: PaymentTerm): PaymentPurpose {
  return term === "DEPOSIT" ? "DEPOSIT" : term === "POSTPAID" ? "BALANCE" : "FULL";
}

function deriveFulfillmentGateFromTerm(term: PaymentTerm): PaymentFulfillmentGate {
  return term === "POSTPAID" ? "NONE" : term === "DEPOSIT" ? "BEFORE_BOOKING" : "BEFORE_COMPLETION";
}

export function savePaymentPlan(repository: PaymentRepository, command: SavePaymentPlanCommand): PaymentObligation[] {
  assertRuntimeCapability(CAPABILITIES.PAYMENTS_PLAN_UPDATE_DRAFT);
  if (!command.orderId) throw new Error("Payment plan requires an Order.");
  if (!command.buyerRef?.id) throw new Error("Payment plan requires a canonical buyerRef.");
  const hasCod = command.lines.some((line) => line.method === "COD");
  if (hasCod && !command.fulfillmentContext) throw new Error("COD payment plan requires explicit physical-shipping context.");
  if (hasCod && !command.fulfillmentContext?.requiresPhysicalShipping) throw new Error("COD is only available for Orders with physical shipping.");
  if (command.lines.some((line) => line.method === "COD" && line.timing !== "ON_DELIVERY")) {
    throw new Error("COD obligations must be collected ON_DELIVERY.");
  }
  if (command.lines.some((line) => line.method === "COD" && line.fulfillmentGate !== "NONE")) {
    throw new Error("COD obligations must not block shipping booking or Order completion.");
  }
  const ids = new Set<string>();
  const keys = new Set<string>();
  const now = command.now ?? new Date().toISOString();
  const all = repository.listObligations();
  const currentForOrder = all.filter((item) => item.orderId === command.orderId && item.status !== "VOIDED");

  command.lines.forEach((line) => {
    if (!line.id || ids.has(line.id)) throw new Error("Payment plan line IDs must be unique.");
    if (!line.idempotencyKey || keys.has(line.idempotencyKey)) throw new Error("Payment plan idempotency keys must be unique.");
    if (!(line.amountDue > 0)) throw new Error("Payment obligation amountDue must be greater than zero.");
    if (!line.currency.trim()) throw new Error("Payment obligation currency is required.");
    const keyOwner = all.find((item) => item.idempotencyKey === line.idempotencyKey && item.id !== line.id);
    if (keyOwner) throw new Error(`Payment plan idempotency key already belongs to obligation ${keyOwner.id}.`);
    const existing = all.find((item) => item.id === line.id);
    if (existing && existing.orderId !== command.orderId) throw new Error("Payment obligation belongs to another Order.");
    if (existing && existing.amountPaid > line.amountDue) throw new Error("Cannot reduce a payment obligation below the amount already paid. Use an adjustment instead.");
    ids.add(line.id);
    keys.add(line.idempotencyKey);
  });

  const requestedIds = new Set(command.lines.map((line) => line.id));
  currentForOrder.filter((item) => !requestedIds.has(item.id)).forEach((item) => {
    if (item.amountPaid > 0) {
      throw new Error(`Cannot remove payment obligation ${item.id} because it already has payment allocation.`);
    }
    const voided = repository.saveObligation({ ...item, amountOutstanding: 0, status: "VOIDED", voidedAt: now, voidReason: "Removed from active payment plan", updatedAt: now });
    recordOperationalAudit({ moduleKey: "payments", recordId: voided.id, action: "PaymentObligationVoided", actorId: command.actorId ?? "system", actorName: command.actorName, before: item, after: voided });
  });

  return command.lines.map((line, index) => {
    const existing = all.find((item) => item.id === line.id);
    const amountPaid = existing?.amountPaid ?? 0;
    const obligation: PaymentObligation = {
      id: line.id,
      orderId: command.orderId,
      buyerRef: command.buyerRef,
      planId: command.planId ?? existing?.planId ?? `payment-plan:${command.orderId}`,
      planVersion: command.planVersion ?? Math.max(existing?.planVersion ?? 0, 1),
      planType: line.planType ?? command.planType ?? existing?.planType ?? "CUSTOM",
      sequence: line.sequence ?? index + 1,
      label: line.label,
      purpose: line.purpose ?? existing?.purpose ?? derivePurposeFromTerm(line.term),
      timing: line.timing ?? existing?.timing ?? deriveTimingFromTerm(line.term),
      amountDue: line.amountDue,
      amountPaid,
      amountOutstanding: Math.max(0, line.amountDue - amountPaid),
      currency: line.currency,
      method: line.method,
      allowedMethods: line.allowedMethods?.length ? [...new Set(line.allowedMethods)] : [line.method],
      term: line.term,
      dueRule: line.dueRule ?? (line.dueDate ? { type: "FIXED_DATE", fixedDate: line.dueDate } : existing?.dueRule),
      dueDate: line.dueDate,
      fulfillmentGate: line.fulfillmentGate ?? existing?.fulfillmentGate ?? deriveFulfillmentGateFromTerm(line.term),
      status: deriveObligationStatus(amountPaid, line.amountDue, line.dueDate, now),
      idempotencyKey: line.idempotencyKey,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const saved = repository.saveObligation(obligation);
    recordOperationalAudit({ moduleKey: "payments", recordId: saved.id, action: existing ? "PaymentObligationUpdated" : "PaymentObligationPlanned", actorId: command.actorId ?? "system", actorName: command.actorName, before: existing, after: saved });
    return saved;
  });
}

function activeObligationsForOrder(repository: PaymentRepository, orderId: string): PaymentObligation[] {
  return repository.listObligations()
    .filter((item) => item.orderId === orderId && item.status !== "VOIDED" && item.amountOutstanding > 0)
    .sort((a, b) => (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") || (a.sequence ?? 999).valueOf() - (b.sequence ?? 999).valueOf());
}

function resolveAllocations(repository: PaymentRepository, command: RecordPaymentCommand): { allocations: PaymentAllocation[]; unappliedAmount: number } {
  const obligations = repository.listObligations();
  let requested = command.allocations?.map((allocation) => ({ ...allocation })) ?? [];

  if (!requested.length) {
    let remaining = command.amount;
    requested = activeObligationsForOrder(repository, command.orderId).flatMap((obligation) => {
      if (remaining <= 0) return [];
      const amount = Math.min(remaining, obligation.amountOutstanding);
      remaining -= amount;
      return amount > 0 ? [{ obligationId: obligation.id, amount }] : [];
    });
  }

  const seen = new Set<string>();
  let allocatedTotal = 0;
  for (const allocation of requested) {
    if (!allocation.obligationId || seen.has(allocation.obligationId)) throw paymentValidationError("ALLOCATION_DUPLICATE", "obligationId", "Payment allocations must reference unique obligations.");
    if (!(allocation.amount > 0)) throw paymentValidationError("ALLOCATION_AMOUNT_INVALID", "amount", "Payment allocation amount must be greater than zero.");
    const obligation = obligations.find((item) => item.id === allocation.obligationId);
    if (!obligation) throw paymentValidationError("OBLIGATION_NOT_FOUND", "obligationId", `Payment obligation ${allocation.obligationId} was not found.`);
    if (obligation.orderId !== command.orderId) throw paymentValidationError("OBLIGATION_ORDER_MISMATCH", "obligationId", "Payment obligation belongs to another Order.");
    if (obligation.status === "VOIDED") throw paymentValidationError("OBLIGATION_VOIDED", "obligationId", "Cannot allocate payment to a voided obligation.");
    if (obligation.currency !== command.currency) throw paymentValidationError("CURRENCY_MISMATCH", "currency", "Payment currency must match the obligation currency.");
    if (allocation.amount > obligation.amountOutstanding) throw paymentValidationError(
      "AMOUNT_EXCEEDS_OUTSTANDING",
      "amount",
      `Amount exceeds the obligation outstanding balance by ${allocation.amount - obligation.amountOutstanding} ${command.currency}.`,
      { outstandingAmount: obligation.amountOutstanding, overageAmount: allocation.amount - obligation.amountOutstanding, obligationId: obligation.id },
    );
    seen.add(allocation.obligationId);
    allocatedTotal += allocation.amount;
  }
  if (allocatedTotal > command.amount) throw paymentValidationError("ALLOCATIONS_EXCEED_PAYMENT", "amount", "Total payment allocations exceed the transaction amount.");
  const unappliedAmount = command.amount - allocatedTotal;
  if (unappliedAmount > 0 && !command.allowUnappliedCredit) {
    throw paymentValidationError("AMOUNT_EXCEEDS_ALLOCATABLE", "amount", "Payment amount exceeds the allocatable outstanding balance. Reduce the amount or explicitly record unapplied credit.", { overageAmount: unappliedAmount });
  }
  return { allocations: requested, unappliedAmount };
}

function applySucceededAllocations(repository: PaymentRepository, transaction: PaymentTransaction): void {
  for (const allocation of transaction.allocations ?? []) {
    const obligation = repository.listObligations().find((item) => item.id === allocation.obligationId);
    if (!obligation) throw new Error(`Payment obligation ${allocation.obligationId} not found.`);
    const amountPaid = obligation.amountPaid + allocation.amount;
    repository.saveObligation({
      ...obligation,
      amountPaid,
      amountOutstanding: Math.max(0, obligation.amountDue - amountPaid),
      status: deriveObligationStatus(amountPaid, obligation.amountDue, obligation.dueDate, transaction.occurredAt),
      updatedAt: transaction.occurredAt,
    });
  }
}

export function recordSucceededPayment(repository: PaymentRepository, command: RecordPaymentCommand): PaymentTransaction {
  assertRuntimeCapability(CAPABILITIES.PAYMENTS_RECORD_MANUAL);
  validatePayment(command);
  const replay = findReplay(repository, command.idempotencyKey);
  if (replay) return replay;
  const { allocations, unappliedAmount } = resolveAllocations(repository, command);
  const primary = allocations.length === 1 ? repository.listObligations().find((item) => item.id === allocations[0].obligationId) : undefined;
  const saved = repository.saveTransaction({
    id: command.id,
    orderId: command.orderId,
    buyerRef: command.buyerRef,
    kind: "PAYMENT",
    status: "SUCCEEDED",
    amount: command.amount,
    currency: command.currency,
    occurredAt: command.occurredAt,
    source: command.source ?? "MANUAL",
    method: command.method ?? primary?.method,
    termSnapshot: command.termSnapshot ?? primary?.term,
    allocations,
    unappliedAmount,
    externalReference: command.externalReference,
    providerId: command.providerId,
    paymentChannelId: command.paymentChannelId,
    carrierReference: command.carrierReference,
    codCollectionState: command.codCollectionState,
    codCollectedAt: command.codCollectionState === "COLLECTED" || command.codCollectionState === "REMITTED" ? command.occurredAt : undefined,
    codRemittedAt: command.codCollectionState === "REMITTED" ? command.occurredAt : undefined,
    reconciliationState: "UNRECONCILED",
    correlationId: command.correlationId,
    idempotencyKey: command.idempotencyKey,
  });
  applySucceededAllocations(repository, saved);
  audit("PaymentSucceeded", saved, command);
  return saved;
}

export function recordFailedPayment(repository: PaymentRepository, command: RecordPaymentCommand & { failureReason: string }): PaymentTransaction {
  assertRuntimeCapability(CAPABILITIES.PAYMENTS_RECORD_MANUAL);
  validatePayment(command);
  if (!command.failureReason.trim()) throw new Error("Failed Payment requires a reason.");
  const existing = findReplay(repository, command.idempotencyKey);
  if (existing) return existing;
  const saved = repository.saveTransaction({
    id: command.id, orderId: command.orderId, buyerRef: command.buyerRef, kind: "PAYMENT", status: "FAILED", amount: command.amount,
    currency: command.currency, occurredAt: command.occurredAt, source: command.source ?? "MANUAL",
    method: command.method, termSnapshot: command.termSnapshot, allocations: command.allocations, externalReference: command.externalReference, failureReason: command.failureReason.trim(),
    reconciliationState: "UNRECONCILED", correlationId: command.correlationId, idempotencyKey: command.idempotencyKey,
  });
  audit("PaymentFailed", saved, command);
  return saved;
}

export interface RecordRefundCommand extends RecordPaymentCommand { refundOfTransactionId: string; }

export function recordSucceededRefund(repository: PaymentRepository, command: RecordRefundCommand): PaymentTransaction {
  assertRuntimeCapability(CAPABILITIES.PAYMENTS_REFUND);
  validatePayment(command);
  const source = repository.listTransactions().find((transaction) => transaction.id === command.refundOfTransactionId);
  if (!source || source.kind !== "PAYMENT" || source.status !== "SUCCEEDED") throw new Error("Refund requires an existing successful payment transaction.");
  if (source.orderId !== command.orderId) throw new Error("Refund must reference a payment from the same Order.");
  const existingRefundTotal = repository.listTransactions().filter((transaction) => transaction.kind === "REFUND" && transaction.status === "SUCCEEDED" && transaction.refundOfTransactionId === source.id).reduce((sum, transaction) => sum + transaction.amount, 0);
  if (existingRefundTotal + command.amount > source.amount) throw new Error("Refund amount exceeds the remaining refundable amount.");
  const existing = findReplay(repository, command.idempotencyKey);
  if (existing) return existing;
  const saved = repository.saveTransaction({
    id: command.id, orderId: command.orderId, buyerRef: command.buyerRef, kind: "REFUND", status: "SUCCEEDED", amount: command.amount,
    currency: command.currency, occurredAt: command.occurredAt, source: command.source ?? "MANUAL",
    method: command.method ?? source.method, termSnapshot: source.termSnapshot,
    externalReference: command.externalReference, refundOfTransactionId: command.refundOfTransactionId, reconciliationState: "UNRECONCILED",
    correlationId: command.correlationId, idempotencyKey: command.idempotencyKey,
  });
  audit("RefundSucceeded", saved, command);
  return saved;
}

export function retryFailedPayment(repository: PaymentRepository, failedTransactionId: string, command: RecordPaymentCommand): PaymentTransaction {
  assertRuntimeCapability(CAPABILITIES.PAYMENTS_RECORD_MANUAL);
  const failed = repository.listTransactions().find((transaction) => transaction.id === failedTransactionId);
  if (!failed || failed.kind !== "PAYMENT" || failed.status !== "FAILED") throw new Error("Payment retry requires a failed payment transaction.");
  if (failed.orderId !== command.orderId) throw new Error("Payment retry must remain on the same Order.");
  const saved = recordSucceededPayment(repository, {
    ...command,
    allocations: command.allocations ?? failed.allocations,
    method: command.method ?? failed.method,
    termSnapshot: command.termSnapshot ?? failed.termSnapshot,
  });
  const retried = repository.saveTransaction({ ...saved, retryOfTransactionId: failed.id });
  audit("PaymentRetried", retried, command, failed);
  return retried;
}

export function markCodRemitted(repository: PaymentRepository, transactionId: string, input: { carrierReference?: string; actorId: string; actorName?: string; now?: string }): PaymentTransaction {
  const current = repository.listTransactions().find((transaction) => transaction.id === transactionId);
  if (!current || current.kind !== "PAYMENT" || current.status !== "SUCCEEDED" || current.method !== "COD") throw new Error("COD remittance requires a successful COD payment transaction.");
  assertRuntimeCommandAccess(CAPABILITIES.PAYMENTS_RECONCILE, "payments", current);
  if (current.codCollectionState !== "COLLECTED" && current.codCollectionState !== "REMITTED") throw new Error("COD must be collected before remittance.");
  const now = input.now ?? new Date().toISOString();
  const saved = repository.saveTransaction({ ...current, codCollectionState: "REMITTED", codRemittedAt: now, carrierReference: input.carrierReference ?? current.carrierReference });
  recordOperationalAudit({ moduleKey: "payments", recordId: saved.id, action: "CodRemitted", actorId: input.actorId, actorName: input.actorName, before: current, after: saved });
  return saved;
}

export function reconcilePayment(repository: PaymentRepository, transactionId: string, input: { state: "MATCHED" | "MISMATCH"; note?: string; actorId: string; actorName?: string; now?: string }): PaymentTransaction {
  const current = repository.listTransactions().find((transaction) => transaction.id === transactionId);
  if (!current) throw new Error(`Payment transaction ${transactionId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.PAYMENTS_RECONCILE, "payments", current);
  const saved = repository.saveTransaction({ ...current, reconciliationState: input.state, reconciliationNote: input.note?.trim() || undefined, reconciledAt: input.now ?? new Date().toISOString(), reconciledBy: input.actorId });
  recordOperationalAudit({ moduleKey: "payments", recordId: saved.id, action: "PaymentReconciled", actorId: input.actorId, actorName: input.actorName, before: current, after: saved });
  return saved;
}
