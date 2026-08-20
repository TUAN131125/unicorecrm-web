import type { PaymentRepository, PaymentRepositorySnapshot } from "../ports/PaymentRepository";
import type {
  PaymentCompletionReadiness,
  PaymentObligation,
  PaymentSummary,
  PaymentTransaction,
} from "../../domain/model/payment.types";

function transactionsOf(source: PaymentRepository | PaymentRepositorySnapshot): PaymentTransaction[] { return "listTransactions" in source ? source.listTransactions() : source.transactions; }
function obligationsOf(source: PaymentRepository | PaymentRepositorySnapshot): PaymentObligation[] { return "listObligations" in source ? source.listObligations() : source.obligations ?? []; }

export function getTransactionsForOrder(source: PaymentRepository | PaymentRepositorySnapshot, orderId: string): PaymentTransaction[] {
  return transactionsOf(source).filter((transaction) => transaction.orderId === orderId).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function getPaymentObligations(
  source: PaymentRepository | PaymentRepositorySnapshot,
  input: { orderId?: string; includeVoided?: boolean } = {},
): PaymentObligation[] {
  return obligationsOf(source)
    .filter((obligation) => !input.orderId || obligation.orderId === input.orderId)
    .filter((obligation) => input.includeVoided || obligation.status !== "VOIDED")
    .sort(
      (left, right) =>
        (left.sequence ?? 999) - (right.sequence ?? 999)
        || (left.dueDate ?? "9999").localeCompare(right.dueDate ?? "9999"),
    );
}

export function getPaymentObligationsForOrder(
  source: PaymentRepository | PaymentRepositorySnapshot,
  orderId: string,
  includeVoided = false,
): PaymentObligation[] {
  return getPaymentObligations(source, { orderId, includeVoided });
}

export function queryPaymentTransactions(source: PaymentRepository | PaymentRepositorySnapshot, input: { search?: string; status?: string; kind?: string; reconciliation?: string; method?: string; orderId?: string } = {}): PaymentTransaction[] {
  const search = input.search?.trim().toLowerCase() ?? "";
  return transactionsOf(source)
    .filter((transaction) => !input.status || input.status === "ALL" || transaction.status === input.status)
    .filter((transaction) => !input.kind || input.kind === "ALL" || transaction.kind === input.kind)
    .filter((transaction) => !input.reconciliation || input.reconciliation === "ALL" || (transaction.reconciliationState ?? "UNRECONCILED") === input.reconciliation)
    .filter((transaction) => !input.method || input.method === "ALL" || transaction.method === input.method)
    .filter((transaction) => !input.orderId || transaction.orderId === input.orderId)
    .filter((transaction) => !search || [transaction.id, transaction.orderId, transaction.externalReference, transaction.method, transaction.termSnapshot, transaction.buyerRef.id, transaction.carrierReference].filter(Boolean).some((value) => String(value).toLowerCase().includes(search)))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function evaluatePaymentCompletionReadiness(source: PaymentRepository | PaymentRepositorySnapshot, orderId: string): PaymentCompletionReadiness {
  const obligations = getPaymentObligationsForOrder(source, orderId);
  const blockers = obligations
    .filter((obligation) => ((obligation.fulfillmentGate && obligation.fulfillmentGate !== "NONE") || (!obligation.fulfillmentGate && ["DEPOSIT", "PREPAID"].includes(obligation.term))) && obligation.amountOutstanding > 0)
    .map((obligation) => `${obligation.label || obligation.id} has ${obligation.amountOutstanding} ${obligation.currency} outstanding before Order completion.`);
  return { ready: blockers.length === 0, blockers };
}

export function evaluatePaymentBookingReadiness(source: PaymentRepository | PaymentRepositorySnapshot, orderId: string): PaymentCompletionReadiness {
  const obligations = getPaymentObligationsForOrder(source, orderId);
  const blockers = obligations
    .filter((obligation) => (obligation.fulfillmentGate === "BEFORE_BOOKING" || (!obligation.fulfillmentGate && obligation.term === "DEPOSIT")) && obligation.amountOutstanding > 0)
    .map((obligation) => `${obligation.label || obligation.id} has ${obligation.amountOutstanding} ${obligation.currency} outstanding before Shipping booking.`);
  return { ready: blockers.length === 0, blockers };
}

export function isCodCollectibleObligation(
  obligation: Pick<PaymentObligation, "method" | "timing" | "fulfillmentGate" | "status" | "amountOutstanding">,
): boolean {
  return obligation.method === "COD"
    && obligation.timing === "ON_DELIVERY"
    && obligation.fulfillmentGate === "NONE"
    && obligation.status !== "VOIDED"
    && obligation.amountOutstanding > 0;
}

export function getCodCollectibleAmountForOrder(source: PaymentRepository | PaymentRepositorySnapshot, orderId: string): number {
  return getPaymentObligationsForOrder(source, orderId)
    .filter(isCodCollectibleObligation)
    .reduce((sum, obligation) => sum + obligation.amountOutstanding, 0);
}

export function getRefundablePaymentTransactionsForOrder(source: PaymentRepository | PaymentRepositorySnapshot, orderId: string): Array<PaymentTransaction & { refundableAmount: number }> {
  const transactions = getTransactionsForOrder(source, orderId);
  const refunds = transactions.filter((item) => item.kind === "REFUND" && item.status === "SUCCEEDED");
  return transactions
    .filter((item) => item.kind === "PAYMENT" && item.status === "SUCCEEDED")
    .map((payment) => ({ ...payment, refundableAmount: Math.max(0, payment.amount - refunds.filter((refund) => refund.refundOfTransactionId === payment.id).reduce((sum, refund) => sum + refund.amount, 0)) }))
    .filter((item) => item.refundableAmount > 0)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

export function projectPaymentSummary(source: PaymentRepository | PaymentRepositorySnapshot, orderId: string, orderTotal: number, currency = "VND"): PaymentSummary {
  const transactions = getTransactionsForOrder(source, orderId);
  const obligations = getPaymentObligationsForOrder(source, orderId);
  const reviews = "listMigrationReviews" in source ? source.listMigrationReviews() : source.migrationReviews;
  const review = reviews.find((item) => item.orderId === orderId);
  const succeededPayments = transactions.filter((transaction) => transaction.kind === "PAYMENT" && transaction.status === "SUCCEEDED");
  const succeededRefunds = transactions.filter((transaction) => transaction.kind === "REFUND" && transaction.status === "SUCCEEDED");
  const failed = transactions.some((transaction) => transaction.kind === "PAYMENT" && transaction.status === "FAILED");
  const paidAmount = succeededPayments.reduce((sum, transaction) => sum + transaction.amount, 0);
  const allocatedAmount = succeededPayments.reduce(
    (sum, transaction) => sum + (transaction.allocations ?? []).reduce(
      (allocationSum, allocation) => allocationSum + allocation.amount,
      0,
    ),
    0,
  );
  const unappliedAmount = succeededPayments.reduce((sum, transaction) => {
    const transactionAllocatedAmount = (transaction.allocations ?? []).reduce(
      (allocationSum, allocation) => allocationSum + allocation.amount,
      0,
    );
    return sum + (transaction.unappliedAmount ?? Math.max(0, transaction.amount - transactionAllocatedAmount));
  }, 0);
  const refundedAmount = succeededRefunds.reduce((sum, transaction) => sum + transaction.amount, 0);
  const netPaidAmount = Math.max(0, paidAmount - refundedAmount);
  const obligationOutstanding = obligations.reduce((sum, obligation) => sum + obligation.amountOutstanding, 0);
  const dueAmount = obligations.length > 0 ? obligationOutstanding : Math.max(0, orderTotal - netPaidAmount);
  let state: PaymentSummary["state"] = "UNPAID";
  if (review) state = "REVIEW";
  else if (obligations.some((obligation) => obligation.status === "OVERDUE")) state = "OVERDUE";
  else if (paidAmount > 0 && refundedAmount >= paidAmount) state = "REFUNDED";
  else if (dueAmount <= 0 && (orderTotal > 0 || obligations.length > 0)) state = "PAID";
  else if (netPaidAmount > 0 || obligations.some((obligation) => obligation.amountPaid > 0)) state = "PARTIAL";
  else if (failed) state = "FAILED";
  return {
    orderId, state, currency, paidAmount, refundedAmount, netPaidAmount, allocatedAmount, unappliedAmount, dueAmount, outstandingAmount: dueAmount,
    transactionCount: transactions.length, obligationCount: obligations.length, methods: [...new Set(obligations.map((obligation) => obligation.method))], terms: [...new Set(obligations.map((obligation) => obligation.term))],
    overdueCount: obligations.filter((obligation) => obligation.status === "OVERDUE").length,
  };
}
