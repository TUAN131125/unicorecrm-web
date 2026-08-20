import type { Deal } from "../../domain/model/deal.types";
import { assertDealInvariant, normalizeDealStageCode } from "../../domain/rules/dealStages";
import type { DealRepository } from "../ports/DealRepository";
import { CAPABILITIES, assertRuntimeCommandAccess, assertRuntimeCapability } from "@/platform/access-control";
import { assertDestructiveActionAllowed } from "@/shared/application";
import { appendRecordOwnershipAudit, enforceCreateOwner, getRecordOwnershipContext } from "@/platform/record-ownership";

export type DealCollectionUpdater = Deal[] | ((current: Deal[]) => Deal[]);

function canonicalizeDeal(deal: Deal): Deal {
  return assertDealInvariant({
    ...structuredClone(deal),
    stage: normalizeDealStageCode(deal.stage),
  });
}

export function updateDealCollection(repository: DealRepository, updater: DealCollectionUpdater): Deal[] {
  assertRuntimeCapability(CAPABILITIES.DEALS_UPDATE);
  const current = repository.list();
  const next = typeof updater === "function" ? updater(current) : updater;
  const ownership = getRecordOwnershipContext("deals", CAPABILITIES.DEALS_ASSIGN);
  if (ownership) {
    const currentById = new Map(current.map((deal) => [deal.id, deal]));
    next.forEach((deal) => {
      const previous = currentById.get(deal.id);
      if (!previous) throw new Error("Authenticated Deal creation must use createCanonicalDeal so ownership is enforced.");
      if (previous.ownerId !== deal.ownerId) throw new Error("Deal ownership changes must use reassignDeal with an explicit reason.");
    });
  }
  const canonical = next.map(canonicalizeDeal);
  repository.replace(canonical);
  return repository.list();
}

export function saveDeal(repository: DealRepository, deal: Deal): Deal {
  const current = repository.list();
  const previous = current.find((item) => item.id === deal.id);
  assertRuntimeCommandAccess(previous ? CAPABILITIES.DEALS_UPDATE : CAPABILITIES.DEALS_CREATE, "deals", previous);
  if (previous && getRecordOwnershipContext("deals", CAPABILITIES.DEALS_ASSIGN) && previous.ownerId !== deal.ownerId) {
    throw new Error("Deal ownership changes must use reassignDeal with an explicit reason.");
  }
  const assignment = previous
    ? { ownerId: previous.ownerId, context: null }
    : enforceCreateOwner("deals", CAPABILITIES.DEALS_ASSIGN, deal.ownerId);
  const canonical = canonicalizeDeal({ ...deal, ownerId: assignment.ownerId });
  const exists = Boolean(previous);
  repository.replace(
    exists
      ? current.map((item) => item.id === deal.id ? canonical : item)
      : [canonical, ...current],
  );
  if (!previous) {
    appendRecordOwnershipAudit({
      resourceKey: "deals",
      recordId: canonical.id,
      action: "CREATED",
      nextOwnerId: canonical.ownerId,
      reason: "Owner assigned when the Deal was created.",
    }, assignment.context);
  }
  return structuredClone(canonical);
}

export function updateDeal(
  repository: DealRepository,
  dealId: string,
  transform: (deal: Deal) => Deal,
): Deal | undefined {
  let updated: Deal | undefined;
  repository.replace(repository.list().map((deal) => {
    if (deal.id !== dealId) return deal;
    assertRuntimeCommandAccess(CAPABILITIES.DEALS_UPDATE, "deals", deal);
    const nextDeal = canonicalizeDeal(transform(structuredClone(deal)));
    if (getRecordOwnershipContext("deals", CAPABILITIES.DEALS_ASSIGN) && nextDeal.ownerId !== deal.ownerId) {
      throw new Error("Deal ownership changes must use reassignDeal with an explicit reason.");
    }
    updated = nextDeal;
    return nextDeal;
  }));
  return updated ? structuredClone(updated) : undefined;
}

export function updateManyDeals(
  repository: DealRepository,
  dealIds: readonly string[],
  transform: (deal: Deal) => Deal,
): number {
  assertRuntimeCapability(CAPABILITIES.DEALS_BULK);
  const ids = new Set(dealIds);
  let count = 0;
  repository.replace(repository.list().map((deal) => {
    if (!ids.has(deal.id)) return deal;
    assertRuntimeCommandAccess(CAPABILITIES.DEALS_BULK, "deals", deal);
    count += 1;
    const updated = canonicalizeDeal(transform(structuredClone(deal)));
    if (getRecordOwnershipContext("deals", CAPABILITIES.DEALS_ASSIGN) && updated.ownerId !== deal.ownerId) {
      throw new Error("Deal ownership changes must use reassignDeal with an explicit reason.");
    }
    return updated;
  }));
  return count;
}

export interface DealArchiveCommandInput {
  reason: string;
  actorId: string;
  actorName?: string;
  now?: string;
}

export function archiveDeal(repository: DealRepository, dealId: string, input: DealArchiveCommandInput): Deal {
  const target = repository.getById(dealId);
  if (!target) throw new Error(`Deal ${dealId} not found.`);
  assertRuntimeCommandAccess(CAPABILITIES.DEALS_DELETE, "deals", target);
  assertDestructiveActionAllowed({ recordType: "Deal", retentionClass: "OPERATIONAL", action: "ARCHIVE", reason: input.reason });
  const now = input.now ?? new Date().toISOString();
  const next: Deal = {
    ...target,
    archivedAt: now,
    archiveReason: input.reason.trim(),
    updatedAt: now,
    activities: [{
      id: `deal-retention-${crypto.randomUUID()}`,
      type: "system",
      title: "DEAL ARCHIVED",
      description: input.reason.trim(),
      createdAt: now,
      author: input.actorName || input.actorId,
    }, ...(target.activities ?? [])],
  };
  repository.replace(repository.list().map((deal) => deal.id === dealId ? next : deal));
  return structuredClone(next);
}

export function archiveDeals(repository: DealRepository, dealIds: readonly string[], input: DealArchiveCommandInput): Deal[] {
  assertRuntimeCapability(CAPABILITIES.DEALS_DELETE);
  const ids = new Set(dealIds);
  const archived: Deal[] = [];
  const now = input.now ?? new Date().toISOString();
  const next = repository.list().map((deal) => {
    if (!ids.has(deal.id)) return deal;
    assertRuntimeCommandAccess(CAPABILITIES.DEALS_DELETE, "deals", deal);
    assertDestructiveActionAllowed({ recordType: "Deal", retentionClass: "OPERATIONAL", action: "ARCHIVE", reason: input.reason });
    const value: Deal = { ...deal, archivedAt: now, archiveReason: input.reason.trim(), updatedAt: now };
    archived.push(value);
    return value;
  });
  repository.replace(next);
  return structuredClone(archived);
}
