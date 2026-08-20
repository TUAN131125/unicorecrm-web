import { CAPABILITIES, assertRuntimeCapability } from "@/platform/access-control";
import { addMoney, compareMoney, isPositiveMoney, money, subtractMoney, sumMoney, type MoneyDto } from "@/shared/money";
import type { PaymentRepository } from "../ports/PaymentRepository";
import type { CustomerCredit, InvoicePaymentAllocation, PaymentRecord } from "../../domain/model/paymentCollection.types";
import { getEffectivePaymentMethodCatalog } from "../queries/effectivePaymentMethodCatalog";
import type { PaymentConfiguration } from "../../domain/model/paymentConfiguration.types";

export interface InvoiceAllocationTarget {
  invoiceId: string;
  buyerRef: InvoicePaymentAllocation["buyerRef"];
  outstandingAmount: MoneyDto;
  version: number;
}

export interface RecordManualPaymentCommand {
  id: string;
  buyerRef: PaymentRecord["buyerRef"];
  orderId?: string;
  amount: MoneyDto;
  methodCode: string;
  channel: PaymentRecord["channel"];
  occurredAt: string;
  externalReference?: string;
  evidenceMetadata?: Record<string, string>;
  idempotencyKey: string;
  now: string;
  allowUnapplied: boolean;
  customerCreditId?: string;
}

export function recordManualPayment(repository: PaymentRepository, command: RecordManualPaymentCommand, configuration?: PaymentConfiguration): { payment: PaymentRecord; customerCredit?: CustomerCredit } {
  assertRuntimeCapability(CAPABILITIES.PAYMENTS_RECORD_MANUAL);
  const replay = repository.listPaymentRecords().find((item) => item.idempotencyKey === command.idempotencyKey);
  if (replay) return { payment: replay, customerCredit: repository.listCustomerCredits().find((credit) => credit.sourcePaymentRecordId === replay.id) };
  if (!isPositiveMoney(command.amount)) throw new Error("Payment amount must be greater than zero.");
  const method = getEffectivePaymentMethodCatalog(repository.listPaymentMethods(), configuration).find((item) => item.code === command.methodCode && item.enabled && item.supportsManualRecording);
  if (!method) throw new Error("PAYMENT_METHOD_DISABLED");
  const isCod = method.kind === "COD";
  if (isCod && !command.evidenceMetadata?.customerCollectionEvidenceId?.trim()) throw new Error("COD_COLLECTION_EVIDENCE_REQUIRED");
  if (isCod && command.channel !== "CARRIER") throw new Error("COD payment evidence must use the CARRIER channel.");
  if (isCod && command.allowUnapplied) throw new Error("COD_CUSTOMER_CREDIT_REQUIRES_REMITTANCE");
  const payment = repository.savePaymentRecord({
    id: command.id,
    buyerRef: command.buyerRef,
    orderId: command.orderId,
    kind: "PAYMENT",
    state: "SUCCEEDED",
    amount: command.amount,
    methodCode: command.methodCode,
    channel: command.channel,
    occurredAt: command.occurredAt,
    externalReference: command.externalReference,
    evidenceMetadata: command.evidenceMetadata,
    reconciliationState: "UNRECONCILED",
    codCustomerCollectionState: isCod ? "COLLECTED" : undefined,
    codMerchantRemittanceState: isCod ? "PENDING" : undefined,
    effectiveForReceivables: isCod ? false : undefined,
    idempotencyKey: command.idempotencyKey,
    version: 1,
    createdAt: command.now,
    updatedAt: command.now,
  });
  if (!command.allowUnapplied) return { payment };
  if (!command.customerCreditId) throw new Error("Customer Credit ID is required when unapplied amount is allowed.");
  const customerCredit = repository.saveCustomerCredit({
    id: command.customerCreditId,
    buyerRef: command.buyerRef,
    sourcePaymentRecordId: payment.id,
    originalAmount: command.amount,
    availableAmount: command.amount,
    state: "AVAILABLE",
    version: 1,
    createdAt: command.now,
    updatedAt: command.now,
  });
  return { payment, customerCredit };
}

export interface AllocatePaymentCommand {
  allocations: Array<{ id: string; invoice: InvoiceAllocationTarget; amount: MoneyDto; scheduleLineId?: string; idempotencyKey: string }>;
  paymentRecordId?: string;
  customerCreditId?: string;
  expectedSourceVersion: number;
  now: string;
}

export function allocatePaymentToInvoices(repository: PaymentRepository, command: AllocatePaymentCommand, configuration?: PaymentConfiguration): { allocations: InvoicePaymentAllocation[]; remainingAmount: MoneyDto } {
  assertRuntimeCapability(CAPABILITIES.PAYMENTS_ALLOCATE);
  if (!!command.paymentRecordId === !!command.customerCreditId) throw new Error("Allocation requires exactly one payment or customer-credit source.");
  if (command.allocations.length === 0) throw new Error("At least one allocation is required.");

  const existingByIdempotencyKey = new Map(repository.listAllocations().map((item) => [item.idempotencyKey, item]));
  const replayed = command.allocations.map((item) => existingByIdempotencyKey.get(item.idempotencyKey));
  if (replayed.some(Boolean)) {
    if (!replayed.every(Boolean)) throw new Error("PAYMENT_ALLOCATION_PARTIAL_IDEMPOTENCY_REPLAY");
    const allocations = replayed as InvoicePaymentAllocation[];
    const source = command.paymentRecordId
      ? repository.listPaymentRecords().find((item) => item.id === command.paymentRecordId)
      : repository.listCustomerCredits().find((item) => item.id === command.customerCreditId);
    if (!source) throw new Error("Allocation source was not found.");
    const remainingAmount = "availableAmount" in source
      ? source.availableAmount
      : subtractMoney(source.amount, sumMoney(repository.listAllocations()
        .filter((item) => item.paymentRecordId === source.id && item.state === "EFFECTIVE")
        .map((item) => item.amount), source.amount.currency));
    return { allocations, remainingAmount };
  }

  const payment = command.paymentRecordId ? repository.listPaymentRecords().find((item) => item.id === command.paymentRecordId) : undefined;
  const credit = command.customerCreditId ? repository.listCustomerCredits().find((item) => item.id === command.customerCreditId) : undefined;
  const sourceBuyer = payment?.buyerRef ?? credit?.buyerRef;
  const sourceVersion = payment?.version ?? credit?.version;
  if (!sourceBuyer) throw new Error("Allocation source was not found.");
  if (sourceVersion !== command.expectedSourceVersion) throw new Error("PAYMENT_SOURCE_VERSION_CONFLICT");
  if (payment && (payment.state !== "SUCCEEDED" || payment.effectiveForReceivables === false)) throw new Error("Only effective SUCCEEDED Payment can be allocated.");
  if (payment) {
    const method = getEffectivePaymentMethodCatalog(repository.listPaymentMethods(), configuration).find((item) => item.code === payment.methodCode);
    if (method?.kind === "COD" && (payment.codMerchantRemittanceState !== "REMITTED" || payment.effectiveForReceivables !== true)) {
      throw new Error("COD_PAYMENT_REMITTANCE_REQUIRED");
    }
  }
  if (payment && repository.listCustomerCredits().some((item) => item.sourcePaymentRecordId === payment.id && item.state !== "REVERSED")) throw new Error("Payment was converted to Customer Credit and must be allocated through that credit source.");

  const paymentAllocated = payment
    ? sumMoney(repository.listAllocations()
      .filter((item) => item.paymentRecordId === payment.id && item.state === "EFFECTIVE")
      .map((item) => item.amount), payment.amount.currency)
    : undefined;
  const sourceAmount = payment
    ? subtractMoney(payment.amount, paymentAllocated ?? money("0", payment.amount.currency))
    : credit?.availableAmount;
  if (!sourceAmount) throw new Error("Allocation source was not found.");

  const total = sumMoney(command.allocations.map((item) => item.amount), sourceAmount.currency);
  if (compareMoney(total, sourceAmount) > 0) throw new Error("PAYMENT_AMOUNT_EXCEEDS_AVAILABLE");
  for (const item of command.allocations) {
    if (!isPositiveMoney(item.amount)) throw new Error("Allocation amount must be greater than zero.");
    if (item.invoice.buyerRef.type !== sourceBuyer.type || item.invoice.buyerRef.id !== sourceBuyer.id) throw new Error("Payment and Invoice buyer must match.");
    if (item.amount.currency !== sourceAmount.currency || item.invoice.outstandingAmount.currency !== sourceAmount.currency) throw new Error("PAYMENT_ALLOCATION_CURRENCY_MISMATCH");
    if (compareMoney(item.amount, item.invoice.outstandingAmount) > 0) throw new Error("PAYMENT_ALLOCATION_EXCEEDS_OUTSTANDING");
  }

  const saved = command.allocations.map((item) => repository.saveAllocation({
    id: item.id,
    buyerRef: sourceBuyer,
    invoiceId: item.invoice.invoiceId,
    paymentRecordId: payment?.id,
    customerCreditId: credit?.id,
    scheduleLineId: item.scheduleLineId,
    amount: item.amount,
    state: "EFFECTIVE",
    idempotencyKey: item.idempotencyKey,
    version: 1,
    createdAt: command.now,
  }));
  const remainingAmount = subtractMoney(sourceAmount, total);
  if (payment) repository.savePaymentRecord({ ...payment, version: payment.version + 1, updatedAt: command.now });
  if (credit) repository.saveCustomerCredit({ ...credit, availableAmount: remainingAmount, state: compareMoney(remainingAmount, money("0", remainingAmount.currency)) === 0 ? "ALLOCATED" : "PARTIALLY_ALLOCATED", version: credit.version + 1, updatedAt: command.now });
  return { allocations: saved, remainingAmount };
}

export function reverseInvoiceAllocation(repository: PaymentRepository, allocationId: string, input: { expectedVersion: number; now: string; reasonCode?: string; reason?: string; actorId?: string }): InvoicePaymentAllocation {
  assertRuntimeCapability(CAPABILITIES.PAYMENTS_REVERSE_ALLOCATION);
  const current = repository.listAllocations().find((item) => item.id === allocationId);
  if (!current) throw new Error(`Allocation ${allocationId} not found.`);
  if (current.version !== input.expectedVersion) throw new Error("PAYMENT_ALLOCATION_VERSION_CONFLICT");
  if (current.state === "REVERSED") return current;
  const reasonCode = input.reasonCode?.trim() || "SYSTEM_REVERSAL";
  const reason = input.reason?.trim() || "Allocation reversed by an authoritative workflow.";
  const saved = repository.saveAllocation({ ...current, state: "REVERSED", reversedAt: input.now, reversalReasonCode: reasonCode, reversalReason: reason, reversedBy: input.actorId, version: current.version + 1 });
  if (current.customerCreditId) {
    const credit = repository.listCustomerCredits().find((item) => item.id === current.customerCreditId);
    if (credit) repository.saveCustomerCredit({ ...credit, availableAmount: addMoney(credit.availableAmount, current.amount), state: "AVAILABLE", version: credit.version + 1, updatedAt: input.now });
  }
  if (current.paymentRecordId) {
    const payment = repository.listPaymentRecords().find((item) => item.id === current.paymentRecordId);
    if (payment) repository.savePaymentRecord({ ...payment, version: payment.version + 1, updatedAt: input.now });
  }
  return saved;
}
