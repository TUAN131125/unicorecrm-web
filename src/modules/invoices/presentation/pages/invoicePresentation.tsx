import React from "react";
import { Badge } from "@/shared/components/ui";
import type { InvoiceLifecycleState, SettlementState } from "../../domain/model/invoice.types";

const invoiceTone: Record<InvoiceLifecycleState, "neutral" | "warning" | "success" | "danger" | "info"> = {
  DRAFT: "neutral",
  ISSUING: "warning",
  ISSUED: "success",
  ISSUE_FAILED: "danger",
  DISCARDED: "neutral",
  VOIDED: "danger",
};
const settlementTone: Record<SettlementState, "neutral" | "warning" | "success" | "danger" | "info"> = {
  NOT_DUE: "info",
  UNPAID: "warning",
  PARTIAL: "warning",
  PAID: "success",
  OVERDUE: "danger",
  CREDITED: "success",
};
export const InvoiceStateBadge = ({ state }: { state: InvoiceLifecycleState }) => <Badge variant={invoiceTone[state]}>{state}</Badge>;
export const SettlementBadge = ({ state }: { state: SettlementState }) => <Badge variant={settlementTone[state]}>{state}</Badge>;
