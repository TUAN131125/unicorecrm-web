import type { ModuleListQuery } from "@/shared/application";
import type { CustomerStatus, CustomerType } from "../../domain/model/customer.types";

export const CONNECTED_CUSTOMER_SAVED_VIEW_KEYS = new Set([
  "allCustomers", "myCustomers", "b2b", "b2c", "active", "atRisk", "archived",
]);

export function buildConnectedCustomerListQuery(input: {
  searchTerm: string;
  typeFilter: CustomerType | "all";
  statusFilter: CustomerStatus | "all";
  ownerFilter: string;
  segmentFilter: string;
  activeView: string;
  principalMemberId?: string;
}): Omit<ModuleListQuery, "cursor" | "limit"> {
  if (input.activeView === "myCustomers" && !input.principalMemberId) {
    throw new Error("Authenticated member context is required for the My Customers view.");
  }
  const filters: Record<string, string> = {};
  const type = input.typeFilter !== "all" ? input.typeFilter : input.activeView === "b2b" ? "B2B" : input.activeView === "b2c" ? "B2C" : undefined;
  const status = input.statusFilter !== "all"
    ? input.statusFilter
    : input.activeView === "active" ? "ACTIVE"
      : input.activeView === "atRisk" ? "AT_RISK"
        : input.activeView === "archived" ? "ARCHIVED" : undefined;
  const ownerId = input.ownerFilter !== "all"
    ? input.ownerFilter
    : input.activeView === "myCustomers" ? input.principalMemberId : undefined;
  if (type) filters.type = type;
  if (status) filters.status = status;
  if (ownerId) filters.ownerId = ownerId;
  if (input.segmentFilter !== "all") filters.segment = input.segmentFilter;
  return { search: input.searchTerm.trim() || undefined, filters };
}
