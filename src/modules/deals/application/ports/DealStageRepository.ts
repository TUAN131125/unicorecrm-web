import type { DealPipelineDefinition, OpportunityStageConfig } from "../../domain/model/deal.types";

/** Synchronous read projection; configuration commands use DealPipelineGateway.
 * replace/reset methods are Demo storage or guarded backend projection operations. */
export interface DealStageRepository {
  list(): OpportunityStageConfig[];
  replace(stages: OpportunityStageConfig[]): void;
  reset(): OpportunityStageConfig[];
  subscribe(listener: (stages: OpportunityStageConfig[]) => void): () => void;
  listPipelines(): DealPipelineDefinition[];
  replacePipelines(pipelines: DealPipelineDefinition[]): DealPipelineDefinition[];
}
