import { OrderState, type CustomerOrder } from "../../domain/model/order.types";
import { orderRequiresShipping } from "../../domain/rules/orderFulfillment";

export const ORDER_ACTION_IDS = [
  "view",
  "edit",
  "confirm",
  "create-shipping",
  "record-payment",
  "create-invoice",
  "send",
  "confirm-sent",
  "export-pdf",
  "complete",
  "cancel",
  "duplicate",
  "archive",
] as const;

export type OrderActionId = (typeof ORDER_ACTION_IDS)[number];

export interface OrderActionPermissions {
  canView: boolean;
  canUpdate: boolean;
  canCreate: boolean;
  canDelete: boolean;
  canConfirm?: boolean;
  canComplete: boolean;
  canCreateShipping: boolean;
  canRecordPayment: boolean;
  canCreateInvoice?: boolean;
}

export interface OrderActionEvidence { completionReady: boolean }

export function resolveOrderActionIds(
  order: Pick<CustomerOrder, "state" | "items">,
  permissions: OrderActionPermissions,
  evidence: OrderActionEvidence,
): OrderActionId[] {
  const actions: OrderActionId[] = [];
  if (permissions.canView) actions.push("view", "export-pdf");

  if (order.state === OrderState.DRAFT) {
    if (permissions.canUpdate) actions.push("edit");
    if (permissions.canConfirm) actions.push("confirm");
    if (permissions.canUpdate) actions.push("cancel");
  }

  if ((order.state === OrderState.CONFIRMED || order.state === OrderState.COMPLETED) && permissions.canUpdate) actions.push("send", "confirm-sent");
  if (order.state === OrderState.CONFIRMED) {
    if (permissions.canCreateShipping && orderRequiresShipping(order)) actions.push("create-shipping");
    if (permissions.canRecordPayment) actions.push("record-payment");
    if (permissions.canCreateInvoice) actions.push("create-invoice");
    if (permissions.canComplete && evidence.completionReady) actions.push("complete");
    if (permissions.canUpdate) actions.push("cancel");
  }
  if (order.state === OrderState.COMPLETED && permissions.canCreateInvoice) actions.push("create-invoice");
  if (permissions.canCreate) actions.push("duplicate");
  if (permissions.canDelete && order.state === OrderState.CANCELLED) actions.push("archive");
  return actions;
}

export function resolveOrderHeaderActionIds(
  order: Pick<CustomerOrder, "state" | "items">,
  permissions: OrderActionPermissions,
  evidence: OrderActionEvidence,
): OrderActionId[] {
  return resolveOrderActionIds(order, permissions, evidence).filter((id) => !["view", "archive"].includes(id));
}
/** Business feedback only; workflow diagnostics stay on the result for support. */
export function orderCompletionBlockerMessage(blocker: string, locale: "vi" | "en"): string {
  const vi = locale === "vi";
  if (/outstanding before (?:Order completion|Shipping booking)/iu.test(blocker)) return vi
    ? "Còn khoản thanh toán bắt buộc chưa hoàn tất. Mở Thanh toán để kiểm tra số dư."
    : "A required payment is outstanding. Open Payments to review the balance.";
  if (/Required outbound ShippingBooking does not exist/iu.test(blocker)) return vi
    ? "Chưa có vận đơn giao hàng. Kiểm tra mục Giao hàng trước khi hoàn tất."
    : "No outbound shipment exists. Review Delivery before completing the order.";
  if (/is not DELIVERED/iu.test(blocker)) return vi
    ? "Chưa xác nhận giao hàng thành công. Kiểm tra trạng thái vận chuyển."
    : "Delivery has not been confirmed. Review the shipment status.";
  if (/Order must be CONFIRMED/iu.test(blocker)) return vi
    ? "Xác nhận đơn hàng trước khi hoàn tất."
    : "Confirm the order before completing it.";
  return vi
    ? "Chưa thể hoàn tất đơn hàng. Kiểm tra thanh toán, giao nhận và các giao dịch còn mở."
    : "The order cannot be completed yet. Review payments, delivery and open transactions.";
}

export function orderCompletionBlockersMessage(blockers: readonly string[] | undefined, locale: "vi" | "en"): string {
  return [...new Set((blockers?.length ? blockers : [""]).map(value => orderCompletionBlockerMessage(value, locale)))].join(" ");
}
