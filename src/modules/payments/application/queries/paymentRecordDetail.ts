import { compareMoney, money, subtractMoney, sumMoney, type MoneyDto } from "@/shared/money";
import type { OperationalAuditEntry } from "@/platform/operational-audit";
import type { PaymentRepository, PaymentRepositorySnapshot } from "../ports/PaymentRepository";
import type { CustomerCredit, InvoicePaymentAllocation, PaymentRecord, RefundIntent } from "../../domain/model/paymentCollection.types";

export interface PaymentRecordDetailDto {
  id: string;
  workspaceId?: string;
  buyerRef: PaymentRecord["buyerRef"];
  orderId?: string;
  amount: MoneyDto;
  methodCode: string;
  channelCode: PaymentRecord["channel"];
  status: PaymentRecord["state"];
  receivedAt?: string;
  reference?: string;
  evidence: NonNullable<PaymentRecord["evidence"]>;
  allocations: InvoicePaymentAllocation[];
  customerCredits: CustomerCredit[];
  refunds: RefundIntent[];
  refundableAmount: MoneyDto;
  unallocatedAmount: MoneyDto;
  reconciliationState: PaymentRecord["reconciliationState"];
  audit: OperationalAuditEntry[];
  version: number;
}

const snapshotOf = (source: PaymentRepository | PaymentRepositorySnapshot): PaymentRepositorySnapshot => "snapshot" in source ? source.snapshot() : source;

export function getPaymentRecordDetail(source: PaymentRepository | PaymentRepositorySnapshot, paymentRecordId: string, audit: OperationalAuditEntry[] = []): PaymentRecordDetailDto | undefined {
  const snapshot = snapshotOf(source);
  const record = snapshot.paymentRecords.find((item) => item.id === paymentRecordId);
  if (!record) return undefined;
  const allocations = snapshot.allocations.filter((item) => item.paymentRecordId === record.id);
  const effectiveAllocated = sumMoney(allocations.filter((item) => item.state === "EFFECTIVE").map((item) => item.amount), record.amount.currency);
  const refunded = sumMoney(snapshot.paymentRecords.filter((item) => item.kind === "REFUND" && item.state === "SUCCEEDED" && item.refundOfPaymentRecordId === record.id).map((item) => item.amount), record.amount.currency);
  const consumed = sumMoney([effectiveAllocated, refunded], record.amount.currency);
  const zero = money("0", record.amount.currency);
  const unallocatedAmount = compareMoney(consumed, record.amount) >= 0 ? zero : subtractMoney(record.amount, consumed);
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    buyerRef: record.buyerRef,
    orderId: record.orderId,
    amount: record.amount,
    methodCode: record.methodCode,
    channelCode: record.channel,
    status: record.state,
    receivedAt: record.state === "SUCCEEDED" ? record.occurredAt : undefined,
    reference: record.externalReference,
    evidence: structuredClone(record.evidence ?? []),
    allocations: structuredClone(allocations),
    customerCredits: snapshot.customerCredits.filter((item) => item.sourcePaymentRecordId === record.id),
    refunds: snapshot.refundIntents.filter((item) => item.paymentRecordId === record.id),
    refundableAmount: record.kind === "PAYMENT" && record.state === "SUCCEEDED" ? unallocatedAmount : zero,
    unallocatedAmount,
    reconciliationState: record.reconciliationState,
    audit: structuredClone(audit),
    version: record.version,
  };
}
