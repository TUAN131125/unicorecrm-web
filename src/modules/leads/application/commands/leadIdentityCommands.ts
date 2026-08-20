import type { CRMActivity } from "@/shared/domain";
import { CAPABILITIES, assertRuntimeCommandAccess, assertRuntimeCapability } from "@/platform/access-control";
import { relationshipRefKey } from "@/platform/identity";
import type { LeadRepository } from "../ports/LeadRepository";
import type {
  Lead,
  LeadConsentChannel,
  LeadConsentDecision,
  LeadConsentLedgerEntry,
  LeadConsentProfile,
  LeadDuplicateResolution,
  LeadInterestedProduct,
  LeadSourceLineageEntry,
} from "../../domain/model/lead.types";
import { assertConnectedDuplicateCluster, getLeadDuplicateMatchKeys } from "../queries/leadIdentityResolution";

export interface RecordLeadConsentInput {
  channel: LeadConsentChannel;
  decision: Exclude<LeadConsentDecision, "UNKNOWN">;
  source: string;
  actorId: string;
  actorName?: string;
  evidence?: string;
  occurredAt?: string;
  expiresAt?: string;
  lawfulBasis?: string;
}

export interface MergeLeadDuplicatesInput {
  survivorLeadId: string;
  duplicateLeadIds: readonly string[];
  reason: string;
  actorId: string;
  actorName?: string;
  occurredAt?: string;
}

export interface ConfirmLeadDuplicatesDistinctInput {
  leadId: string;
  candidateLeadIds: readonly string[];
  reason: string;
  actorId: string;
  occurredAt?: string;
}

function activity(input: { actorId: string; actorName?: string; occurredAt?: string }, title: string, description: string): CRMActivity {
  return {
    id: `lead-identity-${crypto.randomUUID()}`,
    icon: "ShieldCheck",
    title,
    description,
    createdAt: input.occurredAt ?? new Date().toISOString(),
    author: input.actorName || input.actorId,
    type: "system",
  };
}

function consentProfile(current: Lead, entry: LeadConsentLedgerEntry, lawfulBasis?: string): LeadConsentProfile {
  const ledger = [entry, ...(current.consent?.ledger ?? [])]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  const latest: LeadConsentProfile["current"] = {};
  for (const item of ledger) {
    if (latest[item.channel] === undefined) latest[item.channel] = item.decision;
  }
  return {
    current: latest,
    ledger,
    lawfulBasis: lawfulBasis?.trim() || current.consent?.lawfulBasis,
    updatedAt: entry.occurredAt,
  };
}

function isBlocked(decision: LeadConsentDecision | undefined): boolean {
  return decision === "DENIED" || decision === "WITHDRAWN";
}

export function recordLeadConsent(repository: LeadRepository, leadId: string, input: RecordLeadConsentInput): Lead {
  const target = repository.getById(leadId);
  if (!target) throw new Error(`LEAD_NOT_FOUND:${leadId}`);
  assertRuntimeCommandAccess(CAPABILITIES.LEADS_UPDATE, "leads", target);
  const source = input.source.trim();
  if (!source) throw new Error("LEAD_CONSENT_SOURCE_REQUIRED");
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const entry: LeadConsentLedgerEntry = {
    id: `lead-consent-${crypto.randomUUID()}`,
    channel: input.channel,
    decision: input.decision,
    source,
    occurredAt,
    actorId: input.actorId,
    evidence: input.evidence?.trim() || undefined,
    expiresAt: input.expiresAt,
  };
  const consent = consentProfile(target, entry, input.lawfulBasis);
  const next: Lead = {
    ...target,
    consent,
    doNotCall: input.channel === "CALL" ? isBlocked(input.decision) : target.doNotCall,
    doNotEmail: input.channel === "EMAIL" ? isBlocked(input.decision) : target.doNotEmail,
    doNotSms: input.channel === "SMS" ? isBlocked(input.decision) : target.doNotSms,
    doNotZalo: input.channel === "ZALO" ? isBlocked(input.decision) : target.doNotZalo,
    updatedAt: occurredAt,
    updatedBy: input.actorId,
    activities: [activity(input, "LEAD CONSENT RECORDED", `${input.channel}: ${input.decision} via ${source}`), ...target.activities],
  };
  repository.replace(repository.list().map((lead) => lead.id === leadId ? next : lead));
  return structuredClone(next);
}

function uniqueStrings(values: readonly (string | undefined)[]): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function mergeProducts(groups: readonly LeadInterestedProduct[][]): LeadInterestedProduct[] {
  const byProduct = new Map<string, LeadInterestedProduct>();
  groups.flat().forEach((item) => {
    const current = byProduct.get(item.productId);
    if (!current || (item.interestLevel === "high" && current.interestLevel !== "high")) byProduct.set(item.productId, item);
  });
  return [...byProduct.values()].map((item) => structuredClone(item));
}

function mergeConsent(leads: readonly Lead[], occurredAt: string): LeadConsentProfile | undefined {
  const ledger = leads.flatMap((lead) => lead.consent?.ledger ?? [])
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  if (!ledger.length) return undefined;
  const current: LeadConsentProfile["current"] = {};
  for (const item of ledger) if (current[item.channel] === undefined) current[item.channel] = item.decision;
  return {
    current,
    ledger: ledger.map((entry) => structuredClone(entry)),
    lawfulBasis: leads.find((lead) => lead.consent?.lawfulBasis)?.consent?.lawfulBasis,
    updatedAt: occurredAt,
  };
}

function assertRelationshipCompatibility(leads: readonly Lead[]): void {
  const refs = uniqueStrings(leads.map((lead) => lead.relationshipRef ? relationshipRefKey(lead.relationshipRef) : undefined));
  if (refs.length > 1) throw new Error("LEAD_DUPLICATE_RELATIONSHIP_CONFLICT");
}

function mergeLeadValue(survivor: Lead, duplicates: readonly Lead[], input: MergeLeadDuplicatesInput, occurredAt: string): Lead {
  const all = [survivor, ...duplicates];
  const consent = mergeConsent(all, occurredAt);
  const latestConsent = consent?.current ?? {};
  const sourceLineage: LeadSourceLineageEntry[] = [
    ...(survivor.sourceLineage ?? []),
    ...duplicates.flatMap((lead) => lead.sourceLineage ?? []),
    ...duplicates.map((lead) => ({
      signalId: `merge-${crypto.randomUUID()}`,
      source: `MERGED_LEAD:${lead.id}`,
      occurredAt,
      sourceRecordId: lead.id,
    })),
  ];
  const resolution: LeadDuplicateResolution = {
    status: "MERGED",
    candidateLeadIds: duplicates.map((lead) => lead.id),
    matchedOn: uniqueStrings(duplicates.flatMap((lead) => getLeadDuplicateMatchKeys(survivor, lead))) as Array<"EMAIL" | "PHONE">,
    reviewedAt: occurredAt,
    reviewedBy: input.actorId,
    reason: input.reason.trim(),
    survivorLeadId: survivor.id,
  };
  return {
    ...survivor,
    name: survivor.name || duplicates.find((lead) => lead.name)?.name || survivor.name,
    title: survivor.title || duplicates.find((lead) => lead.title)?.title || survivor.title,
    companyName: survivor.companyName || duplicates.find((lead) => lead.companyName)?.companyName || survivor.companyName,
    email: survivor.email || duplicates.find((lead) => lead.email)?.email || survivor.email,
    phone: survivor.phone || duplicates.find((lead) => lead.phone)?.phone || survivor.phone,
    representativeName: survivor.representativeName || duplicates.find((lead) => lead.representativeName)?.representativeName,
    companyPhone: survivor.companyPhone || duplicates.find((lead) => lead.companyPhone)?.companyPhone,
    zaloId: survivor.zaloId || duplicates.find((lead) => lead.zaloId)?.zaloId,
    address: survivor.address || duplicates.find((lead) => lead.address)?.address,
    notes: uniqueStrings(all.map((lead) => lead.notes)).join("\n\n") || undefined,
    tags: uniqueStrings(all.flatMap((lead) => lead.tags ?? [])),
    sourceLineage,
    interestedProducts: mergeProducts(all.map((lead) => lead.interestedProducts)),
    activities: [
      activity(input, "LEAD DUPLICATES MERGED", `Merged ${duplicates.map((lead) => lead.id).join(", ")} into ${survivor.id}. ${input.reason.trim()}`),
      ...all.flatMap((lead) => lead.activities),
    ].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))),
    consent,
    doNotCall: isBlocked(latestConsent.CALL) || all.some((lead) => lead.doNotCall),
    doNotEmail: isBlocked(latestConsent.EMAIL) || all.some((lead) => lead.doNotEmail),
    doNotSms: isBlocked(latestConsent.SMS) || all.some((lead) => lead.doNotSms),
    doNotZalo: isBlocked(latestConsent.ZALO) || all.some((lead) => lead.doNotZalo),
    mergedLeadIds: uniqueStrings([...(survivor.mergedLeadIds ?? []), ...duplicates.flatMap((lead) => [lead.id, ...(lead.mergedLeadIds ?? [])])]),
    duplicateResolution: resolution,
    distinctFromLeadIds: [],
    updatedAt: occurredAt,
    updatedBy: input.actorId,
  };
}

export function mergeLeadDuplicates(repository: LeadRepository, input: MergeLeadDuplicatesInput): Lead[] {
  assertRuntimeCapability(CAPABILITIES.LEADS_BULK);
  const reason = input.reason.trim();
  if (!reason) throw new Error("LEAD_DUPLICATE_MERGE_REASON_REQUIRED");
  const duplicateIds = uniqueStrings(input.duplicateLeadIds).filter((id) => id !== input.survivorLeadId);
  if (!duplicateIds.length) throw new Error("LEAD_DUPLICATE_MERGE_SOURCE_REQUIRED");
  const byId = new Map(repository.list().map((lead) => [lead.id, lead]));
  const survivor = byId.get(input.survivorLeadId);
  const duplicates = duplicateIds.map((id) => byId.get(id));
  if (!survivor || duplicates.some((lead) => !lead)) throw new Error("LEAD_DUPLICATE_RECORD_NOT_FOUND");
  const resolvedDuplicates = duplicates.filter((lead): lead is Lead => Boolean(lead));
  const cluster = [survivor, ...resolvedDuplicates];
  cluster.forEach((lead) => assertRuntimeCommandAccess(CAPABILITIES.LEADS_BULK, "leads", lead));
  assertConnectedDuplicateCluster(cluster);
  assertRelationshipCompatibility(cluster);
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const merged = mergeLeadValue(survivor, resolvedDuplicates, input, occurredAt);
  const mergedIds = new Set(resolvedDuplicates.map((lead) => lead.id));
  const next = repository.list().map((lead) => {
    if (lead.id === survivor.id) return merged;
    if (!mergedIds.has(lead.id)) return lead;
    return {
      ...lead,
      archivedAt: occurredAt,
      archiveReason: `MERGED_INTO:${survivor.id}`,
      mergedIntoLeadId: survivor.id,
      duplicateResolution: {
        status: "MERGED",
        candidateLeadIds: [survivor.id],
        matchedOn: getLeadDuplicateMatchKeys(lead, survivor),
        reviewedAt: occurredAt,
        reviewedBy: input.actorId,
        reason,
        survivorLeadId: survivor.id,
      },
      updatedAt: occurredAt,
      updatedBy: input.actorId,
      activities: [activity(input, "LEAD MERGED INTO SURVIVOR", `Merged into ${survivor.id}. ${reason}`), ...lead.activities],
    } satisfies Lead;
  });
  repository.replace(next);
  return structuredClone([merged, ...next.filter((lead) => mergedIds.has(lead.id))]);
}

export function confirmLeadDuplicatesDistinct(repository: LeadRepository, input: ConfirmLeadDuplicatesDistinctInput): Lead[] {
  assertRuntimeCapability(CAPABILITIES.LEADS_BULK);
  const reason = input.reason.trim();
  if (!reason) throw new Error("LEAD_DUPLICATE_REVIEW_REASON_REQUIRED");
  const ids = uniqueStrings([input.leadId, ...input.candidateLeadIds]);
  if (ids.length < 2) throw new Error("LEAD_DUPLICATE_REVIEW_CANDIDATE_REQUIRED");
  const byId = new Map(repository.list().map((lead) => [lead.id, lead]));
  const targets = ids.map((id) => byId.get(id));
  if (targets.some((lead) => !lead)) throw new Error("LEAD_DUPLICATE_RECORD_NOT_FOUND");
  const resolvedTargets = targets.filter((lead): lead is Lead => Boolean(lead));
  resolvedTargets.forEach((lead) => assertRuntimeCommandAccess(CAPABILITIES.LEADS_BULK, "leads", lead));
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const idSet = new Set(ids);
  const updated: Lead[] = [];
  const next = repository.list().map((lead) => {
    if (!idSet.has(lead.id)) return lead;
    const peers = ids.filter((id) => id !== lead.id);
    const value: Lead = {
      ...lead,
      distinctFromLeadIds: uniqueStrings([...(lead.distinctFromLeadIds ?? []), ...peers]),
      duplicateResolution: {
        status: "CONFIRMED_DISTINCT",
        candidateLeadIds: peers,
        matchedOn: uniqueStrings(peers.flatMap((id) => {
          const peer = byId.get(id);
          return peer ? getLeadDuplicateMatchKeys(lead, peer) : [];
        })) as Array<"EMAIL" | "PHONE">,
        reviewedAt: occurredAt,
        reviewedBy: input.actorId,
        reason,
      },
      updatedAt: occurredAt,
      updatedBy: input.actorId,
      activities: [activity(input, "LEAD DUPLICATE REVIEWED", `Confirmed distinct from ${peers.join(", ")}. ${reason}`), ...lead.activities],
    };
    updated.push(value);
    return value;
  });
  repository.replace(next);
  return structuredClone(updated);
}
