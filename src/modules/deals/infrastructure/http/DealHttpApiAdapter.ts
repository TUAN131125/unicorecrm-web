import type {
  CommercialApiClient,
  DealBatchMutationResponse,
  DealForecastSummaryReadModel,
  DealListResponse,
  DealMutationResponse,
} from "@/platform/api/generated/commercialApi";
import type { AuthoritativePage } from "@/shared/application";
import type {
  ArchiveDealInput,
  ArchiveDealsBatchInput,
  AssignDealOwnerInput,
  ChangeDealStageInput,
  CreateDealInput,
  DealBatchMutationResult,
  DealCommandOptions,
  DealForecastSummary,
  DealListQuery,
  DealMutationResult,
  DealQueryPort,
  DealCommandPort,
  DealVersionedCommandOptions,
  MarkDealLostInput,
  MarkDealWonInput,
  ReplaceDealProfileInput,
  UpdateDealForecastInput,
  UpdateDealNextActionInput,
} from "../../application/ports/DealApiRuntime";
import type { Deal } from "../../domain/model/deal.types";
import {
  mapArchiveDealRequest,
  mapArchiveDealsBatchRequest,
  mapAssignDealOwnerRequest,
  mapChangeDealStageRequest,
  mapCreateDealRequest,
  mapDealBatchMutationResponse,
  mapDealForecastSummary,
  mapDealMutationResponse,
  mapDealReadModel,
  mapMarkDealLostRequest,
  mapMarkDealWonRequest,
  mapReplaceDealProfileRequest,
  mapUpdateDealForecastRequest,
  mapUpdateDealNextActionRequest,
} from "./DealApiMapper";

export class DealHttpApiAdapter implements DealQueryPort, DealCommandPort {
  constructor(private readonly api: CommercialApiClient) {}

  async list(query: DealListQuery = {}, signal?: AbortSignal): Promise<AuthoritativePage<Deal>> {
    const filters = query.filters ?? {};
    const response = await this.api.listDeals<DealListResponse>(compact({
      cursor: query.cursor,
      limit: query.limit,
      search: query.search,
      sortBy: query.sortBy as "updatedAt" | "createdAt" | "expectedCloseDate" | "amount" | "opportunityScore" | undefined,
      sortDirection: query.sortDirection,
      stageCode: filters.stageCode,
      stageCategory: filters.stageCategory,
      ownerId: filters.ownerId,
      buyerType: filters.buyerType,
      buyerId: filters.buyerId,
    }), signal);
    return {
      items: response.items.map(mapDealReadModel),
      pageInfo: response.pageInfo,
      loadedAt: new Date().toISOString(),
      authority: "backend",
    };
  }

  async get(dealId: string, signal?: AbortSignal): Promise<Deal> {
    return mapDealReadModel(await this.api.getDeal(dealId, signal));
  }

  async getForecastSummary(query: Pick<DealListQuery, "filters"> = {}, signal?: AbortSignal): Promise<DealForecastSummary> {
    const filters = query.filters ?? {};
    const response = await this.api.getDealForecastSummary<DealForecastSummaryReadModel>(compact({
      ownerId: filters.ownerId,
      buyerType: filters.buyerType,
      buyerId: filters.buyerId,
    }), signal);
    return mapDealForecastSummary(response);
  }

  async createDeal(input: CreateDealInput, options: DealCommandOptions): Promise<DealMutationResult> {
    return mapDealMutationResponse(await this.api.createDealCommand<DealMutationResponse>(mapCreateDealRequest(input), options));
  }

  async replaceDealProfile(dealId: string, input: ReplaceDealProfileInput, options: DealVersionedCommandOptions): Promise<DealMutationResult> {
    return mapDealMutationResponse(await this.api.updateDealCommand<DealMutationResponse>(dealId, mapReplaceDealProfileRequest(input), options));
  }

  async changeDealStage(dealId: string, input: ChangeDealStageInput, options: DealVersionedCommandOptions): Promise<DealMutationResult> {
    return mapDealMutationResponse(await this.api.changeDealStageCommand<DealMutationResponse>(dealId, mapChangeDealStageRequest(input), options));
  }

  async assignDealOwner(dealId: string, input: AssignDealOwnerInput, options: DealVersionedCommandOptions): Promise<DealMutationResult> {
    return mapDealMutationResponse(await this.api.assignDealOwner<DealMutationResponse>(dealId, mapAssignDealOwnerRequest(input), options));
  }

  async updateDealForecast(dealId: string, input: UpdateDealForecastInput, options: DealVersionedCommandOptions): Promise<DealMutationResult> {
    return mapDealMutationResponse(await this.api.updateDealForecast<DealMutationResponse>(dealId, mapUpdateDealForecastRequest(input), options));
  }

  async updateDealNextAction(dealId: string, input: UpdateDealNextActionInput, options: DealVersionedCommandOptions): Promise<DealMutationResult> {
    return mapDealMutationResponse(await this.api.updateDealNextAction<DealMutationResponse>(dealId, mapUpdateDealNextActionRequest(input), options));
  }

  async markDealWon(dealId: string, input: MarkDealWonInput, options: DealVersionedCommandOptions): Promise<DealMutationResult> {
    return mapDealMutationResponse(await this.api.markDealWonCommand<DealMutationResponse>(dealId, mapMarkDealWonRequest(input), options));
  }

  async markDealLost(dealId: string, input: MarkDealLostInput, options: DealVersionedCommandOptions): Promise<DealMutationResult> {
    return mapDealMutationResponse(await this.api.markDealLostCommand<DealMutationResponse>(dealId, mapMarkDealLostRequest(input), options));
  }

  async archiveDeal(dealId: string, input: ArchiveDealInput, options: DealVersionedCommandOptions): Promise<DealMutationResult> {
    return mapDealMutationResponse(await this.api.archiveDealCommand<DealMutationResponse>(dealId, mapArchiveDealRequest(input), options));
  }

  async archiveDealsBatch(input: ArchiveDealsBatchInput, options: DealCommandOptions): Promise<DealBatchMutationResult> {
    return mapDealBatchMutationResponse(await this.api.archiveDealsBatch<DealBatchMutationResponse>(mapArchiveDealsBatchRequest(input), options));
  }
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
