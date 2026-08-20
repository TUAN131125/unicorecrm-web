import type { PurchaseEvidence } from "@/modules/commercial-evidence";
import type { CustomerOrder, OrderCollection, OrderCompletionAudit } from "@/modules/orders";
import type { PaymentCompletionReadiness } from "@/modules/payments";
import type { ShippingBooking } from "@/modules/shipping";

export interface OrderClosingPorts {
  orders: {
    list(): CustomerOrder[];
    snapshot(): OrderCollection;
    restore(snapshot: OrderCollection): void;
    complete(orderId: string, completion: OrderCompletionAudit): { success: boolean; message?: string };
  };
  payments: { evaluateCompletion(order: CustomerOrder): PaymentCompletionReadiness };
  shipping: { listForOrder(orderId: string): ShippingBooking[] };
  evidence: {
    runAtomically<T>(work: () => T): T;
    findOrderCompleted(orderId: string): PurchaseEvidence | undefined;
    recordOrderCompleted(input: { evidenceId: string; workspaceId: string; order: CustomerOrder; occurredAt: string; policyVersion: string; correlationId: string }): PurchaseEvidence;
  };
}
