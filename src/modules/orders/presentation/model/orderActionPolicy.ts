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
