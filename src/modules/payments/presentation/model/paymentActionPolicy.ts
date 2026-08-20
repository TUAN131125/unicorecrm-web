import type { PaymentTransaction } from "../../domain/model/payment.types";

export const PAYMENT_ACTION_IDS = ["view", "retry", "refund", "reconcile-match", "reconcile-mismatch"] as const;
export type PaymentActionId = (typeof PAYMENT_ACTION_IDS)[number];

export interface PaymentActionPermissions {
  canView: boolean;
  canRecord: boolean;
  canRefund: boolean;
  canReconcile: boolean;
}

export function resolvePaymentActionIds(
  transaction: Pick<PaymentTransaction, "kind" | "status" | "reconciliationState">,
  permissions: PaymentActionPermissions,
): PaymentActionId[] {
  const actions: PaymentActionId[] = [];
  if (permissions.canView) actions.push("view");
  if (transaction.status === "FAILED" && permissions.canRecord) actions.push("retry");
  if (transaction.kind === "PAYMENT" && transaction.status === "SUCCEEDED" && permissions.canRefund) actions.push("refund");
  if (permissions.canReconcile && transaction.status === "SUCCEEDED" && transaction.reconciliationState !== "MATCHED") {
    actions.push("reconcile-match");
  }
  if (permissions.canReconcile && transaction.status === "SUCCEEDED" && transaction.reconciliationState !== "MISMATCH") {
    actions.push("reconcile-mismatch");
  }
  return actions;
}

export const resolvePaymentHeaderActionIds = resolvePaymentActionIds;
