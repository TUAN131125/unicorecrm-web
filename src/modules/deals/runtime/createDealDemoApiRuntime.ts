import type { AuthoritativePage } from "@/shared/application";
import { addMoney, money, percentageOfMoney } from "@/shared/money";
import {
  archiveDeal,
  archiveDeals,
  updateDeal,
} from "../application/commands/dealRepositoryCommands";
import {
  changeDealStage,
  createCanonicalDeal,
  markDealLost,
  markDealWon,
  reassignDeal,
  setDealNextAction,
  updateDealForecast,
} from "../application/commands/dealCommands";
import type {
  ArchiveDealInput,
  ArchiveDealsBatchInput,
  AssignDealOwnerInput,
  ChangeDealStageInput,
  CreateDealInput,
  DealApiRuntime,
  DealBatchMutationResult,
  DealCommandOptions,
  DealForecastCurrencyBucket,
  DealForecastSummary,
  DealListQuery,
  DealMutationEvidence,
  DealMutationResult,
  DealVersionedCommandOptions,
  MarkDealLostInput,
  MarkDealWonInput,
  ReplaceDealProfileInput,
  UpdateDealForecastInput,
  UpdateDealNextActionInput,
} from "../application/ports/DealApiRuntime";
import type { DealRepository } from "../application/ports/DealRepository";
import { DealStage, type Deal, type DealLineItem } from "../domain/model/deal.types";

export function createDealDemoApiRuntime(repository: DealRepository): DealApiRuntime {
  return {
    mode: "demo",
    queries: {
      async list(query: DealListQuery = {}): Promise<AuthoritativePage<Deal>> {
        const items = filterDeals(repository.list().filter((deal) => !deal.archivedAt), query);
        return {
          items,
          pageInfo: { hasNextPage: false, totalCount: items.length },
          loadedAt: new Date().toISOString(),
          authority: "demo",
        };
      },
      async get(dealId: string): Promise<Deal> {
        return requireDeal(repository, dealId);
      },
      async getForecastSummary(query = {}): Promise<DealForecastSummary> {
        const deals = filterDeals(repository.list().filter((deal) => !deal.archivedAt), { filters: query.filters });
        return buildForecastSummary(deals);
      },
    },
    commands: {
      async createDeal(input: CreateDealInput, options: DealCommandOptions): Promise<DealMutationResult> {
        const now = new Date().toISOString();
        const deal = createCanonicalDeal(repository, {
          id: input.dealId,
          name: input.name,
          buyerRef: input.buyerRef,
          stage: input.stageCode,
          amount: Number(input.amount.amount),
          currency: input.amount.currency,
          opportunityScore: Number(input.opportunityScore),
          ownerId: input.ownerId,
          expectedCloseDate: input.expectedCloseDate,
          createdAt: now,
          updatedAt: now,
          interestedProducts: [...(input.interestedProductIds ?? [])],
          lineItems: input.lineItems?.map(mapDemoLine) ?? [],
          forecastCategory: input.forecastCategory,
          nextActionAt: input.nextActionAt,
          nextActionSummary: input.nextActionSummary,
          nextActionRef: input.nextActionTaskId ? { type: "TASK", id: input.nextActionTaskId } : input.nextActionAt ? { type: "MANUAL" } : undefined,
          notes: input.notes,
          contactId: input.contactId,
          leadId: input.sourceLeadId,
          activities: [],
          resourceVersion: 1,
        });
        const versioned = commitVersion(repository, deal, 1);
        return result(versioned, options, now);
      },
      async replaceDealProfile(dealId: string, input: ReplaceDealProfileInput, options: DealVersionedCommandOptions): Promise<DealMutationResult> {
        requireVersion(repository, dealId, options.expectedVersion);
        const updated = updateDeal(repository, dealId, (deal) => ({
          ...deal,
          name: input.name,
          buyerRef: input.buyerRef,
          amount: Number(input.amount.amount),
          currency: input.amount.currency,
          contactId: input.contactId,
          leadId: input.sourceLeadId,
          interestedProducts: [...(input.interestedProductIds ?? [])],
          lineItems: input.lineItems?.map(mapDemoLine) ?? [],
          notes: input.notes,
          updatedAt: new Date().toISOString(),
        }));
        return versionedResult(repository, requireUpdated(updated, dealId), options);
      },
      async changeDealStage(dealId: string, input: ChangeDealStageInput, options: DealVersionedCommandOptions): Promise<DealMutationResult> {
        requireVersion(repository, dealId, options.expectedVersion);
        return versionedResult(repository, requireUpdated(changeDealStage(repository, dealId, input.stageCode), dealId), options);
      },
      async assignDealOwner(dealId: string, input: AssignDealOwnerInput, options: DealVersionedCommandOptions): Promise<DealMutationResult> {
        requireVersion(repository, dealId, options.expectedVersion);
        return versionedResult(repository, requireUpdated(reassignDeal(repository, dealId, { ownerId: input.ownerId, reason: input.reason }), dealId), options);
      },
      async updateDealForecast(dealId: string, input: UpdateDealForecastInput, options: DealVersionedCommandOptions): Promise<DealMutationResult> {
        requireVersion(repository, dealId, options.expectedVersion);
        return versionedResult(repository, requireUpdated(updateDealForecast(repository, dealId, {
          expectedCloseDate: input.expectedCloseDate,
          opportunityScore: input.opportunityScore === undefined ? undefined : Number(input.opportunityScore),
          forecastCategory: input.forecastCategory,
          actor: "Demo User",
        }), dealId), options);
      },
      async updateDealNextAction(dealId: string, input: UpdateDealNextActionInput, options: DealVersionedCommandOptions): Promise<DealMutationResult> {
        requireVersion(repository, dealId, options.expectedVersion);
        return versionedResult(repository, requireUpdated(setDealNextAction(repository, dealId, input), dealId), options);
      },
      async markDealWon(dealId: string, input: MarkDealWonInput, options: DealVersionedCommandOptions): Promise<DealMutationResult> {
        requireVersion(repository, dealId, options.expectedVersion);
        return versionedResult(repository, requireUpdated(markDealWon(repository, dealId, input.evidence), dealId), options);
      },
      async markDealLost(dealId: string, input: MarkDealLostInput, options: DealVersionedCommandOptions): Promise<DealMutationResult> {
        requireVersion(repository, dealId, options.expectedVersion);
        return versionedResult(repository, requireUpdated(markDealLost(repository, dealId, {
          ...input,
          occurredAt: new Date().toISOString(),
        }), dealId), options);
      },
      async archiveDeal(dealId: string, input: ArchiveDealInput, options: DealVersionedCommandOptions): Promise<DealMutationResult> {
        requireVersion(repository, dealId, options.expectedVersion);
        return versionedResult(repository, archiveDeal(repository, dealId, { reason: input.reason, actorId: "demo-user", actorName: "Demo User" }), options);
      },
      async archiveDealsBatch(input: ArchiveDealsBatchInput, options: DealCommandOptions): Promise<DealBatchMutationResult> {
        for (const item of input.items) requireVersion(repository, item.dealId, item.expectedVersion);
        const archived = archiveDeals(repository, input.items.map((item) => item.dealId), { reason: input.reason, actorId: "demo-user", actorName: "Demo User" });
        const versioned = archived.map((deal) => commitVersion(repository, deal, (deal.resourceVersion ?? 0) + 1));
        const occurredAt = versioned[0]?.updatedAt ?? new Date().toISOString();
        return { deals: versioned, evidence: evidence(`deal-batch:${input.items.map((item) => item.dealId).join(",")}`, Math.max(1, ...versioned.map((deal) => deal.resourceVersion ?? 1)), options, occurredAt) };
      },
    },
  };
}

function mapDemoLine(line: CreateDealInput["lineItems"] extends readonly (infer T)[] | undefined ? T : never): DealLineItem {
  const unitPrice = Number(line.unitPrice.amount);
  const quantity = Number(line.quantity);
  const discountPercent = Number(line.discountRate);
  const subtotal = unitPrice * quantity;
  const discountAmount = subtotal * discountPercent / 100;
  const lineTotal = subtotal - discountAmount;
  return {
    id: `deal-line-${crypto.randomUUID()}`,
    productId: line.productId,
    quantity,
    unitPriceSnapshot: unitPrice,
    discountPercent,
    taxRateSnapshot: line.taxRate === undefined ? undefined : Number(line.taxRate),
    taxModeSnapshot: line.taxMode.toLowerCase() as "exclusive" | "inclusive" | "none",
    billingCycleSnapshot: line.billingCycleSnapshot,
    descriptionSnapshot: line.descriptionSnapshot,
    productNameSnapshot: line.productId,
    lineSubtotal: subtotal,
    lineDiscountAmount: discountAmount,
    lineTaxAmount: 0,
    lineTotal,
  };
}

function filterDeals(deals: readonly Deal[], query: DealListQuery): Deal[] {
  const filters = query.filters ?? {};
  const search = query.search?.trim().toLowerCase();
  return deals.filter((deal) => {
    if (search && !`${deal.name} ${deal.customerName ?? ""} ${deal.contactName ?? ""}`.toLowerCase().includes(search)) return false;
    if (filters.stageCode && deal.stage !== filters.stageCode) return false;
    if (filters.stageCategory && category(deal.stage) !== filters.stageCategory) return false;
    if (filters.ownerId && deal.ownerId !== filters.ownerId) return false;
    if (filters.buyerType && deal.buyerRef.type !== filters.buyerType) return false;
    if (filters.buyerId && deal.buyerRef.id !== filters.buyerId) return false;
    return true;
  });
}

function category(stage: Deal["stage"]): "OPEN" | "WON" | "LOST" {
  if (stage === DealStage.WON) return "WON";
  if (stage === DealStage.LOST) return "LOST";
  return "OPEN";
}

function buildForecastSummary(deals: readonly Deal[]): DealForecastSummary {
  const byCurrency = new Map<string, DealForecastCurrencyBucket>();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  for (const deal of deals) {
    if (category(deal.stage) !== "OPEN") continue;
    const currency = (deal.currency || "VND").toUpperCase();
    const current = byCurrency.get(currency) ?? emptyBucket(currency);
    const value = money(String(deal.amount), currency);
    current.openDealCount += 1;
    current.openAmount = addMoney(current.openAmount, value);
    if (deal.expectedCloseDate && deal.expectedCloseDate < today) current.overdueDealCount += 1;
    if (deal.expectedCloseDate?.slice(0, 7) === today.slice(0, 7)) current.closingThisMonthCount += 1;
    const forecast = deal.forecastCategory ?? "PIPELINE";
    if (forecast === "COMMIT") current.commitAmount = addMoney(current.commitAmount, value);
    else if (forecast === "BEST_CASE") current.bestCaseAmount = addMoney(current.bestCaseAmount, value);
    else current.pipelineAmount = addMoney(current.pipelineAmount, value);
    current.weightedAmount = addMoney(current.weightedAmount, percentageOfMoney(value, String(deal.opportunityScore)));
    byCurrency.set(currency, current);
  }
  return { asOf: now.toISOString(), buckets: [...byCurrency.values()].sort((left, right) => left.currency.localeCompare(right.currency)), permissionFiltered: true };
}

function emptyBucket(currency: string): DealForecastCurrencyBucket {
  return {
    currency,
    openDealCount: 0,
    overdueDealCount: 0,
    closingThisMonthCount: 0,
    openAmount: money("0", currency),
    commitAmount: money("0", currency),
    bestCaseAmount: money("0", currency),
    pipelineAmount: money("0", currency),
    weightedAmount: money("0", currency),
  };
}

function requireDeal(repository: DealRepository, dealId: string): Deal {
  const deal = repository.getById(dealId);
  if (!deal) throw new Error(`DEAL_NOT_FOUND:${dealId}`);
  return deal;
}

function requireVersion(repository: DealRepository, dealId: string, expectedVersion: number): Deal {
  const deal = requireDeal(repository, dealId);
  if ((deal.resourceVersion ?? expectedVersion) !== expectedVersion) throw new Error(`DEAL_VERSION_CONFLICT:${dealId}`);
  return deal;
}

function requireUpdated(value: Deal | undefined, dealId: string): Deal {
  if (!value) throw new Error(`DEAL_NOT_FOUND:${dealId}`);
  return value;
}

function commitVersion(repository: DealRepository, deal: Deal, version: number): Deal {
  const next = { ...deal, resourceVersion: version };
  const records = repository.list();
  repository.replace(records.some((item) => item.id === next.id) ? records.map((item) => item.id === next.id ? next : item) : [next, ...records]);
  return structuredClone(next);
}

function versionedResult(repository: DealRepository, deal: Deal, options: DealVersionedCommandOptions): DealMutationResult {
  const versioned = commitVersion(repository, deal, options.expectedVersion + 1);
  return result(versioned, options, versioned.updatedAt);
}

function result(deal: Deal, options: DealCommandOptions, occurredAt: string): DealMutationResult {
  return { deal, evidence: evidence(deal.id, deal.resourceVersion ?? 1, options, occurredAt) };
}

function evidence(aggregateId: string, version: number, options: DealCommandOptions, occurredAt: string): DealMutationEvidence {
  return {
    authority: "demo",
    commandId: options.idempotencyKey,
    correlationId: options.correlationId ?? `corr_${crypto.randomUUID()}`,
    aggregateId,
    aggregateType: "deal",
    version,
    occurredAt,
    outcome: "DEMO_COMMITTED",
    warnings: [],
    emittedEventIds: [],
    auditEvidenceIds: [],
  };
}
