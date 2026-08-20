import type { CustomerOrder } from "@/modules/orders";
import type { PaymentTransaction } from "@/modules/payments";
import type { ShippingBooking } from "@/modules/shipping";
import type { ReturnRequest } from "@/modules/returns";
import type { ReceivableEntry } from "@/modules/invoices";
import { addMoney, money, type MoneyDto } from "@/shared/money";

export interface ReceivablesMetricSummary {
  currency: string;
  outstandingAmount: MoneyDto;
  overdueAmount: MoneyDto;
  openInvoiceCount: number;
  overdueInvoiceCount: number;
  agingCounts: Record<ReceivableEntry["agingBucket"], number>;
}

export interface OrderToCashMetrics {
  /** Operational cycle from Order confirmation to the latest successful collection. Not accounting DSO. */
  collectionCycleDays: number | null;
  deliverySuccessRate: number | null;
  codReconciliationRate: number | null;
  returnRate: number | null;
  refundCycleDays: number | null;
  receivables: ReceivablesMetricSummary | null;
  generatedAt: string;
}

const DAY = 86_400_000;
const dateMs = (value?: string) => (value ? new Date(value).getTime() : Number.NaN);
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const rounded = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);

function summarizeReceivables(receivables: ReceivableEntry[]): ReceivablesMetricSummary | null {
  const open = receivables.filter((item) => !["PAID", "CREDITED"].includes(item.settlementState));
  const currency = open[0]?.outstandingAmount.currency ?? receivables[0]?.outstandingAmount.currency;
  if (!currency) return null;
  const sameCurrency = open.filter((item) => item.outstandingAmount.currency === currency);
  const agingCounts: ReceivablesMetricSummary["agingCounts"] = { NOT_DUE: 0, CURRENT: 0, "1_30": 0, "31_60": 0, "61_90": 0, "90_PLUS": 0 };
  sameCurrency.forEach((item) => { agingCounts[item.agingBucket] += 1; });
  return {
    currency,
    outstandingAmount: sameCurrency.reduce((total, item) => addMoney(total, item.outstandingAmount), money("0", currency)),
    overdueAmount: sameCurrency.filter((item) => item.settlementState === "OVERDUE").reduce((total, item) => addMoney(total, item.outstandingAmount), money("0", currency)),
    openInvoiceCount: sameCurrency.length,
    overdueInvoiceCount: sameCurrency.filter((item) => item.settlementState === "OVERDUE").length,
    agingCounts,
  };
}

export function buildOrderToCashMetrics(input: {
  orders: CustomerOrder[];
  transactions: PaymentTransaction[];
  shipping: ShippingBooking[];
  returns: ReturnRequest[];
  receivables?: ReceivableEntry[];
  now?: string;
}): OrderToCashMetrics {
  const generatedAtMs = dateMs(input.now ?? new Date().toISOString());
  const successfulPayments = input.transactions.filter((item) => item.kind === "PAYMENT" && item.status === "SUCCEEDED");

  const collectionCycleSamples = input.orders.flatMap((order) => {
    const payments = successfulPayments.filter((item) => item.orderId === order.id).sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
    if (!payments.length) return [];
    const orderStart = dateMs(order.confirmedAt ?? order.orderDate ?? order.createdAt);
    const latestCollection = dateMs(payments[payments.length - 1].occurredAt);
    return Number.isFinite(orderStart) && Number.isFinite(latestCollection) && latestCollection >= orderStart ? [(latestCollection - orderStart) / DAY] : [];
  });

  const terminalShipping = input.shipping.filter((item) => ["DELIVERED", "DELIVERY_FAILED", "RETURNED"].includes(item.externalStatus));
  const delivered = terminalShipping.filter((item) => item.externalStatus === "DELIVERED").length;
  const codTransactions = successfulPayments.filter((item) => item.method === "COD" || item.source === "CARRIER");
  const reconciledCod = codTransactions.filter((item) => item.reconciliationState === "MATCHED" || item.codCollectionState === "REMITTED").length;
  const eligibleOrders = input.orders.filter((item) => item.state !== "CANCELLED");
  const refundCycles = input.returns.filter((item) => item.requestedResolution === "REFUND" && item.resolvedAt).flatMap((item) => {
    const start = dateMs(item.requestedAt);
    const end = dateMs(item.resolvedAt);
    return Number.isFinite(start) && Number.isFinite(end) && end >= start ? [(end - start) / DAY] : [];
  });

  return {
    collectionCycleDays: rounded(average(collectionCycleSamples)),
    deliverySuccessRate: terminalShipping.length ? Math.round((delivered / terminalShipping.length) * 1000) / 10 : null,
    codReconciliationRate: codTransactions.length ? Math.round((reconciledCod / codTransactions.length) * 1000) / 10 : null,
    returnRate: eligibleOrders.length ? Math.round((input.returns.length / eligibleOrders.length) * 1000) / 10 : null,
    refundCycleDays: rounded(average(refundCycles)),
    receivables: summarizeReceivables(input.receivables ?? []),
    generatedAt: new Date(generatedAtMs).toISOString(),
  };
}
