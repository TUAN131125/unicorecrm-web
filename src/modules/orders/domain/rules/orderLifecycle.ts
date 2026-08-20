import type { CustomerOrder, OrderCancellationAudit, OrderCompletionAudit } from "../model/order.types";
import { OrderState } from "../model/order.types";
import { assertOrderFulfillmentPrerequisites } from "./orderFulfillment";

export interface OrderStateDefinition {
  code: string;
  category: "active" | "terminal" | string;
}

export const DEFAULT_ORDER_STATE_DEFINITIONS: readonly OrderStateDefinition[] = [
  { code: OrderState.DRAFT, category: "active" },
  { code: OrderState.CONFIRMED, category: "active" },
  { code: OrderState.COMPLETED, category: "terminal" },
  { code: OrderState.CANCELLED, category: "terminal" },
];

export function hasDraftOrderPrerequisites(order: Pick<CustomerOrder, "buyerRef" | "items">): boolean {
  return Boolean(
    order.buyerRef?.id
    && ["CONTACT", "ORGANIZATION_ACCOUNT"].includes(order.buyerRef.type)
    && Array.isArray(order.items)
    && order.items.length > 0
    && order.items.every((item) => item.id && item.productId && item.productNameSnapshot.trim() && item.quantity > 0 && item.lineTotal >= 0),
  );
}

export function hasConfirmedOrderPrerequisites(order: Pick<CustomerOrder, "buyerRef" | "items" | "paymentAgreementSnapshot">): boolean {
  return hasDraftOrderPrerequisites(order)
    && Boolean(order.paymentAgreementSnapshot?.lines.length)
    && Boolean(order.paymentAgreementSnapshot?.lines.every((line) => line.previewAmount.currency === order.paymentAgreementSnapshot?.currency));
}

export function assertConfirmedOrderPrerequisites(order: CustomerOrder): void {
  if (!hasConfirmedOrderPrerequisites(order)) {
    throw new Error("CONFIRMED Order requires a canonical buyer, valid lines and a versioned Payment Agreement snapshot.");
  }
  assertOrderFulfillmentPrerequisites(order);
}

export function assertCanonicalOrderInvariant(order: CustomerOrder): void {
  if (!Object.values(OrderState).includes(order.state)) throw new Error(`Invalid canonical Order state: ${String(order.state)}`);
  if (!hasDraftOrderPrerequisites(order)) throw new Error("Order requires a canonical buyer and at least one valid Order line.");
  if (order.state !== OrderState.DRAFT && order.state !== OrderState.CANCELLED) assertConfirmedOrderPrerequisites(order);
  if (order.state === OrderState.CONFIRMED && !order.confirmedAt) throw new Error("CONFIRMED Order requires confirmedAt.");
  if (order.state === OrderState.COMPLETED) {
    if (!order.completion?.policyVersion?.trim()) throw new Error("Completed Order requires closing policyVersion.");
    if (!order.completion.correlationId?.trim()) throw new Error("Completed Order requires closing correlationId.");
    if (!order.completion.evidenceId?.trim()) throw new Error("Completed Order requires PurchaseEvidence reference.");
    if (!order.completion.occurredAt?.trim()) throw new Error("Completed Order requires closing occurredAt audit.");
  }
  if (order.state === OrderState.CANCELLED) {
    if (!order.cancellation?.reason?.trim()) throw new Error("Cancelled Order requires a reason.");
    if (!order.cancellation.actorId?.trim()) throw new Error("Cancelled Order requires an actor.");
    if (!order.cancellation.occurredAt) throw new Error("Cancelled Order requires an audit timestamp.");
  }
  const legacy = order as unknown as Record<string, unknown>;
  if ("paymentStatus" in legacy) throw new Error("Order must not own paymentStatus.");
  if ("processingAt" in legacy) throw new Error("Order must not own shipping execution state.");
  if (order.state === ("FAILED" as OrderState)) throw new Error("Order does not use FAILED; retain failure evidence in Payment, Shipping or Invoice.");
}

export function canTransitionOrderState(
  currentState: OrderState,
  nextState: OrderState,
  definitions: readonly OrderStateDefinition[] = DEFAULT_ORDER_STATE_DEFINITIONS,
): boolean {
  if (currentState === nextState) return true;
  const current = definitions.find((item) => item.code === currentState);
  if (current?.category === "terminal") return false;
  // Confirmation, completion and cancellation are explicit commands/workflows. Generic state mutation owns no forward transition.
  return false;
}

export function applyOrderStateTransition(order: CustomerOrder, nextState: OrderState, now = new Date().toISOString()): CustomerOrder {
  if (!canTransitionOrderState(order.state, nextState)) throw new Error(`Invalid generic Order transition ${order.state} -> ${nextState}.`);
  if (order.state === nextState) return order;
  const updated: CustomerOrder = { ...order, state: nextState, updatedAt: now };
  assertCanonicalOrderInvariant(updated);
  return updated;
}

export function applyOrderConfirmation(order: CustomerOrder, now = new Date().toISOString()): CustomerOrder {
  if (order.state === OrderState.CONFIRMED) return order;
  if (order.state !== OrderState.DRAFT) throw new Error("Only DRAFT Order can be confirmed.");
  assertConfirmedOrderPrerequisites(order);
  const updated: CustomerOrder = { ...order, state: OrderState.CONFIRMED, confirmedAt: now, updatedAt: now };
  assertCanonicalOrderInvariant(updated);
  return updated;
}

export function applyOrderCompletion(order: CustomerOrder, completion: OrderCompletionAudit): CustomerOrder {
  if (order.state === OrderState.COMPLETED) return order;
  if (order.state !== OrderState.CONFIRMED) throw new Error("Only CONFIRMED Order can be completed by closing policy.");
  const updated: CustomerOrder = {
    ...order,
    state: OrderState.COMPLETED,
    completedAt: completion.occurredAt,
    completion: { ...completion },
    updatedAt: completion.occurredAt,
  };
  assertCanonicalOrderInvariant(updated);
  return updated;
}

export function applyOrderCancellation(
  order: CustomerOrder,
  input: Omit<OrderCancellationAudit, "occurredAt">,
  now = new Date().toISOString(),
): CustomerOrder {
  if (order.state !== OrderState.DRAFT && order.state !== OrderState.CONFIRMED) throw new Error("Only DRAFT or CONFIRMED Order can be cancelled.");
  if (!input.reason.trim()) throw new Error("Cancellation reason is required.");
  if (!input.actorId.trim()) throw new Error("Cancellation actor is required.");
  const updated: CustomerOrder = {
    ...order,
    state: OrderState.CANCELLED,
    cancelledAt: now,
    cancellation: { ...input, reason: input.reason.trim(), occurredAt: now },
    updatedAt: now,
  };
  assertCanonicalOrderInvariant(updated);
  return updated;
}
