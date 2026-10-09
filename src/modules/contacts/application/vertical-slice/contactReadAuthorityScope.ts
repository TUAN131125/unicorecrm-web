import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { getAccessControlSnapshot, getAccessGovernanceRuntimeBinding, isAccessGovernanceRuntimeConfigured, resolveEffectiveAccess } from "@/platform/access-control";

let projectionAuthorityScope: string | undefined;
export function getContactProjectionAuthorityScope(): string | undefined { return projectionAuthorityScope; }
export function markContactProjectionAuthorityScope(scope: string): void { projectionAuthorityScope = scope; }

function key(workspaceId: string, access: { accountId: string; membershipId: string; memberId: string }, revision: number) {
  return JSON.stringify([workspaceId, access.accountId, access.membershipId, access.memberId, revision]);
}
export function getContactReadAuthorityScope(): string {
  const { workspaceId } = getWorkspaceContextSnapshot();
  const state = isAccessGovernanceRuntimeConfigured() ? getAccessGovernanceRuntimeBinding().getState() : undefined;
  const revision = state ? state.workspaceId === workspaceId ? state.authorityRevision ?? state.snapshot?.revision ?? (state.loading ? -1 : 0) : 0 : getAccessControlSnapshot(workspaceId).revision;
  return key(workspaceId, resolveEffectiveAccess(workspaceId), revision);
}
