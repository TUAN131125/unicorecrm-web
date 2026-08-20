import type { BuyerRef } from "@/platform/identity";
import type { AuthoritativePage, ModuleListQuery } from "@/shared/application";
import type { MoneyDto } from "@/shared/money";
import type {
  Deal,
  DealForecastCategory,
  DealRecycleDecision,
  DealWinEvidence,
} from "../../domain/model/deal.types";

export type DealApiRuntimeMode = "demo" | "connected" | "test";

export interface DealListQuery extends ModuleListQuery {
  filters?: {
    stageCode?: string;
    stageCategory?: "OPEN" | "WON" | "LOST";
    ownerId?: string;
    buyerType?: BuyerRef["type"];
    buyerId?: string;
  };
}

export interface DealLineInput {
  productId: string;
  quantity: string;
  unitPrice: MoneyDto;
  discountRate: string;
  taxRate?: string;
  taxMode: "EXCLUSIVE" | "INCLUSIVE" | "NONE";
  billingCycleSnapshot?: string;
  descriptionSnapshot?: string;
}

export interface DealEditableProfileInput {
  name: string;
  buyerRef: BuyerRef;
  amount: MoneyDto;
  contactId?: string;
  sourceLeadId?: string;
  interestedProductIds?: readonly string[];
  lineItems?: readonly DealLineInput[];
  notes?: string;
}

export interface CreateDealInput extends DealEditableProfileInput {
  dealId: string;
  stageCode: string;
  opportunityScore: string;
  ownerId: string;
  expectedCloseDate: string;
  forecastCategory?: DealForecastCategory;
  nextActionAt?: string;
  nextActionSummary?: string;
  nextActionTaskId?: string;
}
export type ReplaceDealProfileInput = DealEditableProfileInput;
export interface ChangeDealStageInput { stageCode: string; }
export interface AssignDealOwnerInput { ownerId: string; reason: string; }
export interface UpdateDealForecastInput {
  expectedCloseDate?: string;
  opportunityScore?: string;
  forecastCategory?: DealForecastCategory;
}
export interface UpdateDealNextActionInput {
  nextActionAt: string;
  nextActionSummary?: string;
  taskId?: string;
}
export interface MarkDealWonInput { evidence: DealWinEvidence; }
export interface MarkDealLostInput {
  reason: string;
  note?: string;
  recycleDecision: DealRecycleDecision;
  revisitAt?: string;
}
export interface ArchiveDealInput { reason: string; }
export interface ArchiveDealsBatchInput {
  items: readonly { dealId: string; expectedVersion: number }[];
  reason: string;
}

export interface DealForecastCurrencyBucket {
  currency: string;
  openDealCount: number;
  overdueDealCount: number;
  closingThisMonthCount: number;
  openAmount: MoneyDto;
  commitAmount: MoneyDto;
  bestCaseAmount: MoneyDto;
  pipelineAmount: MoneyDto;
  weightedAmount: MoneyDto;
}

export interface DealForecastSummary {
  asOf: string;
  buckets: readonly DealForecastCurrencyBucket[];
  permissionFiltered: boolean;
}

export interface DealCommandOptions {
  idempotencyKey: string;
  correlationId?: string;
  signal?: AbortSignal;
}

export interface DealVersionedCommandOptions extends DealCommandOptions {
  expectedVersion: number;
}

export interface DealMutationEvidence {
  authority: "backend" | "demo" | "test";
  commandId: string;
  correlationId: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  occurredAt: string;
  outcome: "COMMITTED" | "REPLAYED" | "DEMO_COMMITTED";
  warnings: readonly string[];
  emittedEventIds: readonly string[];
  auditEvidenceIds: readonly string[];
}

export interface DealMutationResult {
  deal: Deal;
  evidence: DealMutationEvidence;
}

export interface DealBatchMutationResult {
  deals: readonly Deal[];
  evidence: DealMutationEvidence;
}

export interface DealQueryPort {
  list(query?: DealListQuery, signal?: AbortSignal): Promise<AuthoritativePage<Deal>>;
  get(dealId: string, signal?: AbortSignal): Promise<Deal>;
  getForecastSummary(query?: Pick<DealListQuery, "filters">, signal?: AbortSignal): Promise<DealForecastSummary>;
}

export interface DealCommandPort {
  createDeal(input: CreateDealInput, options: DealCommandOptions): Promise<DealMutationResult>;
  replaceDealProfile(dealId: string, input: ReplaceDealProfileInput, options: DealVersionedCommandOptions): Promise<DealMutationResult>;
  changeDealStage(dealId: string, input: ChangeDealStageInput, options: DealVersionedCommandOptions): Promise<DealMutationResult>;
  assignDealOwner(dealId: string, input: AssignDealOwnerInput, options: DealVersionedCommandOptions): Promise<DealMutationResult>;
  updateDealForecast(dealId: string, input: UpdateDealForecastInput, options: DealVersionedCommandOptions): Promise<DealMutationResult>;
  updateDealNextAction(dealId: string, input: UpdateDealNextActionInput, options: DealVersionedCommandOptions): Promise<DealMutationResult>;
  markDealWon(dealId: string, input: MarkDealWonInput, options: DealVersionedCommandOptions): Promise<DealMutationResult>;
  markDealLost(dealId: string, input: MarkDealLostInput, options: DealVersionedCommandOptions): Promise<DealMutationResult>;
  archiveDeal(dealId: string, input: ArchiveDealInput, options: DealVersionedCommandOptions): Promise<DealMutationResult>;
  archiveDealsBatch(input: ArchiveDealsBatchInput, options: DealCommandOptions): Promise<DealBatchMutationResult>;
}

export interface DealApiRuntime {
  mode: DealApiRuntimeMode;
  queries: DealQueryPort;
  commands: DealCommandPort;
}
