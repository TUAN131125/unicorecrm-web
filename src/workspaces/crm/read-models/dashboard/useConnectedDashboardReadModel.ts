import { useEffect, useMemo } from "react";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useWorkspaceRuntimeSettings } from "@/platform/workspace-config";
import { useAuthSessionSnapshot } from "@/platform/identity-auth";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { createAuthoritativeResource } from "@/shared/application";
import { useAuthoritativeResource } from "@/shared/operations";
import { readConnectedDashboard } from "./connectedDashboardQueries";

export function useConnectedDashboardReadModel() {
  const workspace = useWorkspaceContextSnapshot();
  const configuration = useWorkspaceRuntimeSettings();
  const session = useAuthSessionSnapshot();
  const access = useEffectiveAccess();
  const enabled = Boolean(session && access.accountId === session.principal.accountId && access.workspaceId === workspace.workspaceId);
  const scope = JSON.stringify([workspace.workspaceId, session?.sessionId, session?.principal.accountId, access.memberId, access.membershipId, access.authorityRevision]);
  const canReadDeals = access.can(CAPABILITIES.DEALS_READ) && access.canAccessModule("deals");
  const canReadTasks = access.can(CAPABILITIES.TASKS_READ) && access.canAccessModule("tasks");
  const canReadSupport = access.can(CAPABILITIES.SUPPORT_READ) && access.canAccessModule("support");
  const resource = useMemo(() => createAuthoritativeResource(signal => readConnectedDashboard({
    memberId: access.memberId,
    timeZone: configuration.timeZone,
    canReadDeals, canReadTasks, canReadSupport,
    asOf: new Date().toISOString(),
  }, signal), { shouldRetainDataOnError: () => false }), [scope, access.memberId, configuration.timeZone, canReadDeals, canReadTasks, canReadSupport]);
  useEffect(() => () => resource.reset(), [resource]);
  const query = useAuthoritativeResource(resource, { enabled });
  return { ...query, workspaceKey: workspace.workspaceKey, timeZone: configuration.timeZone, baseCurrency: configuration.baseCurrency };
}
