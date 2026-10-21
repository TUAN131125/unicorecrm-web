import { getWorkspaceContextSnapshot, subscribeToWorkspaceContext } from "@/platform/workspace-context";
import { getAccessControlSnapshot, getAccessGovernanceRuntimeBinding, isAccessGovernanceRuntimeConfigured, resolveEffectiveAccess } from "@/platform/access-control";
import { getAuthSessionSnapshot, subscribeToAuthSession } from "@/platform/identity-auth";

function currentContactReadIdentity(): string {
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

let observed: string | undefined;
let generation = 0;
let monitoring = false;
let monitoredBinding: ReturnType<typeof getAccessGovernanceRuntimeBinding> | undefined;
let stopGovernance: (() => void) | undefined;

// Include a generation so A -> B -> A cannot admit a response from the first A.
export function getContactRelationshipAuthority(): string {
  if (!monitoring) {
    monitoring = true;
    // Keep observing retirement while the route is unmounted as well.
    subscribeToAuthSession(() => { getContactRelationshipAuthority(); });
    subscribeToWorkspaceContext(() => { getContactRelationshipAuthority(); });
  }
  const binding = isAccessGovernanceRuntimeConfigured() ? getAccessGovernanceRuntimeBinding() : undefined;
  if (binding !== monitoredBinding) {
    stopGovernance?.(); monitoredBinding = binding;
    stopGovernance = binding?.subscribe(() => { getContactRelationshipAuthority(); });
  }
  const next = currentContactReadIdentity();
  if (next !== observed) { observed = next; generation++; }
  return JSON.stringify([next, generation]);
}

export function subscribeContactRelationshipAuthority(listener: () => void): () => void {
  const notify = () => { getContactRelationshipAuthority(); listener(); };
  const dispose = [subscribeToAuthSession(notify), subscribeToWorkspaceContext(notify)];
  if (isAccessGovernanceRuntimeConfigured()) dispose.push(getAccessGovernanceRuntimeBinding().subscribe(notify));
  return () => dispose.forEach(stop => stop());
}
