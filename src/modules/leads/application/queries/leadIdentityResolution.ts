import type { Lead } from "../../domain/model/lead.types";
import { normalizeLeadEmail, normalizeLeadPhone } from "./leadDuplicateIndex";

export type LeadDuplicateMatchKey = "EMAIL" | "PHONE";

export interface LeadDuplicateCandidate {
  lead: Lead;
  matchedOn: LeadDuplicateMatchKey[];
}

function isExplicitlyDistinct(left: Lead, right: Lead): boolean {
  return Boolean(left.distinctFromLeadIds?.includes(right.id) || right.distinctFromLeadIds?.includes(left.id));
}

export function getLeadDuplicateMatchKeys(left: Lead, right: Lead): LeadDuplicateMatchKey[] {
  if (left.id === right.id || isExplicitlyDistinct(left, right)) return [];
  const matches: LeadDuplicateMatchKey[] = [];
  const leftEmail = normalizeLeadEmail(left.email);
  const rightEmail = normalizeLeadEmail(right.email);
  if (leftEmail && leftEmail === rightEmail) matches.push("EMAIL");
  const leftPhone = normalizeLeadPhone(left.phone);
  const rightPhone = normalizeLeadPhone(right.phone);
  if (leftPhone && leftPhone === rightPhone) matches.push("PHONE");
  return matches;
}

export function getLeadDuplicateCandidates(lead: Lead, leads: readonly Lead[]): LeadDuplicateCandidate[] {
  return leads
    .filter((candidate) => !candidate.archivedAt && candidate.id !== lead.id)
    .map((candidate) => ({ lead: candidate, matchedOn: getLeadDuplicateMatchKeys(lead, candidate) }))
    .filter((candidate) => candidate.matchedOn.length > 0);
}

export function assertConnectedDuplicateCluster(leads: readonly Lead[]): void {
  if (leads.length < 2) throw new Error("LEAD_DUPLICATE_CLUSTER_REQUIRES_MULTIPLE_RECORDS");
  const visited = new Set<string>([leads[0].id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const lead of leads) {
      if (visited.has(lead.id)) continue;
      if (leads.some((candidate) => visited.has(candidate.id) && getLeadDuplicateMatchKeys(lead, candidate).length > 0)) {
        visited.add(lead.id);
        changed = true;
      }
    }
  }
  if (visited.size !== leads.length) throw new Error("LEAD_DUPLICATE_CLUSTER_NOT_CONNECTED");
}
