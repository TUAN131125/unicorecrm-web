import React from "react";
import { Badge } from "@/shared/components/ui";
import { OrderState } from "../../domain/model/order.types";

const LABELS: Record<OrderState, string> = {
  [OrderState.DRAFT]: "NHÁP",
  [OrderState.CONFIRMED]: "ĐÃ XÁC NHẬN",
  [OrderState.COMPLETED]: "HOÀN THÀNH",
  [OrderState.CANCELLED]: "ĐÃ HỦY",
};

const VARIANTS: Record<OrderState, "neutral" | "info" | "success" | "danger"> = {
  [OrderState.DRAFT]: "neutral",
  [OrderState.CONFIRMED]: "info",
  [OrderState.COMPLETED]: "success",
  [OrderState.CANCELLED]: "danger",
};

export function OrderStatusBadge({ state }: { state: OrderState }) {
  return <Badge variant={VARIANTS[state]}>{LABELS[state]}</Badge>;
}
