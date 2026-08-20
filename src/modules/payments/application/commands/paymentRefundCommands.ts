import { CAPABILITIES, assertRuntimeCapability } from "@/platform/access-control";
import { compareMoney, isPositiveMoney, minMoney, money, subtractMoney, sumMoney, type MoneyDto } from "@/shared/money";
import type { PaymentRepository } from "../ports/PaymentRepository";
import type { CustomerCredit, PaymentRecord, RefundIntent } from "../../domain/model/paymentCollection.types";

export interface CreateRefundIntentCommand {
  id: string;
  sourceReturnId?: string;
  buyerRef: RefundIntent["buyerRef"];
  orderId?: string;
  invoiceIds?: string[];
  paymentRecordId?: string;
  customerCreditId?: string;
  expectedSourceVersion: number;
  amount: MoneyDto;
  reasonCode: string;
  reason: string;
  idempotencyKey: string;
  now: string;
}

function refundedAmountForPayment(repository: PaymentRepository, paymentRecordId: string, currency: string): MoneyDto {
  return sumMoney(
    repository.listPaymentRecords()
      .filter((item) => item.kind === "REFUND" && item.state === "SUCCEEDED" && item.refundOfPaymentRecordId === paymentRecordId)
      .map((item) => item.amount),
    currency,
  );
}

function getRefundSource(repository: PaymentRepository, command: CreateRefundIntentCommand): PaymentRecord | CustomerCredit {
  if (!!command.paymentRecordId === !!command.customerCreditId) throw new Error("Refund Intent requires exactly one Payment or Customer Credit source.");
  const source = command.paymentRecordId
    ? repository.listPaymentRecords().find((item) => item.id === command.paymentRecordId)
    : repository.listCustomerCredits().find((item) => item.id === command.customerCreditId);
  if (!source) throw new Error("REFUND_SOURCE_NOT_FOUND");
  if (source.version !== command.expectedSourceVersion) throw new Error("REFUND_SOURCE_VERSION_CONFLICT");
  if (source.buyerRef.type !== command.buyerRef.type || source.buyerRef.id !== command.buyerRef.id) throw new Error("REFUND_BUYER_MISMATCH");
  return source;
}

export function createRefundIntent(repository: PaymentRepository, command: CreateRefundIntentCommand): RefundIntent {
  assertRuntimeCapability(CAPABILITIES.PAYMENTS_REFUND);
  const replay = repository.listRefundIntents().find((item) => item.idempotencyKey === command.idempotencyKey);
  if (replay) return replay;
  if (!isPositiveMoney(command.amount)) throw new Error("Refund amount must be greater than zero.");
  if (!command.reason.trim()) throw new Error("Refund reason is required.");
  const source = getRefundSource(repository, command);
  let refundable: MoneyDto;
  if ("kind" in source) {
    if (source.kind !== "PAYMENT" || source.state !== "SUCCEEDED") throw new Error("Refund requires a SUCCEEDED Payment source.");
    const afterPriorRefunds = subtractMoney(source.amount, refundedAmountForPayment(repository, source.id, source.amount.currency));
    const allocated = sumMoney(repository.listAllocations()
      .filter((item) => item.paymentRecordId === source.id && item.state === "EFFECTIVE")
      .map((item) => item.amount), source.amount.currency);
    const unallocated = subtractMoney(source.amount, allocated);
    refundable = minMoney(afterPriorRefunds, unallocated);
  } else {
    if (source.state === "REVERSED" || source.state === "ALLOCATED") throw new Error("Customer Credit is not refundable in its current state.");
    refundable = source.availableAmount;
  }
  if (command.amount.currency !== refundable.currency) throw new Error("REFUND_CURRENCY_MISMATCH");
  if (compareMoney(command.amount, refundable) > 0) throw new Error("REFUND_AMOUNT_EXCEEDS_AVAILABLE");
  return repository.saveRefundIntent({
    id: command.id,
    sourceReturnId: command.sourceReturnId,
    buyerRef: command.buyerRef,
    orderId: command.orderId,
    invoiceIds: [...new Set(command.invoiceIds ?? [])],
    paymentRecordId: command.paymentRecordId,
    customerCreditId: command.customerCreditId,
    amount: command.amount,
    state: "CREATED",
    reasonCode: command.reasonCode.trim() || "OTHER",
    reason: command.reason.trim(),
    version: 1,
    idempotencyKey: command.idempotencyKey,
    createdAt: command.now,
    updatedAt: command.now,
  });
}

export interface CompleteRefundIntentCommand {
  expectedVersion: number;
  paymentRecordId: string;
  externalReference?: string;
  occurredAt: string;
  now: string;
}

export function completeRefundIntent(repository: PaymentRepository, refundIntentId: string, command: CompleteRefundIntentCommand): RefundIntent {
  const current = repository.listRefundIntents().find((item) => item.id === refundIntentId);
  if (!current) throw new Error(`Refund Intent ${refundIntentId} not found.`);
  if (current.state === "SUCCEEDED") return current;
  if (current.version !== command.expectedVersion) throw new Error("REFUND_INTENT_VERSION_CONFLICT");
  if (current.state !== "CREATED" && current.state !== "PROCESSING") throw new Error("REFUND_INTENT_NOT_COMPLETABLE");
  const sourcePayment = current.paymentRecordId ? repository.listPaymentRecords().find((item) => item.id === current.paymentRecordId) : undefined;
  const sourceCredit = current.customerCreditId ? repository.listCustomerCredits().find((item) => item.id === current.customerCreditId) : undefined;
  const source = sourcePayment ?? sourceCredit;
  if (!source) throw new Error("REFUND_SOURCE_NOT_FOUND");
  const existingRecord = repository.listPaymentRecords().find((item) => item.refundIntentId === current.id || item.id === command.paymentRecordId);
  const refundRecord = existingRecord ?? repository.savePaymentRecord({
    id: command.paymentRecordId,
    buyerRef: current.buyerRef,
    orderId: current.orderId,
    kind: "REFUND",
    state: "SUCCEEDED",
    amount: current.amount,
    methodCode: sourcePayment?.methodCode ?? "customer-credit-refund",
    channel: sourcePayment?.channel ?? "OFFLINE",
    providerCode: sourcePayment?.providerCode,
    refundOfPaymentRecordId: sourcePayment?.id,
    refundOfCustomerCreditId: sourceCredit?.id,
    refundIntentId: current.id,
    occurredAt: command.occurredAt,
    externalReference: command.externalReference,
    reconciliationState: "UNRECONCILED",
    effectiveForReceivables: false,
    idempotencyKey: `refund-record:${current.id}`,
    version: 1,
    createdAt: command.now,
    updatedAt: command.now,
  });
  if (sourcePayment) repository.savePaymentRecord({ ...sourcePayment, version: sourcePayment.version + 1, updatedAt: command.now });
  if (sourceCredit) {
    const availableAmount = subtractMoney(sourceCredit.availableAmount, current.amount);
    repository.saveCustomerCredit({
      ...sourceCredit,
      availableAmount,
      state: compareMoney(availableAmount, money("0", availableAmount.currency)) === 0 ? "ALLOCATED" : "PARTIALLY_ALLOCATED",
      version: sourceCredit.version + 1,
      updatedAt: command.now,
    });
  }
  return repository.saveRefundIntent({ ...current, state: "SUCCEEDED", refundPaymentRecordId: refundRecord.id, version: current.version + 1, updatedAt: command.now, failureCode: undefined });
}

export function failRefundIntent(repository: PaymentRepository, refundIntentId: string, input: { expectedVersion: number; failureCode: string; now: string }): RefundIntent {
  const current = repository.listRefundIntents().find((item) => item.id === refundIntentId);
  if (!current) throw new Error(`Refund Intent ${refundIntentId} not found.`);
  if (current.version !== input.expectedVersion) throw new Error("REFUND_INTENT_VERSION_CONFLICT");
  if (!input.failureCode.trim()) throw new Error("Refund failure code is required.");
  return repository.saveRefundIntent({ ...current, state: "FAILED", failureCode: input.failureCode.trim(), version: current.version + 1, updatedAt: input.now });
}
