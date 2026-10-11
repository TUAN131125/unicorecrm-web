import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { getAccessControlSnapshot, getAccessGovernanceRuntimeBinding, isAccessGovernanceRuntimeConfigured, resolveEffectiveAccess } from "@/platform/access-control";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";

export function getLeadTagAuthorityKey(): string {
  const session = getAuthSessionSnapshot();
  if (session?.status !== "ACTIVE") return "SESSION_UNAVAILABLE";
  let workspace: ReturnType<typeof getWorkspaceContextSnapshot>;
  try { workspace = getWorkspaceContextSnapshot(); }
  catch { return "WORKSPACE_UNAVAILABLE"; }
  const workspaceId = workspace.workspaceId;
  const access = resolveEffectiveAccess(workspaceId);
  const state = isAccessGovernanceRuntimeConfigured() ? getAccessGovernanceRuntimeBinding().getState() : undefined;
  const revision = state ? state.workspaceId === workspaceId ? state.authorityRevision ?? state.snapshot?.revision ?? -1 : -1
    : getAccessControlSnapshot(workspaceId).revision;
  return JSON.stringify([workspaceId, workspace.accountId, workspace.membershipId, workspace.memberId, workspace.status,
    session?.sessionId, session?.principal.accountId, session?.principal.memberId, session?.status,
    access.accountId, access.membershipId, access.memberId, revision]);
}
