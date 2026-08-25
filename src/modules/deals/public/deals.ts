import {
  LocalMutationAuthority,
  MutationCommandError,
  createMutationMetadata,
  getMutationAuthority,
  runBackendProjection,
  type MutationCommandMetadata,
  type MutationOutcome,
  isBusinessOperationUnavailable,
} from "@/shared/application";
import type { Deal, OpportunityStageConfig } from "../domain/model/deal.types";
import {
  archiveDeal,
  archiveDeals,
  updateDealCollection,
  type DealCollectionUpdater,
} from "../application/commands/dealRepositoryCommands";
import {
  createCanonicalDeal,
  changeDealStage,
  setDealNextAction,
  markDealWon,
  markDealLost,
  reassignDeal,
  updateDealForecast,
} from "../application/commands/dealCommands";
import type { DealActivity, DealForecastCategory, DealRecycleDecision, DealWinEvidence } from "../domain/model/deal.types";
import {
  dealRepository,
  dealStageRepository,
  exportDealsCsv,
  getDealApiRuntime,
  isDealConnectedApiRuntime,
} from "../application/composition/dealApplicationServices";
import type {
  DealBatchMutationResult,
  DealCommandOptions,
  DealLineInput,
  DealMutationEvidence,
  DealMutationResult,
  DealVersionedCommandOptions,
  ReplaceDealProfileInput,
} from "../application/ports/DealApiRuntime";

/**
 * True when the Deal repository is the connected projection rather than the demo
 * store. Presentation uses this to keep local Deal projection writes on the demo path,
 * mirroring `isOrderConnectedMode` in the Orders module.
 */
export function isDealConnectedMode(): boolean {
  return isDealConnectedApiRuntime();
}

export function getDealsSnapshot(): Deal[] {
  return dealRepository.list().filter((deal) => !deal.archivedAt);
}

export function getRetainedDealsSnapshot(): Deal[] {
  return dealRepository.list();
}

export function getDealSnapshot(dealId: string): Deal | undefined {
  return dealRepository.getById(dealId);
}

/**
 * Read-model projection only; never a connected mutation authority. Replacing the whole
 * collection is by definition a projection write - it either commits a backend page or
 * evicts the previous one - so it declares that scope itself instead of relying on every
 * caller to remember to.
 */
export function replaceDeals(deals: Deal[]): void {
  runBackendProjection("deals", () => dealRepository.replace(deals));
}

/** Read-projection helper. Connected feature code must use typed async commands. */
export function updateDeals(updater: DealCollectionUpdater): Deal[] {
  if (isDealConnectedApiRuntime()) {
    const current = dealRepository.list();
    const next = typeof updater === "function" ? updater(current) : updater;
    dealRepository.replace(next);
    return dealRepository.list();
  }
  return updateDealCollection(dealRepository, updater);
}

export function subscribeToDeals(listener: (deals: Deal[]) => void): () => void {
  return dealRepository.subscribe((deals) => listener(deals.filter((deal) => !deal.archivedAt)));
}

/** Demo/read-projection only. Connected create must use createDealCommand. */
export function createDealSnapshot(deal: Deal): Deal {
  assertDemoDealMutationAllowed("createDealSnapshot");
  return createCanonicalDeal(dealRepository, deal);
}

export type DealLifecycleMutationMetadata = Partial<MutationCommandMetadata>;

export async function createDealCommand(deal: Deal, metadata: DealLifecycleMutationMetadata = {}): Promise<MutationOutcome<Deal>> {
  const options = createMutationMetadata(`deal.create:${deal.id}`, { ...metadata, actor: metadata.actor ?? { id: deal.ownerId } });
  const result = await getDealApiRuntime().commands.createDeal({
    dealId: deal.id,
    ...editableProfileInput(deal),
    stageCode: String(deal.stage),
    opportunityScore: String(deal.opportunityScore),
    ownerId: deal.ownerId,
    expectedCloseDate: deal.expectedCloseDate,
    forecastCategory: deal.forecastCategory,
    nextActionAt: deal.nextActionAt,
    nextActionSummary: deal.nextActionSummary,
    nextActionTaskId: deal.nextActionRef?.type === "TASK" ? deal.nextActionRef.id : undefined,
  }, options);
  projectDeal(result.deal);
  return dealOutcome("deal.create", options, result);
}

export async function updateDealCommand(
  dealId: string,
  patch: Partial<Omit<Deal, "id" | "ownerId" | "stage" | "activities" | "forecastHistory">>,
  metadata: DealLifecycleMutationMetadata = {},
): Promise<MutationOutcome<Deal>> {
  const current = requireDeal(dealId);
  const next: Deal = {
    ...current,
    ...patch,
    id: current.id,
    ownerId: current.ownerId,
    stage: current.stage,
    activities: current.activities,
    forecastHistory: current.forecastHistory,
  };
  const options = versionedMetadata(dealId, "replace-profile", metadata);
  const result = await getDealApiRuntime().commands.replaceDealProfile(dealId, editableProfileInput(next), options);
  projectDeal(result.deal);
  return dealOutcome("deal.update", options, result);
}

export async function updateDealNextActionCommand(
  dealId: string,
  input: { nextActionAt: string; nextActionSummary?: string; taskId?: string },
  metadata: DealLifecycleMutationMetadata = {},
): Promise<MutationOutcome<Deal>> {
  const options = versionedMetadata(dealId, "update-next-action", metadata);
  const result = await getDealApiRuntime().commands.updateDealNextAction(dealId, input, options);
  projectDeal(result.deal);
  return dealOutcome("deal.update-next-action", options, result);
}

export async function updateDealForecastCommand(
  dealId: string,
  input: { expectedCloseDate?: string; opportunityScore?: number; forecastCategory?: DealForecastCategory; actor?: string },
  metadata: DealLifecycleMutationMetadata = {},
): Promise<MutationOutcome<Deal>> {
  const options = versionedMetadata(dealId, "update-forecast", { ...metadata, actor: metadata.actor ?? (input.actor ? { name: input.actor } : undefined) });
  const result = await getDealApiRuntime().commands.updateDealForecast(dealId, {
    expectedCloseDate: input.expectedCloseDate,
    opportunityScore: input.opportunityScore === undefined ? undefined : String(input.opportunityScore),
    forecastCategory: input.forecastCategory,
  }, options);
  projectDeal(result.deal);
  return dealOutcome("deal.update-forecast", options, result);
}

export async function reassignDealCommand(
  dealId: string,
  input: { ownerId: string; reason: string; activity?: DealActivity },
  metadata: DealLifecycleMutationMetadata = {},
): Promise<MutationOutcome<Deal>> {
  const options = versionedMetadata(dealId, "assign-owner", { ...metadata, actor: metadata.actor ?? { id: input.ownerId } });
  const result = await getDealApiRuntime().commands.assignDealOwner(dealId, { ownerId: input.ownerId, reason: input.reason }, options);
  projectDeal(result.deal);
  return dealOutcome("deal.assign-owner", options, result);
}

export async function archiveDealCommand(
  dealId: string,
  input: Parameters<typeof archiveDeal>[2],
  metadata: DealLifecycleMutationMetadata = {},
): Promise<MutationOutcome<Deal>> {
  const options = versionedMetadata(dealId, "archive", { ...metadata, actor: metadata.actor ?? { id: input.actorId, name: input.actorName } });
  const result = await getDealApiRuntime().commands.archiveDeal(dealId, { reason: input.reason }, options);
  projectDeal(result.deal);
  return dealOutcome("deal.archive", options, result);
}

export async function archiveDealsCommand(
  dealIds: readonly string[],
  input: Parameters<typeof archiveDeals>[2],
  metadata: DealLifecycleMutationMetadata = {},
): Promise<MutationOutcome<Deal[]>> {
  const items = dealIds.map((dealId) => ({ dealId, expectedVersion: requireDealVersion(dealId, "archive-batch") }));
  const options = createMutationMetadata(`deal.archive-many:${[...dealIds].sort().join(",")}`, { ...metadata, actor: metadata.actor ?? { id: input.actorId, name: input.actorName } });
  const result = await getDealApiRuntime().commands.archiveDealsBatch({ items, reason: input.reason }, options);
  projectDeals(result.deals);
  return dealBatchOutcome("deal.archive-many", options, result);
}

export async function transitionDealStageCommand(
  dealId: string,
  stage: string,
  _activity?: DealActivity,
  metadata: DealLifecycleMutationMetadata = {},
): Promise<MutationOutcome<Deal>> {
  const options = versionedMetadata(dealId, "change-stage", metadata);
  const result = await getDealApiRuntime().commands.changeDealStage(dealId, { stageCode: stage }, options);
  projectDeal(result.deal);
  return dealOutcome("deal.change-stage", options, result);
}

export async function closeDealWonCommand(
  dealId: string,
  evidence: DealWinEvidence,
  _activity?: DealActivity,
  metadata: DealLifecycleMutationMetadata = {},
): Promise<MutationOutcome<Deal>> {
  const options = versionedMetadata(dealId, "mark-won", metadata);
  const result = await getDealApiRuntime().commands.markDealWon(dealId, { evidence }, options);
  projectDeal(result.deal);
  return dealOutcome("deal.mark-won", options, result);
}

export async function closeDealLostCommand(
  dealId: string,
  input: { reason: string; note?: string; recycleDecision: DealRecycleDecision; revisitAt?: string; occurredAt: string },
  _activity?: DealActivity,
  metadata: DealLifecycleMutationMetadata = {},
): Promise<MutationOutcome<Deal>> {
  const options = versionedMetadata(dealId, "mark-lost", metadata);
  const result = await getDealApiRuntime().commands.markDealLost(dealId, {
    reason: input.reason,
    note: input.note,
    recycleDecision: input.recycleDecision,
    revisitAt: input.revisitAt,
  }, options);
  projectDeal(result.deal);
  return dealOutcome("deal.mark-lost", options, result);
}

/** Demo-only snapshot mutation. */
export function transitionDealStage(dealId: string, stage: string, activity?: DealActivity): Deal | undefined {
  assertDemoDealMutationAllowed("transitionDealStage");
  return changeDealStage(dealRepository, dealId, stage, activity);
}

/** Demo-only snapshot mutation. */
export function updateDealNextAction(dealId: string, input: { nextActionAt: string; nextActionSummary?: string; taskId?: string }): Deal | undefined {
  assertDemoDealMutationAllowed("updateDealNextAction");
  return setDealNextAction(dealRepository, dealId, input);
}

/** Demo-only snapshot mutation. */
export function updateDealForecastSnapshot(dealId: string, input: { expectedCloseDate?: string; opportunityScore?: number; forecastCategory?: DealForecastCategory; actor?: string }): Deal | undefined {
  assertDemoDealMutationAllowed("updateDealForecastSnapshot");
  return updateDealForecast(dealRepository, dealId, input);
}

/** Demo-only snapshot mutation. */
export function closeDealWon(dealId: string, evidence: DealWinEvidence, activity?: DealActivity): Deal | undefined {
  assertDemoDealMutationAllowed("closeDealWon");
  return markDealWon(dealRepository, dealId, evidence, activity);
}

/** Demo-only snapshot mutation. */
export function closeDealLost(dealId: string, input: { reason: string; note?: string; recycleDecision: DealRecycleDecision; revisitAt?: string; occurredAt: string }, activity?: DealActivity): Deal | undefined {
  assertDemoDealMutationAllowed("closeDealLost");
  return markDealLost(dealRepository, dealId, input, activity);
}

/** Demo-only snapshot mutation. */
export function reassignDealSnapshot(dealId: string, input: { ownerId: string; reason: string; activity?: DealActivity }): Deal | undefined {
  assertDemoDealMutationAllowed("reassignDealSnapshot");
  return reassignDeal(dealRepository, dealId, input);
}

export function getDealStagesSnapshot(): OpportunityStageConfig[] {
  return dealStageRepository.list();
}

export function replaceDealStages(stages: OpportunityStageConfig[]): void {
  dealStageRepository.replace(stages);
}

/**
 * True when the Deal stage configuration cannot be restored authoritatively in the active
 * runtime. Connected mode binds the stage reset to an unavailable operation.
 */
export function isDealStageResetUnavailable(): boolean {
  return isBusinessOperationUnavailable("Deal stage reset");
}

/**
 * True when Deal pipeline configuration cannot be saved authoritatively. Every
 * `/crm-configuration/pipelines` write operation is BLOCKED in OpenAPI.
 */
export function isDealPipelineConfigurationSaveUnavailable(): boolean {
  return isBusinessOperationUnavailable("Deal pipeline configuration save");
}

export function resetDealStages(): OpportunityStageConfig[] {
  return dealStageRepository.reset();
}

export function subscribeToDealStages(listener: (stages: OpportunityStageConfig[]) => void): () => void {
  return dealStageRepository.subscribe(listener);
}

export function getDealPipelines(): import("../domain/model/deal.types").DealPipelineDefinition[] {
  return dealStageRepository.listPipelines();
}

export function replaceDealPipelines(pipelines: import("../domain/model/deal.types").DealPipelineDefinition[]) {
  return dealStageRepository.replacePipelines(pipelines);
}

export type { DealPipelineDefinition } from "../domain/model/deal.types";

export interface DealExportColumn {
  key: string;
  label: string;
  value(deal: Deal): string | number;
}

export function exportDealsSnapshot(filename: string, deals: readonly Deal[], columns: readonly DealExportColumn[]): void {
  if (isDealConnectedApiRuntime()) {
    throw new MutationCommandError({
      code: "DEAL_EXPORT_BACKEND_REQUIRED",
      message: "Connected Deal export requires a backend-owned export operation.",
      category: "INFRASTRUCTURE",
      retryable: false,
      details: { operation: "exportDeals", authority: "docs/api/openapi.json", status: "BLOCKED" },
    });
  }
  exportDealsCsv(filename, deals, columns);
}

export function assertDealDemoImportAllowed(): void {
  assertDemoDealMutationAllowed("importDealsDemoSample");
}

function editableProfileInput(deal: Deal): ReplaceDealProfileInput {
  const currency = (deal.currency || "VND").toUpperCase();
  return {
    name: deal.name,
    buyerRef: deal.buyerRef,
    amount: { amount: String(deal.amount), currency },
    contactId: deal.contactId,
    sourceLeadId: deal.leadId,
    interestedProductIds: [...deal.interestedProducts],
    lineItems: deal.lineItems.map((line) => lineInput(line, currency)),
    notes: deal.notes,
  };
}

function lineInput(line: Deal["lineItems"][number], currency: string): DealLineInput {
  return {
    productId: line.productId,
    quantity: String(line.quantity),
    unitPrice: { amount: String(line.unitPriceSnapshot ?? line.unitPrice ?? 0), currency },
    discountRate: String(line.discountPercent),
    taxRate: line.taxRateSnapshot === undefined && line.taxRate === undefined ? undefined : String(line.taxRateSnapshot ?? line.taxRate),
    taxMode: (line.taxModeSnapshot ?? line.taxMode ?? "none").toUpperCase() as DealLineInput["taxMode"],
    billingCycleSnapshot: line.billingCycleSnapshot,
    descriptionSnapshot: line.descriptionSnapshot ?? line.description,
  };
}

function versionedMetadata(dealId: string, operation: string, metadata: DealLifecycleMutationMetadata): DealVersionedCommandOptions {
  return {
    ...createMutationMetadata(`deal.${operation}:${dealId}`, metadata),
    expectedVersion: normalizeExpectedVersion(metadata.expectedVersion) ?? requireDealVersion(dealId, operation),
  };
}

function normalizeExpectedVersion(value: DealLifecycleMutationMetadata["expectedVersion"]): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === "string" && /^\d+$/u.test(value)) return Number(value);
  return undefined;
}

function requireDealVersion(dealId: string, operation: string): number {
  const version = getDealSnapshot(dealId)?.resourceVersion;
  if (typeof version !== "number") {
    throw new MutationCommandError({
      code: "DEAL_RESOURCE_VERSION_REQUIRED",
      message: `${operation} requires an authoritative Deal resource version.`,
      category: "CONFLICT",
      retryable: false,
      details: { dealId, operation, authority: "docs/api/openapi.json" },
    });
  }
  return version;
}

function requireDeal(dealId: string): Deal {
  const deal = getDealSnapshot(dealId);
  if (!deal) throw new MutationCommandError({ code: "RESOURCE_NOT_FOUND", message: `Deal ${dealId} was not found.`, category: "NOT_FOUND", retryable: false });
  return deal;
}

function projectDeal(deal: Deal): void {
  runBackendProjection("deals", () => {
    const records = dealRepository.list();
    dealRepository.replace(records.some((item) => item.id === deal.id)
      ? records.map((item) => item.id === deal.id ? deal : item)
      : [deal, ...records]);
  });
}

function projectDeals(deals: readonly Deal[]): void {
  runBackendProjection("deals", () => {
    const incoming = new Map(deals.map((deal) => [deal.id, deal]));
    const next = dealRepository.list().map((deal) => incoming.get(deal.id) ?? deal);
    for (const deal of deals) if (!next.some((item) => item.id === deal.id)) next.unshift(deal);
    dealRepository.replace(next);
  });
}

function dealOutcome(commandType: string, options: DealCommandOptions, result: DealMutationResult): MutationOutcome<Deal> {
  return mutationOutcome(commandType, options, result.deal, result.evidence);
}

function dealBatchOutcome(commandType: string, options: DealCommandOptions, result: DealBatchMutationResult): MutationOutcome<Deal[]> {
  return mutationOutcome(commandType, options, [...result.deals], result.evidence);
}

function mutationOutcome<T>(commandType: string, options: DealCommandOptions, data: T, evidence: DealMutationEvidence): MutationOutcome<T> {
  return {
    data,
    commandId: evidence.commandId,
    commandType,
    aggregateType: evidence.aggregateType,
    aggregateId: evidence.aggregateId,
    idempotencyKey: options.idempotencyKey,
    correlationId: evidence.correlationId,
    occurredAt: evidence.occurredAt,
    version: evidence.version,
    outcome: evidence.outcome,
    warnings: [...evidence.warnings],
    emittedEvents: [...evidence.emittedEventIds],
    audit: { authority: evidence.authority === "backend" ? "backend" : "demo", evidenceIds: [...evidence.auditEvidenceIds] },
  };
}

function assertDemoDealMutationAllowed(operation: string): void {
  if (getMutationAuthority() instanceof LocalMutationAuthority) return;
  throw new MutationCommandError({
    code: "CONNECTED_COMMAND_REQUIRES_ASYNC_AUTHORITY",
    message: `${operation} is a demo-only Deal mutation. Use the typed async Deal API command in connected mode.`,
    category: "INFRASTRUCTURE",
    retryable: false,
    details: { operation, authority: "docs/api/openapi.json", decisionId: "DEC-PHASE14-DEAL-API-BOUNDARY" },
  });
}
