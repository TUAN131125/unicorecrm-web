import type { PaymentRepositorySnapshot } from "../application/ports/PaymentRepository";
import type { PaymentTransaction } from "../domain/model/payment.types";

type PersistedPaymentTransaction = PaymentTransaction & {
  obligationId?: unknown;
  allocationAmount?: unknown;
};

function normalizePaymentTransaction(
  persisted: PersistedPaymentTransaction,
): PaymentTransaction {
  const {
    obligationId,
    allocationAmount,
    ...transaction
  } = persisted;

  const migratedAllocations =
    typeof obligationId === "string"
    && typeof allocationAmount === "number"
    && Number.isFinite(allocationAmount)
    && allocationAmount > 0
      ? [{ obligationId, amount: allocationAmount }]
      : [];
  const allocations = transaction.allocations?.length
    ? transaction.allocations
    : migratedAllocations;
  const allocatedAmount = allocations.reduce(
    (sum, allocation) => sum + allocation.amount,
    0,
  );

  return {
    ...transaction,
    allocations,
    unappliedAmount:
      transaction.unappliedAmount
      ?? Math.max(0, transaction.amount - allocatedAmount),
  };
}

export function normalizePaymentRepositorySnapshot(
  snapshot: Partial<PaymentRepositorySnapshot>,
): PaymentRepositorySnapshot {
  return {
    obligations: structuredClone(snapshot.obligations ?? []),
    transactions: structuredClone(snapshot.transactions ?? []).map(
      (transaction) => normalizePaymentTransaction(transaction as PersistedPaymentTransaction),
    ),
    migrationReviews: structuredClone(snapshot.migrationReviews ?? []),
    plans: structuredClone(snapshot.plans ?? []),
    scheduleLines: structuredClone(snapshot.scheduleLines ?? []),
    intents: structuredClone(snapshot.intents ?? []),
    refundIntents: structuredClone(snapshot.refundIntents ?? []),
    paymentRecords: structuredClone(snapshot.paymentRecords ?? []),
    allocations: structuredClone(snapshot.allocations ?? []),
    customerCredits: structuredClone(snapshot.customerCredits ?? []),
    methodCatalog: structuredClone(snapshot.methodCatalog ?? []),
    providerCatalog: structuredClone(snapshot.providerCatalog ?? []),
  };
}
