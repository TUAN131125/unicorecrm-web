import { useMemo, useState } from "react";
import type { Lead } from "../../domain/model/lead.types";

import type { RecordOwnershipContext } from "@/platform/record-ownership";
import {
  LeadWorkState,
  QualificationOutcome,
  getLeadLifecycleDisplayKey,
  isPositiveQualificationOutcome,
} from "../../domain/model/leadLifecycle.canonical";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import { toDateKeyInTimeZone } from "@/shared/lib/datetime/workspaceDateTime";
import { buildLeadDuplicateIndex } from "../../application/queries/leadDuplicateIndex";

export interface LeadFiltersState {
  /** Presentation-only lifecycle filter: active work state or closed outcome. */
  status: string;
  ownerId: string;
  source: string;
  campaignId: string;
  nextFollowUpAt: string;
  overdue: boolean | null;
  qualificationOutcome: string;
  recontactAt: string;
  converted: string;
  duplicate: boolean | null;
}

export type LeadSortField = "createdAt" | "name" | "score" | "nextFollowUpAt";
export interface LeadSortState {
  field: LeadSortField;
  direction: "asc" | "desc";
}

export const INITIAL_LEAD_FILTERS: LeadFiltersState = {
  status: "",
  ownerId: "",
  source: "",
  campaignId: "",
  nextFollowUpAt: "",
  overdue: null,
  qualificationOutcome: "",
  recontactAt: "",
  converted: "",
  duplicate: null,
};

export const DEFAULT_LEAD_SORT: LeadSortState = { field: "createdAt", direction: "desc" };

function compareNullable(a: string | number | undefined, b: string | number | undefined): number {
  if (a === b) return 0;
  if (a === undefined || a === "") return 1;
  if (b === undefined || b === "") return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export const useLeadFilters = (leads: Lead[], activeView: string, ownership: RecordOwnershipContext | null = null) => {
  const configuration = useWorkspaceOperationalConfiguration();
  const workspaceTimeZone = configuration.localeRegion.timezone;
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<LeadFiltersState>(INITIAL_LEAD_FILTERS);
  const [sort, setSort] = useState<LeadSortState>(DEFAULT_LEAD_SORT);

  const resetFilters = () => {
    setSearchTerm("");
    setFilters(INITIAL_LEAD_FILTERS);
    setSort(DEFAULT_LEAD_SORT);
  };

  const hasActiveFilters = useMemo(() => Boolean(
    filters.status ||
    filters.ownerId ||
    filters.source ||
    filters.campaignId ||
    filters.nextFollowUpAt ||
    filters.qualificationOutcome ||
    filters.recontactAt ||
    filters.converted ||
    filters.duplicate !== null ||
    filters.overdue !== null
  ), [filters]);

  const activeFiltersCount = useMemo(() => [
    filters.status,
    filters.ownerId,
    filters.source,
    filters.campaignId,
    filters.nextFollowUpAt,
    filters.overdue !== null ? "overdue" : "",
    filters.qualificationOutcome,
    filters.recontactAt,
    filters.converted,
    filters.duplicate !== null ? "duplicate" : "",
  ].filter(Boolean).length, [filters]);

  const filteredLeads = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
    const now = Date.now();
    const todayStr = toDateKeyInTimeZone(new Date(), workspaceTimeZone);
    const dateKey = (value: string | undefined) => {
      if (!value) return "";
      try {
        return toDateKeyInTimeZone(value, workspaceTimeZone);
      } catch {
        return value.slice(0, 10);
      }
    };

    const duplicateIndex = buildLeadDuplicateIndex(leads, { excludePositiveOutcomes: true });

    const result = leads.filter((lead) => {
      const matchesSearch = !normalizedSearch ||
        lead.name.toLocaleLowerCase().includes(normalizedSearch) ||
        (lead.companyName || "").toLocaleLowerCase().includes(normalizedSearch) ||
        (lead.email || "").toLocaleLowerCase().includes(normalizedSearch) ||
        (lead.phone || "").includes(normalizedSearch);
      if (!matchesSearch) return false;

      let matchesView = true;
      const positiveOutcome = isPositiveQualificationOutcome(lead.qualificationOutcome);

      if (activeView === "my_leads") {
        matchesView = ownership ? lead.ownerId === ownership.memberId : true;
      } else if (activeView === "team_leads") {
        const teamOwnerIds = ownership
          ? new Set(ownership.visibleOwners
              .filter((owner) => owner.teamIds.some((teamId) => ownership.teamIds.includes(teamId)))
              .map((owner) => owner.memberId))
          : null;
        matchesView = teamOwnerIds ? teamOwnerIds.has(lead.ownerId || "") : true;
      } else if (activeView === "new") {
        matchesView = lead.leadWorkState === LeadWorkState.NEW;
      } else if (activeView === "contacted") {
        matchesView = lead.leadWorkState === LeadWorkState.CONTACTING;
      } else if (activeView === "qualified") {
        matchesView = lead.leadWorkState === LeadWorkState.VERIFYING;
      } else if (activeView === "converted") {
        matchesView = positiveOutcome;
      } else if (activeView === "contact_today") {
        const isToday = dateKey(lead.nextFollowUpAt) === todayStr;
        matchesView = lead.leadWorkState !== LeadWorkState.CLOSED && isToday;
      } else if (activeView === "overdue") {
        const isOverdue = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).getTime() < now : false;
        matchesView = isOverdue && lead.leadWorkState !== LeadWorkState.CLOSED;
      } else if (activeView === "nurture") {
        matchesView = lead.qualificationOutcome === QualificationOutcome.NURTURE;
      } else if (activeView === "disqualified") {
        matchesView = lead.qualificationOutcome === QualificationOutcome.DISQUALIFIED;
      } else if (activeView === "duplicates") {
        matchesView = !positiveOutcome && duplicateIndex.duplicateLeadIds.has(lead.id);
      } else if (activeView === "default") {
        matchesView = !positiveOutcome;
      }
      if (!matchesView) return false;

      const matchStatus = filters.status ? getLeadLifecycleDisplayKey(lead) === filters.status : true;
      const matchOwner = filters.ownerId ? lead.ownerId === filters.ownerId : true;
      const matchSource = filters.source ? lead.source === filters.source : true;
      const matchCampaign = filters.campaignId ? lead.campaignId === filters.campaignId : true;
      const matchNextFollowUp = filters.nextFollowUpAt
        ? dateKey(lead.nextFollowUpAt) === filters.nextFollowUpAt
        : true;
      const isOverdue = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).getTime() < now : false;
      const matchOverdue = filters.overdue === true
        ? isOverdue && lead.leadWorkState !== LeadWorkState.CLOSED
        : filters.overdue === false
          ? !isOverdue
          : true;
      const matchOutcome = filters.qualificationOutcome
        ? lead.qualificationOutcome === filters.qualificationOutcome
        : true;
      const matchRecontact = filters.recontactAt
        ? dateKey(lead.recontactAt) === filters.recontactAt
        : true;
      const matchConverted = filters.converted === "yes"
        ? positiveOutcome
        : filters.converted === "no"
          ? !positiveOutcome
          : true;

      const hasDuplicate = duplicateIndex.duplicateLeadIds.has(lead.id);
      const matchDuplicate = filters.duplicate === null
        ? true
        : filters.duplicate
          ? hasDuplicate
          : !hasDuplicate;

      return matchStatus && matchOwner && matchSource && matchCampaign && matchNextFollowUp &&
        matchOverdue && matchOutcome && matchRecontact && matchConverted && matchDuplicate;
    });

    return [...result].sort((left, right) => {
      const leftValue = left[sort.field];
      const rightValue = right[sort.field];
      const comparison = compareNullable(leftValue as string | number | undefined, rightValue as string | number | undefined);
      return sort.direction === "asc" ? comparison : -comparison;
    });
  }, [leads, searchTerm, filters, activeView, ownership, sort, workspaceTimeZone]);

  return {
    searchTerm,
    setSearchTerm,
    filters,
    setFilters,
    sort,
    setSort,
    resetFilters,
    hasActiveFilters,
    activeFiltersCount,
    filteredLeads,
  };
};
