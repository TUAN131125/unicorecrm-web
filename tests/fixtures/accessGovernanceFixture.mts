import type { AccessGovernanceRuntimeBinding } from "@/platform/access-control/application/accessGovernanceBinding";

/** Delegate the full binding contract; object-spreading a class loses prototype methods. */
export function withAccessGovernanceFixture(
  original: AccessGovernanceRuntimeBinding,
  overrides: Partial<AccessGovernanceRuntimeBinding>,
): AccessGovernanceRuntimeBinding {
  return {
    getRuntime: () => original.getRuntime(),
    getState: () => original.getState(),
    load: (...args) => original.load(...args),
    refresh: (...args) => original.refresh(...args),
    applyMutation: (...args) => original.applyMutation(...args),
    subscribe: listener => original.subscribe(listener),
    getEffectiveAccess: workspaceId => original.getEffectiveAccess(workspaceId),
    clear: () => original.clear(),
    ...overrides,
  };
}
