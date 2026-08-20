import type {
  AddSupportCaseInternalNoteRequest,
  AddSupportCaseReplyRequest,
  AssignSupportCaseRequest,
  CommercialApiClient,
  SupportCaseListResponse,
  SupportCaseMutationResponse,
  TransitionSupportCaseRequest,
} from "@/platform/api/generated/commercialApi";
import type { AuthoritativePage } from "@/shared/application";
import type {
  AddSupportCaseInternalNoteInput,
  AddSupportCaseReplyInput,
  AssignSupportCaseInput,
  CreateSupportCaseInput,
  ReplaceSupportCaseProfileInput,
  SupportCaseListQuery,
  SupportCommandOptions,
  SupportCommandPort,
  SupportMutationResult,
  SupportQueryPort,
  SupportVersionedCommandOptions,
  TransitionSupportCaseInput,
} from "../../application/ports/SupportApiRuntime";
import type { SupportCase } from "../../domain/model/supportCase.types";
import {
  mapCreateSupportCaseRequest,
  mapReplaceSupportCaseProfileRequest,
  mapSupportCaseReadModel,
  mapSupportMutationResponse,
} from "./SupportApiMapper";

export class SupportHttpApiAdapter implements SupportQueryPort, SupportCommandPort {
  constructor(private readonly api: CommercialApiClient) {}

  async list(query: SupportCaseListQuery = {}, signal?: AbortSignal): Promise<AuthoritativePage<SupportCase>> {
    const filters = query.filters ?? {};
    const response = await this.api.listSupportCases<SupportCaseListResponse>(compact({
      cursor: query.cursor,
      limit: query.limit,
      search: query.search,
      sortBy: query.sortBy as "updatedAt" | "createdAt" | "priority" | "resolutionDueAt" | "caseNumber" | undefined,
      sortDirection: query.sortDirection,
      status: filters.status,
      priority: filters.priority,
      category: filters.category,
      ownerId: filters.ownerId,
      relationshipType: filters.relationshipType,
      relationshipId: filters.relationshipId,
      slaStatus: filters.slaStatus,
    }), signal);
    return {
      items: response.items.map(mapSupportCaseReadModel),
      pageInfo: response.pageInfo,
      loadedAt: new Date().toISOString(),
      authority: "backend",
    };
  }

  async get(caseId: string, signal?: AbortSignal): Promise<SupportCase> {
    return mapSupportCaseReadModel(await this.api.getSupportCase(caseId, signal));
  }

  async createSupportCase(input: CreateSupportCaseInput, options: SupportCommandOptions): Promise<SupportMutationResult> {
    return mapSupportMutationResponse(await this.api.createSupportCase<SupportCaseMutationResponse>(mapCreateSupportCaseRequest(input), options));
  }

  async replaceSupportCaseProfile(caseId: string, input: ReplaceSupportCaseProfileInput, options: SupportVersionedCommandOptions): Promise<SupportMutationResult> {
    return mapSupportMutationResponse(await this.api.replaceSupportCaseProfile<SupportCaseMutationResponse>(caseId, mapReplaceSupportCaseProfileRequest(input), options));
  }

  async assignSupportCase(caseId: string, input: AssignSupportCaseInput, options: SupportVersionedCommandOptions): Promise<SupportMutationResult> {
    const body: AssignSupportCaseRequest = { ownerId: input.ownerId.trim() };
    return mapSupportMutationResponse(await this.api.assignSupportCase<SupportCaseMutationResponse>(caseId, body, options));
  }

  async transitionSupportCase(caseId: string, input: TransitionSupportCaseInput, options: SupportVersionedCommandOptions): Promise<SupportMutationResult> {
    const body: TransitionSupportCaseRequest = compact({ nextStatus: input.nextStatus, resolutionSummary: input.resolutionSummary?.trim(), reason: input.reason?.trim() });
    return mapSupportMutationResponse(await this.api.transitionSupportCase<SupportCaseMutationResponse>(caseId, body, options));
  }

  async addSupportCaseReply(caseId: string, input: AddSupportCaseReplyInput, options: SupportVersionedCommandOptions): Promise<SupportMutationResult> {
    const body: AddSupportCaseReplyRequest = { body: input.body.trim() };
    return mapSupportMutationResponse(await this.api.addSupportCaseReply<SupportCaseMutationResponse>(caseId, body, options));
  }

  async addSupportCaseInternalNote(caseId: string, input: AddSupportCaseInternalNoteInput, options: SupportVersionedCommandOptions): Promise<SupportMutationResult> {
    const body: AddSupportCaseInternalNoteRequest = { body: input.body.trim() };
    return mapSupportMutationResponse(await this.api.addSupportCaseInternalNote<SupportCaseMutationResponse>(caseId, body, options));
  }
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
