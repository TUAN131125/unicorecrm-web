import type { Customer, CustomerHealth, CustomerStatus, CustomerType } from "../../domain/model/customer.types";
import type { Customer360ReadModel } from "../model/customer360ReadModel";

export interface CustomerListRow {
  customer: Customer;
  model: Customer360ReadModel;
}

export type CustomerListColumn =
  | "code"
  | "customer"
  | "primaryContact"
  | "phone"
  | "email"
  | "status"
  | "health"
  | "type"
  | "segment"
  | "owner"
  | "revenue"
  | "orders"
  | "openDeals"
  | "openWork"
  | "openSupport"
  | "lastPurchase"
  | "nextCare";

export interface CustomerListFilterSnapshot {
  searchTerm: string;
  typeFilter: CustomerType | "all";
  statusFilter: CustomerStatus | "all";
  healthFilter: CustomerHealth | "all";
  ownerFilter: string;
  segmentFilter: string;
  nextCareDateFilter: string;
}

export interface CustomerListPresentationSnapshot {
  visibleColumnIds: string[];
  orderedColumnIds: string[];
  columnWidths?: Record<string, number>;
  filters?: Partial<CustomerListFilterSnapshot>;
  viewMode?: "card" | "table";
}

export interface CustomerSavedViewItem {
  key: string;
  labelVi: string;
  labelEn: string;
  isShared: boolean;
  presentation?: CustomerListPresentationSnapshot;
  createdAt?: string;
  updatedAt?: string;
}
