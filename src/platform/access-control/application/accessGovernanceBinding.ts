import type { EffectiveAccess } from "../domain/accessControl.types";
import type { AccessGovernanceRuntime, AccessGovernanceRuntimeState } from "../domain/accessGovernance.types";

export interface AccessGovernanceRuntimeBinding {
  getRuntime(): AccessGovernanceRuntime;
  getState(): AccessGovernanceRuntimeState;
  load(workspaceId: string, signal?: AbortSignal): Promise<AccessGovernanceRuntimeState>;
  refresh(workspaceId: string, signal?: AbortSignal): Promise<AccessGovernanceRuntimeState>;
  applyMutation(workspaceId: string, result: import("../domain/accessGovernance.types").AccessMutationResult, signal?: AbortSignal): Promise<AccessGovernanceRuntimeState>;
  subscribe(listener: () => void): () => void;
  getEffectiveAccess(workspaceId: string): EffectiveAccess | undefined;
  clear(): void;
}

let binding: AccessGovernanceRuntimeBinding | undefined;

export function configureAccessGovernanceRuntime(next: AccessGovernanceRuntimeBinding): void { binding = next; }
export function resetAccessGovernanceRuntime(): void { binding?.clear(); binding = undefined; }
export function isAccessGovernanceRuntimeConfigured(): boolean { return binding !== undefined; }
export function getAccessGovernanceRuntimeBinding(): AccessGovernanceRuntimeBinding {
  if (!binding) throw new Error("Access governance runtime is not configured.");
  return binding;
}
export function getAuthoritativeEffectiveAccess(workspaceId: string): EffectiveAccess | undefined { return binding?.getEffectiveAccess(workspaceId); }
export function getAccessGovernanceRevision(workspaceId: string): number {
  const state = binding?.getState();
  return state?.workspaceId === workspaceId ? state.snapshot?.revision ?? (state.loading ? -1 : 0) : 0;
}
export function subscribeToAccessGovernance(listener: () => void): () => void { return binding?.subscribe(listener) ?? (() => undefined); }
