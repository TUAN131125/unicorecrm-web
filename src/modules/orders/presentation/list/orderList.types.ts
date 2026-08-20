import type { ReactNode } from "react";
import type { CustomerOrder } from "../../domain/model/order.types";

export interface OrderStatusConfig {
  code: string;
  labelVi: string;
  labelEn: string;
  color: string;
  order: number;
  category: "active" | "terminal";
  isSystem: boolean;
  isRequired: boolean;
  isActive: boolean;
  descriptionVi?: string;
  descriptionEn?: string;
}

export interface ColumnConfig {
  visibleColumnOrder: string[];
  hiddenColumns: string[];
}

export interface OrderColumnDef {
  key: string;
  labelVi: string;
  labelEn: string;
  width: string;
  align?: "left" | "center" | "right";
  cellClassName?: string;
  render: (order: CustomerOrder) => ReactNode;
}

export interface OrderStatistics {
  totalCount: number;
  draftCount: number;
  confirmedCount: number;
  processingCount: number;
  completedCount: number;
  cancelledCount: number;
  totalValue: number;
  completedValue: number;
  unpaidValue: number;
  avgValue: number;
}
