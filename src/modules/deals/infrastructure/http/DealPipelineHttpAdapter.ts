import { CrmConfigurationApiClient, type DealPipelineDocument, type SaveDealPipelineRequest } from "@/platform/api/generated/crmConfigurationApi";
import type { DealPipelineDefinition } from "../../domain/model/deal.types";
import type { DealPipelineGateway, DealPipelineSaveOptions, DealPipelineMutationResult } from "../../application/ports/DealPipelineGateway";

export class DealPipelineHttpAdapter implements DealPipelineGateway {
  constructor(private readonly api: CrmConfigurationApiClient) {}

  async list(signal?: AbortSignal): Promise<DealPipelineDefinition[]> {
    const response = await this.api.listCrmPipelines({}, signal);
    return response.items.map(mapPipeline);
  }

  async save(pipeline: DealPipelineDefinition, options: DealPipelineSaveOptions): Promise<DealPipelineMutationResult> {
    const request: SaveDealPipelineRequest = {
      nameVi: pipeline.name.vi.trim(), nameEn: pipeline.name.en.trim(),
      description: pipeline.description.vi, isActive: pipeline.active, isDefault: pipeline.isDefault,
      stages: pipeline.stages.map(stage => ({
        id: stage.id, code: stage.code, labelVi: stage.labelVi.trim(), labelEn: stage.labelEn.trim(),
        order: stage.order, category: stage.category.toUpperCase() as "OPEN" | "WON" | "LOST",
        defaultProbability: stage.probabilityDefault, color: stage.color, isActive: stage.isActive,
      })),
    };
    const response = options.expectedVersion === undefined
      ? await this.api.createCrmPipeline(request, options)
      : await this.api.updateCrmPipeline(pipeline.id, request, options);
    return { pipeline: mapPipeline(response.pipeline), outcome: response.outcome, auditEvidenceIds: response.auditEvidenceIds };
  }
}

export function mapPipeline(value: DealPipelineDocument): DealPipelineDefinition {
  return {
    id: value.id, workspaceId: value.workspaceId, updatedAt: value.updatedAt, objectKey: "deal",
    name: { vi: value.nameVi, en: value.nameEn },
    description: { vi: value.description, en: value.description },
    active: value.isActive, isDefault: value.isDefault, version: value.resourceVersion,
    stages: value.stages.map(stage => ({
      id: stage.id, code: stage.code, labelVi: stage.labelVi, labelEn: stage.labelEn,
      order: stage.order, category: stage.category.toLowerCase() as "open" | "won" | "lost",
      probabilityDefault: stage.defaultProbability, color: stage.color,
      isActive: stage.isActive, isSystem: stage.isSystem,
      forecastFloor: stage.forecastFloor, requiresPositiveAmount: stage.requiresPositiveAmount,
      createdAt: value.createdAt, updatedAt: value.updatedAt,
    })),
  };
}
