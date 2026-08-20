import assert from "node:assert/strict";
import { money } from "@/shared/money";
import { InMemoryPaymentRepository } from "@/modules/payments/infrastructure/InMemoryPaymentRepository";
import { PAYMENT_METHOD_CATALOG } from "@/modules/payments/infrastructure/paymentCatalog.seed";
import {
  allocatePaymentToInvoices,
  recordManualPayment,
} from "@/modules/payments/application/commands/paymentAllocationCommands";
import {
  recordCodCustomerCollectionEvidence,
  recordCodMerchantRemittanceEvidence,
} from "@/modules/payments/application/commands/paymentCodCommands";
const now = "2026-07-15T00:00:00.000Z"; const buyerRef = { type: "ORGANIZATION_ACCOUNT", id: "buyer" } as const;
const payment = { id: "pay", buyerRef, kind: "PAYMENT" as const, state: "SUCCEEDED" as const, amount: money("100", "VND"), methodCode: "bank-transfer", channel: "BANK" as const, occurredAt: now, reconciliationState: "MATCHED" as const, effectiveForReceivables: true, idempotencyKey: "pay", version: 1, createdAt: now, updatedAt: now };
const repo = new InMemoryPaymentRepository({ paymentRecords: [payment] });
const target = (invoiceId: string, amount: string, id: string) => ({ id, invoice: { invoiceId, buyerRef, outstandingAmount: money(amount, "VND"), version: 1 }, amount: money(amount, "VND"), idempotencyKey: id });
const result = allocatePaymentToInvoices(repo, { paymentRecordId: payment.id, expectedSourceVersion: 1, now, allocations: [target("inv-1", "40", "a1"), target("inv-2", "50", "a2")] });
assert.equal(result.allocations.length, 2); assert.equal(result.remainingAmount.amount, "10");
assert.throws(() => allocatePaymentToInvoices(repo, { paymentRecordId: payment.id, expectedSourceVersion: 2, now, allocations: [{ ...target("inv-3", "1", "a3"), invoice: { invoiceId: "inv-3", buyerRef: { type: "CONTACT", id: "other" }, outstandingAmount: money("1", "VND"), version: 1 } }] }), /buyer must match/i);
const pendingRepo = new InMemoryPaymentRepository({ paymentRecords: [{ ...payment, id: "pending", state: "PENDING", idempotencyKey: "pending" }] });
assert.throws(() => allocatePaymentToInvoices(pendingRepo, { paymentRecordId: "pending", expectedSourceVersion: 1, now, allocations: [target("inv", "10", "pending-a")] }), /SUCCEEDED/);

const codRepo = new InMemoryPaymentRepository({ methodCatalog: PAYMENT_METHOD_CATALOG });
const cod = recordManualPayment(codRepo, {
  id: "cod-payment",
  buyerRef,
  orderId: "order-cod",
  amount: money("100", "VND"),
  methodCode: "carrier-cod",
  channel: "CARRIER",
  occurredAt: now,
  evidenceMetadata: { customerCollectionEvidenceId: "carrier-collection-1" },
  idempotencyKey: "cod-payment",
  now,
  allowUnapplied: false,
}).payment;
assert.equal(cod.codCustomerCollectionState, "COLLECTED");
assert.equal(cod.codMerchantRemittanceState, "PENDING");
assert.equal(cod.effectiveForReceivables, false);
assert.throws(
  () => allocatePaymentToInvoices(codRepo, {
    paymentRecordId: cod.id,
    expectedSourceVersion: cod.version,
    now,
    allocations: [target("cod-invoice", "100", "cod-allocation-before-remittance")],
  }),
  /effective SUCCEEDED|COD_PAYMENT_REMITTANCE_REQUIRED/,
  "Customer collection evidence alone must not reduce receivables.",
);
assert.equal(codRepo.listAllocations().length, 0, "A rejected COD allocation must have no side effects.");

const collected = recordCodCustomerCollectionEvidence(codRepo, cod.id, {
  expectedVersion: cod.version,
  state: "COLLECTED",
  evidenceMetadata: { customerCollectionEvidenceId: "carrier-collection-2" },
  now,
});
assert.equal(collected.effectiveForReceivables, false, "Re-recording collection must not make COD receivable-effective.");
const remitted = recordCodMerchantRemittanceEvidence(codRepo, cod.id, {
  expectedVersion: collected.version,
  state: "REMITTED",
  evidenceMetadata: { merchantRemittanceEvidenceId: "carrier-remittance-1" },
  now,
});
assert.equal(remitted.effectiveForReceivables, true);
const codAllocation = allocatePaymentToInvoices(codRepo, {
  paymentRecordId: remitted.id,
  expectedSourceVersion: remitted.version,
  now,
  allocations: [target("cod-invoice", "100", "cod-allocation-after-remittance")],
});
assert.equal(codAllocation.remainingAmount.amount, "0");
console.log("Payment allocation contracts: PASS");
