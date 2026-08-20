import { MutationCommandError, createMutationMetadata, executeMutationCommand, type MutationCommandMetadata, type MutationOutcome } from "@/shared/application";
import { getInvoicesSnapshot, getReceivablesSnapshot } from "@/modules/invoices";
import { cancelOrder, getOrderSnapshot, getOrdersSnapshot, replaceOrders } from "@/modules/orders";
import {
  cancelPaymentPlanSnapshot,
  getActivePaymentPlanForOrderSnapshot,
  getPaymentIntentsSnapshot,
  getPaymentRecordsSnapshot,
  getPaymentsSnapshot,
  replacePaymentsSnapshot,
} from "@/modules/payments";
import { getShippingBookingsForSourceSnapshot } from "@/modules/shipping";

export interface OrderCancellationImpact {
  ready: boolean;
  blockers: string[];
  warnings: string[];
  invoiceIds: string[];
  shippingBookingIds: string[];
  paymentRecordIds: string[];
  paymentIntentIds: string[];
}

export interface ExecuteOrderCancellationInput {
  orderId: string;
  reason: string;
  reasonCode?: string;
}

interface DemoCancellationContext {
  actorId: string;
  actorName: string;
  correlationId?: string;
  now: string;
}

interface DemoOrderCancellationResult extends OrderCancellationImpact {
  success: boolean;
  message?: string;
  paymentPlanId?: string;
}

export interface OrderCancellationTransactionResult {
  orderId: string;
  orderState: "CANCELLED";
  alreadyCancelled: boolean;
  cancelledAt: string;
  paymentPlanId?: string;
  paymentPlanState?: "CANCELLED";
  warnings?: string[];
}

export function evaluateOrderCancellation(orderId: string): OrderCancellationImpact {
  const order = getOrderSnapshot(orderId);
  if (!order) return { ready: false, blockers: ["ORDER_NOT_FOUND"], warnings: [], invoiceIds: [], shippingBookingIds: [], paymentRecordIds: [], paymentIntentIds: [] };
  if (order.state === "CANCELLED") return { ready: true, blockers: [], warnings: ["ORDER_ALREADY_CANCELLED"], invoiceIds: [], shippingBookingIds: [], paymentRecordIds: [], paymentIntentIds: [] };
  if (order.state === "COMPLETED") return { ready: false, blockers: ["COMPLETED_ORDER_CANNOT_BE_CANCELLED"], warnings: [], invoiceIds: [], shippingBookingIds: [], paymentRecordIds: [], paymentIntentIds: [] };

  const invoices = getInvoicesSnapshot().invoices.filter((item) => item.sourceLinks.orderId === orderId && !["DISCARDED", "VOIDED"].includes(item.lifecycleState));
  const invoiceIds = invoices.map((item) => item.id);
  const invoiceBlockers = invoices.map((item) => `INVOICE_REMEDIATION_REQUIRED:${item.invoiceNumber ?? item.id}:${item.lifecycleState}`);
  const allocationBlockers = getReceivablesSnapshot()
    .filter((item) => invoiceIds.includes(item.invoiceId) && item.allocatedAmount.amount !== "0")
    .map((item) => `PAYMENT_ALLOCATION_REVERSAL_REQUIRED:${item.invoiceNumber}`);

  const shipping = getShippingBookingsForSourceSnapshot("ORDER", orderId)
    .filter((item) => item.bookingStatus !== "CANCELLED" && item.bookingStatus !== "FAILED");
  const shippingBlockers = shipping.map((item) => `SHIPPING_CANCELLATION_REQUIRED:${item.code}`);

  const paymentRecords = getPaymentRecordsSnapshot({ orderId }).filter((item) => item.kind === "PAYMENT" && item.state === "SUCCEEDED");
  const paymentBlockers = paymentRecords.map((item) => `PAYMENT_REMEDIATION_REQUIRED:${item.externalReference ?? item.id}`);
  const intents = getPaymentIntentsSnapshot({ orderId }).filter((item) => ["CREATED", "REQUIRES_ACTION", "PROCESSING"].includes(item.state));
  const intentBlockers = intents.map((item) => `PAYMENT_INTENT_CANCELLATION_REQUIRED:${item.id}`);
  const blockers = [...invoiceBlockers, ...allocationBlockers, ...shippingBlockers, ...paymentBlockers, ...intentBlockers];
  const activePlan = getActivePaymentPlanForOrderSnapshot(orderId);
  const warnings = activePlan ? [`PAYMENT_PLAN_WILL_BE_CANCELLED:${activePlan.id}`] : [];
  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    invoiceIds,
    shippingBookingIds: shipping.map((item) => item.id),
    paymentRecordIds: paymentRecords.map((item) => item.id),
    paymentIntentIds: intents.map((item) => item.id),
  };
}

function executeOrderCancellation(input: ExecuteOrderCancellationInput, context: DemoCancellationContext): DemoOrderCancellationResult {
  const impact = evaluateOrderCancellation(input.orderId);
  if (!impact.ready) return { ...impact, success: false, message: impact.blockers.join(" ") };
  const order = getOrderSnapshot(input.orderId);
  if (!order) return { ...impact, success: false, message: "Order not found." };
  if (order.state === "CANCELLED") return { ...impact, success: true };

  const orderSnapshot = getOrdersSnapshot();
  const paymentSnapshot = getPaymentsSnapshot();
  try {
    const activePlan = getActivePaymentPlanForOrderSnapshot(input.orderId);
    if (activePlan) cancelPaymentPlanSnapshot(activePlan.id, { expectedVersion: activePlan.version, reason: input.reason, now: context.now });
    const result = cancelOrder(input.orderId, {
      reason: input.reason,
      reasonCode: input.reasonCode,
      actorId: context.actorId,
      actorName: context.actorName,
      correlationId: context.correlationId,
    }, context.now);
    if (!result.success) throw new Error(result.message || "Order cancellation failed.");
    return { ...impact, success: true, paymentPlanId: activePlan?.id };
  } catch (error) {
    replaceOrders(orderSnapshot);
    replacePaymentsSnapshot(paymentSnapshot);
    return { ...impact, success: false, message: error instanceof Error ? error.message : "Order cancellation failed." };
  }
}

export function executeOrderCancellationCommand(
  input: ExecuteOrderCancellationInput,
  metadata: Partial<MutationCommandMetadata> = {},
): Promise<MutationOutcome<OrderCancellationTransactionResult>> {
  return executeMutationCommand(
    { commandType: "order.cancel", aggregateType: "order", aggregateId: input.orderId, payload: input },
    createMutationMetadata(`order.cancel:${input.orderId}`, metadata),
    () => {
      const result = executeOrderCancellation(input, {
        actorId: "demo-local-runtime",
        actorName: "Demo local runtime",
        correlationId: metadata.correlationId,
        now: new Date().toISOString(),
      });
      if (!result.success) {
        throw new MutationCommandError({
          code: "ORDER_CANCELLATION_BLOCKED",
          message: result.message || result.blockers.join(" ") || "Order cancellation blocked.",
          category: "BUSINESS_RULE",
          retryable: false,
          details: { blockers: result.blockers, warnings: result.warnings },
        });
      }
      const cancelled = getOrderSnapshot(input.orderId);
      if (!cancelled || cancelled.state !== "CANCELLED" || !cancelled.cancelledAt) {
        throw new MutationCommandError({ code: "ORDER_CANCELLATION_BLOCKED", message: "Order cancellation did not produce a terminal local projection." });
      }
      return {
        orderId: cancelled.id,
        orderState: "CANCELLED",
        alreadyCancelled: result.warnings.includes("ORDER_ALREADY_CANCELLED"),
        cancelledAt: cancelled.cancelledAt,
        ...(result.paymentPlanId === undefined ? {} : { paymentPlanId: result.paymentPlanId, paymentPlanState: "CANCELLED" as const }),
        ...(result.warnings.length === 0 ? {} : { warnings: result.warnings }),
      };
    },
  );
}
