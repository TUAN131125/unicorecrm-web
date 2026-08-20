import { useMemo, useState } from "react";

export function useContactListFilters() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [linkFilter, setLinkFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recentlyUpdated");
  const [relationshipLevelFilter, setRelationshipLevelFilter] = useState("all");
  const [decisionRoleFilter, setDecisionRoleFilter] = useState("all");
  const [nextFollowUpAtFilter, setNextFollowUpAtFilter] = useState("");
  const [lastInteractionAtFilter, setLastInteractionAtFilter] = useState("");
  const [doNotContactFilter, setDoNotContactFilter] = useState<boolean | null>(null);

  const hasActiveFilters = useMemo(() => Boolean(
    searchTerm ||
    statusFilter !== "all" ||
    linkFilter !== "all" ||
    sourceFilter !== "all" ||
    ownerFilter !== "all" ||
    priorityFilter !== "all" ||
    relationshipLevelFilter !== "all" ||
    decisionRoleFilter !== "all" ||
    nextFollowUpAtFilter ||
    lastInteractionAtFilter ||
    doNotContactFilter !== null
  ), [
    searchTerm,
    statusFilter,
    linkFilter,
    sourceFilter,
    ownerFilter,
    priorityFilter,
    relationshipLevelFilter,
    decisionRoleFilter,
    nextFollowUpAtFilter,
    lastInteractionAtFilter,
    doNotContactFilter,
  ]);

  const activeFiltersCount = useMemo(() => [
    statusFilter !== "all",
    linkFilter !== "all",
    sourceFilter !== "all",
    ownerFilter !== "all",
    priorityFilter !== "all",
    relationshipLevelFilter !== "all",
    decisionRoleFilter !== "all",
    Boolean(nextFollowUpAtFilter),
    Boolean(lastInteractionAtFilter),
    doNotContactFilter !== null,
  ].filter(Boolean).length, [
    statusFilter,
    linkFilter,
    sourceFilter,
    ownerFilter,
    priorityFilter,
    relationshipLevelFilter,
    decisionRoleFilter,
    nextFollowUpAtFilter,
    lastInteractionAtFilter,
    doNotContactFilter,
  ]);

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setLinkFilter("all");
    setSourceFilter("all");
    setOwnerFilter("all");
    setPriorityFilter("all");
    setRelationshipLevelFilter("all");
    setDecisionRoleFilter("all");
    setNextFollowUpAtFilter("");
    setLastInteractionAtFilter("");
    setDoNotContactFilter(null);
    setSortBy("recentlyUpdated");
  };

  return {
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    linkFilter, setLinkFilter,
    sourceFilter, setSourceFilter,
    ownerFilter, setOwnerFilter,
    priorityFilter, setPriorityFilter,
    sortBy, setSortBy,
    relationshipLevelFilter, setRelationshipLevelFilter,
    decisionRoleFilter, setDecisionRoleFilter,
    nextFollowUpAtFilter, setNextFollowUpAtFilter,
    lastInteractionAtFilter, setLastInteractionAtFilter,
    doNotContactFilter, setDoNotContactFilter,
    hasActiveFilters,
    activeFiltersCount,
    resetFilters,
  };
}
