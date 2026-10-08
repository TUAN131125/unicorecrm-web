import type { ModuleListQuery } from "@/shared/application";
import type { ContactListFilterSnapshot } from "./contactSavedViewPreferences";

export function composeContactServerListQuery(state: ContactListFilterSnapshot & { activeView: string; sortBy: string }) {
  const unavailable = state.priorityFilter !== "all" || Boolean(state.lastInteractionAtFilter)
    || !["recentlyUpdated", "nameAsc", "nextFollowUp"].includes(state.sortBy)
    || ["teamContacts", "inactiveLongTime", "duplicates", "nearClosing", "noOpportunityYet", "hasOpenOpportunity"].includes(state.activeView);
  const filters: NonNullable<ModuleListQuery["filters"]> = {};
  for (const [key, value] of Object.entries({ status: state.statusFilter, ownerId: state.ownerFilter,
    source: state.sourceFilter, relationshipLevel: state.relationshipLevelFilter,
    decisionRole: state.decisionRoleFilter, link: state.linkFilter })) {
    if (value !== "all") filters[key] = value;
  }
  if (state.nextFollowUpAtFilter) filters.nextFollowUpDate = state.nextFollowUpAtFilter;
  if (state.doNotContactFilter !== null) filters.doNotContact = state.doNotContactFilter;
  if (state.activeView === "myContacts") filters.ownerScope = "my";
  if (state.activeView === "needFollowUpToday") filters.followUp = "today";
  if (state.activeView === "overdueFollowUp") filters.followUp = "overdue";
  if (state.activeView === "inConsulting") filters.status = "in_consulting";
  if (state.activeView === "archived") filters.status = "archived";
  if (state.activeView === "becameCustomer") filters.link = "linked";
  if (state.activeView === "doNotContact") filters.doNotContact = true;
  return { unavailable, query: { search: state.searchTerm, sortBy: state.sortBy, filters } satisfies Omit<ModuleListQuery, "cursor" | "limit"> };
}
