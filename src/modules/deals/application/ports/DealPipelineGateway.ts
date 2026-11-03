import type { DealPipelineDefinition } from "../../domain/model/deal.types";

export interface DealPipelineSaveOptions {
  idempotencyKey: string;
  expectedVersion?: number;
  signal?: AbortSignal;
}

/** Deals owns pipeline definitions; Studio invokes this configuration boundary. */
export interface DealPipelineGateway {
  list(signal?: AbortSignal): Promise<DealPipelineDefinition[]>;
  save(pipeline: DealPipelineDefinition, options: DealPipelineSaveOptions): Promise<DealPipelineMutationResult>;
}

export interface DealPipelineMutationResult {
  pipeline: DealPipelineDefinition;
  outcome: "COMMITTED" | "REPLAYED";
  auditEvidenceIds: readonly string[];
}
