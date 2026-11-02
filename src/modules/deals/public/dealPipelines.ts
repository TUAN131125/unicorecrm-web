import { createAuthoritativeResource, invalidateModuleQueries, MutationCommandError, runBackendProjection, type MutationOutcome } from "@/shared/application";
import { getActiveWorkspaceId, getWorkspaceContextSnapshot, subscribeToWorkspaceContext } from "@/platform/workspace-context";
import { getAuthSessionSnapshot, subscribeToAuthSession } from "@/platform/identity-auth";
import { getDealApplicationServices, dealStageRepository, isDealConnectedApiRuntime } from "../application/composition/dealApplicationServices";
import type { DealPipelineDefinition } from "../domain/model/deal.types";
import type { DealPipelineSaveOptions } from "../application/ports/DealPipelineGateway";

function currentOwner(): string {
  return `${getActiveWorkspaceId() ?? "unselected"}:${getAuthSessionSnapshot()?.sessionId ?? "host"}`;
}

let owner = "";
const resource = createAuthoritativeResource<DealPipelineDefinition[]>(async signal => {
  const requestOwner = currentOwner();
  const workspaceId = getWorkspaceContextSnapshot().workspaceId;
  const gateway = getDealApplicationServices().pipelines;
  if (isDealConnectedApiRuntime() && !gateway) throw new MutationCommandError({ code: "CONNECTED_PIPELINE_API_REQUIRED", message: "The pipeline API is unavailable.", category: "INFRASTRUCTURE", retryable: false });
  const pipelines = gateway ? await gateway.list(signal) : dealStageRepository.listPipelines();
  if (signal.aborted || requestOwner !== currentOwner()) throw new DOMException("Cancelled", "AbortError");
  if (gateway && pipelines.some(pipeline => pipeline.workspaceId !== workspaceId)) {
    throw new MutationCommandError({ code: "PIPELINE_WORKSPACE_MISMATCH", message: "Pipeline workspace does not match.", category: "AUTHORIZATION", retryable: false });
  }
  if (gateway) runBackendProjection("deals", () => dealStageRepository.replacePipelines(pipelines));
  return pipelines;
}, { shouldRetainDataOnError: error => error.category !== "AUTHORIZATION" });

export function getDealPipelineResource() { return resource; }

export function resetDealPipelineScope(): void {
  const nextOwner = currentOwner();
  if (owner === nextOwner) return;
  owner = nextOwner;
  resource.reset();
  if (isDealConnectedApiRuntime()) runBackendProjection("deals", () => dealStageRepository.replacePipelines([]));
}

let releaseScopeObservers: (() => void) | undefined;
/** Composition binds retirement even while no Deal/Studio screen is mounted. */
export function configureDealPipelineScopeObservers(): void {
  releaseScopeObservers?.();
  const workspace = subscribeToWorkspaceContext(() => resetDealPipelineScope());
  const session = subscribeToAuthSession(() => resetDealPipelineScope());
  releaseScopeObservers = () => { workspace(); session(); };
  owner = "";
  resetDealPipelineScope();
}

/** Save exactly one pipeline aggregate, then reload defaults changed atomically by the server. */
export async function saveDealPipelineCommand(pipeline: DealPipelineDefinition, options: DealPipelineSaveOptions): Promise<MutationOutcome<DealPipelineDefinition>> {
  const requestOwner = currentOwner();
  const gateway = getDealApplicationServices().pipelines;
  if (isDealConnectedApiRuntime() && !gateway) throw new MutationCommandError({ code: "CONNECTED_PIPELINE_API_REQUIRED", message: "The pipeline API is unavailable.", category: "INFRASTRUCTURE", retryable: false });
  const result = gateway ? await gateway.save(pipeline, options) : { pipeline: (() => {
    const current = dealStageRepository.listPipelines();
    const next = current.some(item => item.id === pipeline.id)
      ? current.map(item => item.id === pipeline.id ? { ...pipeline, version: item.version + 1 } : item)
      : [...current, { ...pipeline, version: 1 }];
    const normalized = pipeline.isDefault ? next.map(item => ({ ...item, isDefault: item.id === pipeline.id })) : next;
    return dealStageRepository.replacePipelines(normalized).find(item => item.id === pipeline.id) ?? pipeline;
  })(), outcome: "COMMITTED" as const, auditEvidenceIds: [] };
  const saved = result.pipeline;
  if (options.signal?.aborted || requestOwner !== currentOwner()) throw new DOMException("Cancelled", "AbortError");
  if (gateway && saved.workspaceId !== getWorkspaceContextSnapshot().workspaceId) {
    throw new MutationCommandError({ code: "PIPELINE_WORKSPACE_MISMATCH", message: "Pipeline workspace does not match.", category: "AUTHORIZATION", retryable: false });
  }
  const refreshed = await resource.refresh();
  if (requestOwner !== currentOwner()) throw new DOMException("Cancelled", "AbortError");
  await invalidateModuleQueries({ moduleKeys: ["deals"], commandType: "deal.pipeline.save", aggregateId: saved.id, occurredAt: new Date().toISOString() });
  return { data: saved, commandId: options.idempotencyKey, commandType: "deal.pipeline.save",
    aggregateId: saved.id, aggregateType: "DealPipeline", idempotencyKey: options.idempotencyKey,
    correlationId: options.idempotencyKey, occurredAt: saved.updatedAt ?? new Date().toISOString(), version: saved.version,
    outcome: gateway ? result.outcome : "DEMO_COMMITTED", warnings: refreshed ? [] : ["PIPELINE_REFRESH_REQUIRED"],
    emittedEvents: [], audit: { authority: gateway ? "backend" : "demo", evidenceIds: [...result.auditEvidenceIds] } };

}
