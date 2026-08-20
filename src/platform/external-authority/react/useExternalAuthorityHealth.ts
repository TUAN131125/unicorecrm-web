import React from "react";
import type { WorkspaceCapabilityKey } from "@/platform/capability-manifest";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { createAuthoritativeResource } from "@/shared/application";
import { useAuthoritativeResource } from "@/shared/operations";
import type { ExternalAuthorityHealth } from "../application/externalAuthorityHealth";
import {
  getExternalAuthorityHealthAuthority,
  isExternalAuthorityHealthAuthorityConfigured,
} from "../application/externalAuthorityHealthBinding";

export function useExternalAuthorityHealth(
  capabilityKey: WorkspaceCapabilityKey,
  options: { enabled?: boolean } = {},
) {
  const workspace = useWorkspaceContextSnapshot();
  const connected = isExternalAuthorityHealthAuthorityConfigured();
  const enabled = options.enabled ?? true;
  const resource = React.useMemo(
    () => createAuthoritativeResource<ExternalAuthorityHealth>((signal) =>
      getExternalAuthorityHealthAuthority().evaluate({
        workspaceId: workspace.workspaceId,
        capabilityKey,
      }, signal)),
    [workspace.workspaceId, capabilityKey],
  );
  const query = useAuthoritativeResource(resource, { enabled: connected && enabled });

  React.useEffect(() => () => resource.cancel(), [resource]);

  if (!connected) {
    const local = buildDemoHealth(workspace.workspaceId, capabilityKey);
    return {
      connected: false,
      loading: false,
      refreshing: false,
      stale: false,
      data: enabled ? local : undefined,
      error: undefined,
      loadedAt: local.evaluatedAt,
      refresh: async () => local,
      cancel: () => undefined,
    };
  }

  return {
    connected: true,
    loading: query.loading,
    refreshing: query.refreshing,
    stale: query.stale,
    data: query.state === "READY" || query.data !== undefined ? query.data : undefined,
    error: query.error,
    loadedAt: query.loadedAt,
    refresh: query.refresh,
    cancel: query.cancel,
  };
}

function buildDemoHealth(
  workspaceId: string,
  capabilityKey: WorkspaceCapabilityKey,
): ExternalAuthorityHealth {
  return {
    workspaceId,
    capabilityKey,
    status: "UNCONFIGURED",
    accessMode: "BLOCKED",
    sourceOfTruth: "EXTERNAL",
    reasonCodes: ["DEMO_EXTERNAL_PROVIDER_NOT_CONFIGURED"],
    evaluatedAt: new Date().toISOString(),
    authority: "demo",
  };
}
