import type { ModuleDataAuthorityKey } from "./moduleDataAuthority";

const activeProjectionKeys: ModuleDataAuthorityKey[] = [];

export class ConnectedProjectionWriteError extends Error {
  readonly code = "CONNECTED_LOCAL_WRITE_FORBIDDEN";

  constructor(
    readonly moduleKey: ModuleDataAuthorityKey,
    readonly operation: string,
  ) {
    super(
      `Connected ${moduleKey} projection rejected ${operation}. `
      + "Authoritative writes must execute through the backend mutation authority.",
    );
    this.name = "ConnectedProjectionWriteError";
  }
}

export function runBackendProjection<T>(
  moduleKey: ModuleDataAuthorityKey,
  work: () => T,
): T {
  activeProjectionKeys.push(moduleKey);
  try {
    return work();
  } finally {
    activeProjectionKeys.pop();
  }
}

/**
 * Workspace/scope cache eviction depth.
 *
 * Switching workspace discards the previous scope's cached read models. That is a
 * projection operation, not an authoritative business mutation, so it must not be
 * refused by the connected projection guard. It cannot use `runBackendProjection`
 * because a single scope change evicts several modules and the shared reset hook
 * does not know which module keys its caller owns.
 */
let activeScopeResetDepth = 0;

/**
 * Runs a workspace/scope cache reset. Projection writes are accepted for the duration
 * of `work` and refused again as soon as it returns, so the guard stays closed for
 * ordinary local business writes.
 *
 * `work` must stay synchronous: the permission is a call-stack scope, not a time
 * window, and an awaited continuation would resume after the scope has closed.
 */
export function runWorkspaceScopeReset<T>(work: () => T): T {
  activeScopeResetDepth += 1;
  try {
    return work();
  } finally {
    activeScopeResetDepth -= 1;
  }
}

export function isWorkspaceScopeResetActive(): boolean {
  return activeScopeResetDepth > 0;
}

export function assertBackendProjectionWrite(
  moduleKey: ModuleDataAuthorityKey,
  operation: string,
): void {
  if (activeScopeResetDepth > 0) return;
  if (activeProjectionKeys.at(-1) === moduleKey) return;
  throw new ConnectedProjectionWriteError(moduleKey, operation);
}

export function isBackendProjectionActive(moduleKey: ModuleDataAuthorityKey): boolean {
  return activeProjectionKeys.at(-1) === moduleKey;
}
