import { useMemo, useState } from "react";
import type { CustomerHealth, CustomerStatus, CustomerType } from "../../domain/model/customer.types";
import type { CustomerListFilterSnapshot } from "../list/customerList.types";

export function useCustomerListFilters() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<CustomerType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | "all">("all");
  const [healthFilter, setHealthFilter] = useState<CustomerHealth | "all">("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [nextCareDateFilter, setNextCareDateFilter] = useState("");

  const activeFiltersCount = useMemo(() => [
    typeFilter !== "all",
    statusFilter !== "all",
    healthFilter !== "all",
    ownerFilter !== "all",
    segmentFilter !== "all",
    Boolean(nextCareDateFilter),
  ].filter(Boolean).length, [healthFilter, nextCareDateFilter, ownerFilter, segmentFilter, statusFilter, typeFilter]);

  const hasActiveFilters = activeFiltersCount > 0;

  const resetFilters = () => {
    setTypeFilter("all");
    setStatusFilter("all");
    setHealthFilter("all");
    setOwnerFilter("all");
    setSegmentFilter("all");
    setNextCareDateFilter("");
  };

  const applyFilterSnapshot = (snapshot: CustomerListFilterSnapshot) => {
    setSearchTerm(snapshot.searchTerm);
    setTypeFilter(snapshot.typeFilter);
    setStatusFilter(snapshot.statusFilter);
    setHealthFilter(snapshot.healthFilter);
    setOwnerFilter(snapshot.ownerFilter);
    setSegmentFilter(snapshot.segmentFilter);
    setNextCareDateFilter(snapshot.nextCareDateFilter);
  };

  return {
    searchTerm,
    setSearchTerm,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    healthFilter,
    setHealthFilter,
    ownerFilter,
    setOwnerFilter,
    segmentFilter,
    setSegmentFilter,
    nextCareDateFilter,
    setNextCareDateFilter,
    activeFiltersCount,
    hasActiveFilters,
    resetFilters,
    applyFilterSnapshot,
  };
}
