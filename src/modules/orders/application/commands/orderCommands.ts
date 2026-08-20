import { OrderState, type CustomerOrder, type OrderCompletionAudit, type OrderDeliveryRecord } from "../../domain/model/order.types";
import { applyOrderCancellation, applyOrderCompletion, applyOrderConfirmation, applyOrderStateTransition, canTransitionOrderState, type OrderStateDefinition } from "../../domain/rules/orderLifecycle";
import type { OrderRepository } from "../ports/OrderRepository";
import { updateOrder } from "./orderRepositoryCommands";
import { CAPABILITIES, assertRuntimeCommandAccess } from "@/platform/access-control";

export function transitionOrderState(repository: OrderRepository, orderId: string, nextState: OrderState, _definitions?: readonly OrderStateDefinition[], now?: string): { success: boolean; message?: string } {
  const order = repository.getById(orderId);
  if (!order) return { success: false, message: "Order not found." };
  if (!canTransitionOrderState(order.state, nextState, _definitions)) return { success: false, message: `Invalid Order transition ${order.state} -> ${nextState}.` };
  updateOrder(repository, orderId, (current) => applyOrderStateTransition(current, nextState, now));
  return { success: true };
}

export function confirmOrderCommand(repository: OrderRepository, orderId: string, now?: string): { success: boolean; order?: CustomerOrder; message?: string } {
  const order = repository.getById(orderId);
  if (!order) return { success: false, message: "Order not found." };
  assertRuntimeCommandAccess(CAPABILITIES.ORDERS_CONFIRM, "orders", order);
  try {
    const updated = updateOrder(repository, orderId, (current) => applyOrderConfirmation(current, now));
    return { success: true, order: updated };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Order confirmation failed." };
  }
}

export function completeOrderCommand(repository: OrderRepository, orderId: string, completion: OrderCompletionAudit): { success: boolean; message?: string } {
  const order = repository.getById(orderId);
  if (!order) return { success: false, message: "Order not found." };
  assertRuntimeCommandAccess(CAPABILITIES.ORDERS_COMPLETE, "orders", order);
  try { updateOrder(repository, orderId, (current) => applyOrderCompletion(current, completion)); return { success: true }; }
  catch (error) { return { success: false, message: error instanceof Error ? error.message : "Order completion failed." }; }
}

export function cancelOrderCommand(repository: OrderRepository, orderId: string, input: { reason: string; reasonCode?: string; actorId: string; actorName?: string; correlationId?: string }, now?: string): { success: boolean; message?: string } {
  const order = repository.getById(orderId);
  if (!order) return { success: false, message: "Order not found." };
  assertRuntimeCommandAccess(CAPABILITIES.ORDERS_UPDATE, "orders", order);
  try { updateOrder(repository, orderId, (current) => applyOrderCancellation(current, input, now)); return { success: true }; }
  catch (error) { return { success: false, message: error instanceof Error ? error.message : "Order cancellation failed." }; }
}

function orderDocumentFingerprint(order: CustomerOrder): string {
  const payload = JSON.stringify({ id: order.id, orderNumber: order.orderNumber, state: order.state, buyerRef: order.buyerRef, recipientName: order.recipientName, recipientEmail: order.recipientEmail, recipientPhone: order.recipientPhone, shippingAddress: order.shippingAddress, items: order.items, subtotal: order.subtotal, discountTotal: order.discountTotal, taxTotal: order.taxTotal, grandTotal: order.grandTotal ?? order.totalAmount, currency: order.currency, paymentAgreementSnapshot: order.paymentAgreementSnapshot, paymentInstruction: order.paymentInstruction, notes: order.notes });
  let hash = 2166136261;
  for (let index = 0; index < payload.length; index += 1) { hash ^= payload.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return `order-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function recordOrderDelivery(repository: OrderRepository, orderId: string, input: Omit<OrderDeliveryRecord, "contentFingerprint">): CustomerOrder | undefined {
  const current = repository.getById(orderId);
  if (!current) return undefined;
  assertRuntimeCommandAccess(CAPABILITIES.ORDERS_UPDATE, "orders", current);
  if (!(current.state === OrderState.CONFIRMED || current.state === OrderState.COMPLETED)) throw new Error("Only a Confirmed or Completed Order can be sent to a customer.");
  if (current.deliveryHistory?.some((record) => record.id === input.id)) return current;
  const emailChannel = input.channel === "GMAIL" || input.channel === "EMAIL";
  if (emailChannel && !/^\S+@\S+\.\S+$/.test(input.recipientEmail?.trim() ?? "")) throw new Error("Email delivery requires a valid recipient email.");
  if (!emailChannel && input.channel !== "PDF" && !input.recipient?.trim()) throw new Error("Non-email delivery requires a recipient or destination.");
  if (!input.sentAt || Number.isNaN(new Date(input.sentAt).getTime())) throw new Error("Order delivery requires a valid sent time.");
  return updateOrder(repository, orderId, (order) => ({ ...order, sentAt: order.sentAt ?? input.sentAt, updatedAt: input.sentAt, deliveryHistory: [...(order.deliveryHistory ?? []), { ...input, recipientEmail: input.recipientEmail?.trim() || undefined, recipient: input.recipient?.trim() || undefined, note: input.note?.trim() || undefined, contentFingerprint: orderDocumentFingerprint(order) }] }));
}
