import React from "react";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useAuthSessionSnapshot } from "@/platform/identity-auth";
import { useAuthoritativeResource } from "@/shared/operations";
import { getDealPipelineResource, resetDealPipelineScope } from "../../public/dealPipelines";
import { getDealPipelines, isDealConnectedMode, resetDealStages, subscribeToDealStages } from "../../public/deals";

export function useDealStages(pipelineId?: string) {
  const workspace = useWorkspaceContextSnapshot();
  const session = useAuthSessionSnapshot();
  const connected = isDealConnectedMode();
  const resource = getDealPipelineResource();
  const query = useAuthoritativeResource(resource, { enabled: connected });
  const [demoPipelines, setDemoPipelines] = React.useState(getDealPipelines);
  React.useLayoutEffect(() => { resetDealPipelineScope(); }, [workspace.workspaceId, session?.sessionId]);
  React.useEffect(() => subscribeToDealStages(() => setDemoPipelines(getDealPipelines())), []);
  const pipelines = React.useMemo(() => connected ? (query.data ?? []).filter(pipeline => pipeline.workspaceId === workspace.workspaceId) : demoPipelines, [connected, query.data, demoPipelines, workspace.workspaceId]);
  const pipeline = pipelineId ? pipelines.find(item => item.id === pipelineId) : pipelines.find(item => item.isDefault);
  const [localStages, setLocalStages] = React.useState<import("../../domain/model/deal.types").OpportunityStageConfig[] | undefined>();
  React.useEffect(() => setLocalStages(undefined), [pipeline, workspace.workspaceId]);
  return { stageConfigs: connected ? pipeline?.stages ?? [] : localStages ?? pipeline?.stages ?? [],
    setStageConfigs: setLocalStages, resetStageConfigs: resetDealStages,
    pipelines, pipeline, pipelineQuery: { ...query, connected } };
}
