import type { Lead } from "../../domain/model/lead.types";
import { LeadWorkState } from "../../domain/model/leadLifecycle.canonical";
import { buildLeadDuplicateIndex } from "./leadDuplicateIndex";

export type LeadQueueCategory = "unassigned" | "hot" | "sla" | "duplicate";

export interface LeadQueueGroups {
  unassigned: Lead[];
  hot: Lead[];
  sla: Lead[];
  duplicate: Lead[];
}

export function buildLeadQueueGroups(
  leads: readonly Lead[],
  now = Date.now(),
): LeadQueueGroups {
  const activeLeads = leads.filter((lead) => lead.leadWorkState !== LeadWorkState.CLOSED);
  const duplicateIndex = buildLeadDuplicateIndex(activeLeads);

  return {
    unassigned: activeLeads.filter((lead) => !lead.ownerId || lead.ownerId === "unassigned"),
    hot: activeLeads.filter((lead) => lead.score >= 80),
    sla: activeLeads.filter((lead) => {
      const followUpOverdue = Boolean(
        lead.nextFollowUpAt && new Date(lead.nextFollowUpAt).getTime() < now,
      );
      const newLeadOverdue = lead.leadWorkState === LeadWorkState.NEW
        && new Date(lead.createdAt).getTime() < now - 24 * 60 * 60 * 1000;
      return followUpOverdue || newLeadOverdue;
    }),
    duplicate: activeLeads.filter((lead) => duplicateIndex.duplicateLeadIds.has(lead.id)),

  };
}

export function filterLeadQueue(leads: readonly Lead[], searchTerm: string): Lead[] {
  const search = searchTerm.toLowerCase().trim();
  if (!search) return structuredClone([...leads]);

  return leads.filter((lead) => [
    lead.name,
    lead.companyName,
    lead.phone,
    lead.email,
  ].some((value) => value?.toLowerCase().includes(search)));
}
