/**
 * Resolves the workspace and actor scope every AI request must carry.
 *
 * Scope comes from the authenticated session and the active workspace context,
 * never from a component prop or a persisted payload claim.
 */
import { useMemo } from "react";
import { useEffectiveAccess } from "@/platform/access-control";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import type { AiWorkspaceScope } from "../application/ports/aiRuntime.types";

export function useAiAssistantScope(): AiWorkspaceScope {
  const workspace = useWorkspaceContextSnapshot();
  const access = useEffectiveAccess();

  return useMemo(() => {
    const session = getAuthSessionSnapshot();
    const actorId = session?.principal.memberId || access.memberId || access.accountId || "anonymous";
    return {
      workspaceId: workspace.workspaceId,
      workspaceKey: workspace.workspaceKey,
      actorId,
      actorName: session?.principal.displayName || actorId,
    };
  }, [workspace.workspaceId, workspace.workspaceKey, access.memberId, access.accountId]);
}
