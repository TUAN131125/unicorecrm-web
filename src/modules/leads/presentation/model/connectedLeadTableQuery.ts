import type { LeadListQuery } from "../../application/ports/LeadApiRuntime";
import { LeadWorkState } from "../../domain/model/leadLifecycle.canonical";
import type { LeadFiltersState, LeadSortState } from "../hooks/useLeadFilters";
import type { OwnershipScopeView } from "@/platform/record-ownership";

export const CONNECTED_LEAD_SORT: LeadSortState = { field: "updatedAt", direction: "desc" };
export type ConnectedLeadTableResolution =
  | { kind: "supported"; query: LeadListQuery; order: "updatedAtDescLeadIdDesc" }
  | { kind: "unavailable"; reason: "filter" | "view" | "sort" | "scope" | "combination" };

export function resolveConnectedLeadTableQuery(input: {
  search: string; filters: LeadFiltersState; sort: LeadSortState;
  activeView: string; memberId?: string; canReadQueue: boolean;
  savedOwnershipScope?: OwnershipScopeView;
}): ConnectedLeadTableResolution {
  const { filters, activeView, sort } = input;
  const knownFilters = ["status", "ownerId", "source", "campaignId", "nextFollowUpAt", "overdue",
    "qualificationOutcome", "recontactAt", "converted", "duplicate"];
  if (Object.entries(filters).some(([key, value]) => !knownFilters.includes(key) && value !== undefined && value !== null && value !== "")) {
    return { kind: "unavailable", reason: "filter" };
  }
  if (sort.field !== "updatedAt" || sort.direction !== "desc") return { kind: "unavailable", reason: "sort" };
  if (filters.source || filters.campaignId || filters.nextFollowUpAt || filters.overdue !== null
    || filters.qualificationOutcome || filters.recontactAt || filters.converted || filters.duplicate !== null
    || (filters.status && !Object.values(LeadWorkState).includes(filters.status as LeadWorkState))) {
    return { kind: "unavailable", reason: "filter" };
  }
  const builtIn = ["all", "my_leads", "new", "contacted", "qualified", "unassigned"];
  if (!builtIn.includes(activeView) && !activeView.startsWith("custom_")) return { kind: "unavailable", reason: "view" };
  if (input.savedOwnershipScope === "TEAM") return { kind: "unavailable", reason: "scope" };
  const mine = activeView === "my_leads" || input.savedOwnershipScope === "MINE";
  if (mine && !input.memberId) return { kind: "unavailable", reason: "scope" };
  if (mine && filters.ownerId && filters.ownerId !== input.memberId) return { kind: "unavailable", reason: "combination" };
  const ownerId = filters.ownerId || (mine ? input.memberId : undefined);
  if (activeView === "unassigned" && (!input.canReadQueue || ownerId)) return { kind: "unavailable", reason: "combination" };
  const viewState = activeView === "new" ? LeadWorkState.NEW : activeView === "contacted"
    ? LeadWorkState.CONTACTING : activeView === "qualified" ? LeadWorkState.VERIFYING : undefined;
  if (viewState && filters.status && filters.status !== viewState) return { kind: "unavailable", reason: "combination" };
  const workState = filters.status || viewState;
  return { kind: "supported", order: "updatedAtDescLeadIdDesc", query: {
    ...(input.search.trim() ? { search: input.search.trim() } : {}),
    filters: {
      ...(workState ? { workState } : {}), ...(ownerId ? { ownerId } : {}),
      ...(activeView === "unassigned" ? { assignmentState: "UNASSIGNED" } : {}),
    },
  } };
}
