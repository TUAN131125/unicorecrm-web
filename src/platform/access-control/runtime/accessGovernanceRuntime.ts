import { getAuthSessionSnapshot, isConnectedAuthRuntime, subscribeToAuthSession } from "@/platform/identity-auth";
import type { EffectiveAccess } from "../domain/accessControl.types";
import {
  projectEffectiveAccess,
  type AccessGovernanceRuntime,
  type AccessGovernanceRuntimeState,
  type AccessMutationResult,
  type WorkspaceAccessDirectory,
} from "../domain/accessGovernance.types";
import {
  configureAccessGovernanceRuntime,
  getAccessGovernanceRuntimeBinding,
  isAccessGovernanceRuntimeConfigured,
  resetAccessGovernanceRuntime,
  type AccessGovernanceRuntimeBinding,
} from "../application/accessGovernanceBinding";

class DefaultAccessGovernanceRuntimeBinding implements AccessGovernanceRuntimeBinding {
  private state: AccessGovernanceRuntimeState = { loading: false };
  private readonly listeners = new Set<() => void>();

  private generation = 0;
  private owner = accessOwner();
  constructor(private readonly runtime: AccessGovernanceRuntime) {
    subscribeToAuthSession(() => {
      const owner = accessOwner();
      if (owner === this.owner) return;
      this.owner = owner;
      this.clear();
    });
  }

  getRuntime(): AccessGovernanceRuntime { return this.runtime; }
  getState(): AccessGovernanceRuntimeState { return this.state; }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  getEffectiveAccess(workspaceId: string): EffectiveAccess | undefined {
    const context = this.state.workspaceId === workspaceId ? this.state.snapshot?.authorization : undefined;
    return context && !this.state.loading && !this.state.error && this.owner === accessOwner()
      && (!isConnectedAuthRuntime() || context.accountId === getAuthSessionSnapshot()?.principal.accountId)
      ? projectEffectiveAccess(context) : undefined;
  }
  async load(workspaceId: string, signal?: AbortSignal): Promise<AccessGovernanceRuntimeState> {
    if (this.state.workspaceId === workspaceId && this.getEffectiveAccess(workspaceId)) return this.state;
    return this.refresh(workspaceId, signal);
  }
  /**
   * The authorization context is the required read: it is the workspace-scoped
   * capability grant every CRM screen fails closed on. The access directory backs the
   * People & Access administration surface only, so it is read separately and its
   * failure is recorded rather than propagated - a deferred administration API must
   * not be able to block CRM runtime.
   */
  async refresh(workspaceId: string, signal?: AbortSignal): Promise<AccessGovernanceRuntimeState> {
    const generation = ++this.generation;
    const owner = this.owner;
    this.commit({ workspaceId, loading: true });
    try {
      const authorization = await this.runtime.queries.getAuthorizationContext(workspaceId, signal);
      if (generation !== this.generation || owner !== accessOwner() || signal?.aborted) return this.state;
      if (isConnectedAuthRuntime() && authorization.accountId !== getAuthSessionSnapshot()?.principal.accountId) throw new Error("ACCESS_GOVERNANCE_ACCOUNT_MISMATCH");
      if (authorization.workspaceId !== workspaceId) throw new Error("ACCESS_GOVERNANCE_WORKSPACE_MISMATCH");
      const directory = await this.readDirectory(workspaceId, signal);
      if (generation !== this.generation || owner !== accessOwner() || signal?.aborted) return this.state;
      this.commit({
        workspaceId,
        loading: false,
        snapshot: {
          workspaceId,
          revision: directory.value?.revision ?? 0,
          authorization,
          ...(directory.value === undefined ? {} : { directory: directory.value }),
          ...(directory.error === undefined ? {} : { directoryError: directory.error }),
        },
      });
    } catch (error) {
      if (signal?.aborted || generation !== this.generation || owner !== accessOwner()) return this.state;
      this.commit({ workspaceId, loading: false, error: error instanceof Error ? error.message : "ACCESS_GOVERNANCE_UNAVAILABLE" });
    }
    return this.state;
  }

  private async readDirectory(
    workspaceId: string,
    signal?: AbortSignal,
  ): Promise<{ value?: WorkspaceAccessDirectory; error?: string }> {
    try {
      const directory = await this.runtime.queries.getDirectory(workspaceId, signal);
      if (directory.workspaceId !== workspaceId) return { error: "ACCESS_GOVERNANCE_WORKSPACE_MISMATCH" };
      return { value: directory };
    } catch (error) {
      if (signal?.aborted) throw error;
      return { error: error instanceof Error ? error.message : "ACCESS_DIRECTORY_UNAVAILABLE" };
    }
  }
  async applyMutation(workspaceId: string, result: AccessMutationResult, signal?: AbortSignal): Promise<AccessGovernanceRuntimeState> {
    if (result.directory.workspaceId !== workspaceId) throw new Error("ACCESS_GOVERNANCE_MUTATION_WORKSPACE_MISMATCH");
    const currentAuthorization = this.state.workspaceId === workspaceId ? this.state.snapshot?.authorization : undefined;
    if (currentAuthorization) {
      this.commit({ workspaceId, loading: false, snapshot: { workspaceId, revision: result.directory.revision, authorization: currentAuthorization, directory: result.directory } });
    }
    return this.refresh(workspaceId, signal);
  }
  clear(): void { this.generation += 1; this.commit({ loading: false }); }
  private commit(next: AccessGovernanceRuntimeState): void {
    this.state = { ...next, authorityRevision: (this.state.authorityRevision ?? 0) + 1 };
    this.listeners.forEach((listener) => listener());
  }
}

export function configureDefaultAccessGovernanceRuntime(runtime: AccessGovernanceRuntime): void {
  configureAccessGovernanceRuntime(new DefaultAccessGovernanceRuntimeBinding(runtime));
}
export function resetDefaultAccessGovernanceRuntime(): void { resetAccessGovernanceRuntime(); }
export function getAccessGovernanceRuntime(): AccessGovernanceRuntime { return getAccessGovernanceRuntimeBinding().getRuntime(); }
export function getAccessGovernanceState(): AccessGovernanceRuntimeState { return getAccessGovernanceRuntimeBinding().getState(); }
export function loadAccessGovernance(workspaceId: string, signal?: AbortSignal) { return getAccessGovernanceRuntimeBinding().load(workspaceId, signal); }
export function refreshAccessGovernance(workspaceId: string, signal?: AbortSignal) { return getAccessGovernanceRuntimeBinding().refresh(workspaceId, signal); }
export function applyAccessGovernanceMutation(workspaceId: string, result: AccessMutationResult, signal?: AbortSignal) {
  return getAccessGovernanceRuntimeBinding().applyMutation(workspaceId, result, signal);
}
export function clearAccessGovernance(): void { if (isAccessGovernanceRuntimeConfigured()) getAccessGovernanceRuntimeBinding().clear(); }
export function createAccessCommandId(prefix: string): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${prefix}:${Date.now()}:${random}`;
}

function accessOwner(): string { const session = getAuthSessionSnapshot(); return JSON.stringify([session?.sessionId, session?.principal.accountId]); }
