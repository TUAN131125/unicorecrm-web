import type { DealPipelineDefinition, OpportunityStageConfig } from "../../domain/model/deal.types";

export interface DealStageRepository {
  list(): OpportunityStageConfig[];
  replace(stages: OpportunityStageConfig[]): void;
  reset(): OpportunityStageConfig[];
  subscribe(listener: (stages: OpportunityStageConfig[]) => void): () => void;
  listPipelines(): DealPipelineDefinition[];
  replacePipelines(pipelines: DealPipelineDefinition[]): DealPipelineDefinition[];
}
