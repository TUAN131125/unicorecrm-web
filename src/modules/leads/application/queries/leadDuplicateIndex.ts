import type { Lead } from "../../domain/model/lead.types";
import { isPositiveQualificationOutcome } from "../../domain/model/leadLifecycle.canonical";

export interface LeadDuplicateIndex {
  duplicateLeadIds: ReadonlySet<string>;
  emailCounts: ReadonlyMap<string, number>;
  phoneCounts: ReadonlyMap<string, number>;
}

export function normalizeLeadEmail(value: string | undefined): string {
  return value?.trim().toLocaleLowerCase() || "";
}

export function normalizeLeadPhone(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  return digits || trimmed.toLocaleLowerCase();
}

function appendGroup(map: Map<string, Lead[]>, key: string, lead: Lead): void {
  if (!key) return;
  const group = map.get(key);
  if (group) group.push(lead);
  else map.set(key, [lead]);
}

function countMap(groups: ReadonlyMap<string, readonly Lead[]>): Map<string, number> {
  return new Map([...groups].map(([key, values]) => [key, values.length]));
}

function buildDistinctExclusions(leads: readonly Lead[]): Map<string, Set<string>> {
  const exclusions = new Map<string, Set<string>>();
  const add = (left: string, right: string) => {
    const set = exclusions.get(left) ?? new Set<string>();
    set.add(right);
    exclusions.set(left, set);
  };
  leads.forEach((lead) => {
    lead.distinctFromLeadIds?.forEach((peerId) => {
      add(lead.id, peerId);
      add(peerId, lead.id);
    });
  });
  return exclusions;
}

function markUnresolvedGroup(
  group: readonly Lead[],
  exclusions: ReadonlyMap<string, ReadonlySet<string>>,
  duplicateLeadIds: Set<string>,
): void {
  if (group.length < 2) return;
  const groupIds = new Set(group.map((lead) => lead.id));
  group.forEach((lead) => {
    const excluded = exclusions.get(lead.id);
    if (!excluded?.size) {
      duplicateLeadIds.add(lead.id);
      return;
    }
    let excludedInGroup = 0;
    excluded.forEach((peerId) => {
      if (groupIds.has(peerId)) excludedInGroup += 1;
    });
    if (group.length - 1 > excludedInGroup) duplicateLeadIds.add(lead.id);
  });
}

export function buildLeadDuplicateIndex(
  leads: readonly Lead[],
  options: { excludePositiveOutcomes?: boolean } = {},
): LeadDuplicateIndex {
  const candidates = options.excludePositiveOutcomes
    ? leads.filter((lead) => !isPositiveQualificationOutcome(lead.qualificationOutcome))
    : leads;
  const emailGroups = new Map<string, Lead[]>();
  const phoneGroups = new Map<string, Lead[]>();
  candidates.forEach((lead) => {
    appendGroup(emailGroups, normalizeLeadEmail(lead.email), lead);
    appendGroup(phoneGroups, normalizeLeadPhone(lead.phone), lead);
  });

  const exclusions = buildDistinctExclusions(candidates);
  const duplicateLeadIds = new Set<string>();
  emailGroups.forEach((group) => markUnresolvedGroup(group, exclusions, duplicateLeadIds));
  phoneGroups.forEach((group) => markUnresolvedGroup(group, exclusions, duplicateLeadIds));

  return {
    duplicateLeadIds,
    emailCounts: countMap(emailGroups),
    phoneCounts: countMap(phoneGroups),
  };
}
