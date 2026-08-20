import {
  getPurchaseEvidenceBySource,
  recordCommercialEvidence,
  runCommercialEvidenceTransaction,
} from "@/modules/commercial-evidence";
import { completeOrderFromClosing, getOrderListSnapshot, getOrdersSnapshot, replaceOrders } from "@/modules/orders";
import { evaluatePaymentFulfillmentGateForOrder } from "@/modules/payments";
import { getShippingBookingsForSourceSnapshot } from "@/modules/shipping";
import type { OrderClosingPorts } from "../application/ports/OrderClosingPorts";

export function createOrderClosingRuntime(): OrderClosingPorts {
  return {
    orders: {
      list: getOrderListSnapshot,
      snapshot: getOrdersSnapshot,
      restore: replaceOrders,
      complete: completeOrderFromClosing,
    },
    payments: { evaluateCompletion: (order) => evaluatePaymentFulfillmentGateForOrder(order.id, "BEFORE_COMPLETION") },
    shipping: { listForOrder: (orderId) => getShippingBookingsForSourceSnapshot("ORDER", orderId) },
    evidence: {
      runAtomically: runCommercialEvidenceTransaction,
      findOrderCompleted: (orderId) => getPurchaseEvidenceBySource("ORDER", orderId, "ORDER_COMPLETED"),
      recordOrderCompleted: ({ evidenceId, workspaceId, order, occurredAt, policyVersion, correlationId }) => recordCommercialEvidence({
        evidenceId,
        workspaceId,
        buyerRef: order.buyerRef,
        sourceType: "ORDER",
        sourceId: order.id,
        evidenceType: "ORDER_COMPLETED",
        occurredAt,
        policyVersion,
        correlationId,
        amount: order.grandTotal ?? order.totalAmount,
        currency: order.currency ?? "VND",
        productSummary: order.items.map((item) => item.productNameSnapshot).filter(Boolean).join(", "),
      }),
    },
  };
}
