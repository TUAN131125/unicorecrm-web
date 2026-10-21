import { useEffectiveAccess } from "@/platform/access-control/react/useEffectiveAccess";
import { refreshAccessGovernance } from "@/platform/access-control/runtime/accessGovernanceRuntime";
import { isConnectedAuthRuntime } from "@/platform/identity-auth";
import { isConnectedWorkspaceRuntime, useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { getConnectedMemberDirectory, listWorkspaceMemberDirectory } from "./index";

export function useWorkspaceMemberDirectory() {
  const workspace = useWorkspaceContextSnapshot();
  // Subscribe to the existing authority publication; no new cache or directory request.
  useEffectiveAccess();
  const connected = isConnectedAuthRuntime() || isConnectedWorkspaceRuntime();
  const directory = connected ? getConnectedMemberDirectory(workspace.workspaceId)
    : { status: "ready" as const, members: listWorkspaceMemberDirectory() };
  return { ...directory, connected, retry: () => refreshAccessGovernance(workspace.workspaceId) };
}
