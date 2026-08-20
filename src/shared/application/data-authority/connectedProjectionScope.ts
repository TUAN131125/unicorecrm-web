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

export function assertBackendProjectionWrite(
  moduleKey: ModuleDataAuthorityKey,
  operation: string,
): void {
  if (activeProjectionKeys.at(-1) === moduleKey) return;
  throw new ConnectedProjectionWriteError(moduleKey, operation);
}

export function isBackendProjectionActive(moduleKey: ModuleDataAuthorityKey): boolean {
  return activeProjectionKeys.at(-1) === moduleKey;
}
