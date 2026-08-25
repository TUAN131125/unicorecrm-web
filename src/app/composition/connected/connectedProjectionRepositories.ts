import {
  assertBackendProjectionWrite,
  declareUnavailableBusinessOperation,
  type ModuleDataAuthorityKey,
} from "@/shared/application";

export class ConnectedCollectionProjection<T> {
  private records: T[] = [];
  private readonly listeners = new Set<(records: T[]) => void>();

  constructor(
    private readonly moduleKey: ModuleDataAuthorityKey,
    private readonly readId: (record: T) => string,
  ) {}

  list(): T[] {
    return cloneProjectionValue(this.records);
  }

  getById(id: string): T | undefined {
    const record = this.records.find((candidate) => this.readId(candidate) === id);
    return record === undefined ? undefined : cloneProjectionValue(record);
  }

  replace(records: readonly T[]): void {
    assertBackendProjectionWrite(this.moduleKey, "replace projection");
    this.records = cloneProjectionValue([...records]);
    this.emit();
  }

  upsert(record: T): T {
    assertBackendProjectionWrite(this.moduleKey, "upsert projection");
    const stored = cloneProjectionValue(record);
    const id = this.readId(stored);
    this.records = this.records.some((candidate) => this.readId(candidate) === id)
      ? this.records.map((candidate) => this.readId(candidate) === id ? stored : candidate)
      : [...this.records, stored];
    this.emit();
    return cloneProjectionValue(stored);
  }

  subscribe(listener: (records: T[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snapshot = cloneProjectionValue(this.records);
    for (const listener of this.listeners) listener(cloneProjectionValue(snapshot));
  }
}

export class ConnectedSnapshotProjection<TSnapshot> {
  private readonly listeners = new Set<(snapshot: TSnapshot) => void>();
  private snapshotValue: TSnapshot;

  constructor(
    private readonly moduleKey: ModuleDataAuthorityKey,
    snapshotValue: TSnapshot,
  ) {
    this.snapshotValue = cloneProjectionValue(snapshotValue);
  }

  snapshot(): TSnapshot {
    return cloneProjectionValue(this.snapshotValue);
  }

  replace(snapshot: TSnapshot): void {
    assertBackendProjectionWrite(this.moduleKey, "replace projection");
    this.snapshotValue = cloneProjectionValue(snapshot);
    this.emit();
  }

  update(project: (snapshot: TSnapshot) => TSnapshot): TSnapshot {
    assertBackendProjectionWrite(this.moduleKey, "update projection");
    this.snapshotValue = cloneProjectionValue(project(cloneProjectionValue(this.snapshotValue)));
    this.emit();
    return cloneProjectionValue(this.snapshotValue);
  }

  subscribe(listener: (snapshot: TSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snapshot = cloneProjectionValue(this.snapshotValue);
    for (const listener of this.listeners) listener(cloneProjectionValue(snapshot));
  }
}

export class ConnectedOperationUnavailableError extends Error {
  readonly code = "CONNECTED_OPERATION_REQUIRES_BACKEND";

  constructor(operation: string) {
    super(`${operation} is unavailable as a local operation in connected mode. Use the backend command or configuration API.`);
    this.name = "ConnectedOperationUnavailableError";
  }
}

export function connectedOperationUnavailable(operation: string): never {
  throw new ConnectedOperationUnavailableError(operation);
}

/**
 * Binds a port member that connected mode cannot perform authoritatively.
 *
 * Declaring the operation at the moment it is bound keeps the runtime availability
 * registry and the composition in lockstep: a module boundary and its UI can refuse the
 * action up front, and the binding still fails closed if anything reaches it anyway.
 */
export function unavailableConnectedOperation(operation: string): () => never {
  declareUnavailableBusinessOperation(operation);
  return () => connectedOperationUnavailable(operation);
}

/**
 * Declares a workflow that connected mode cannot coordinate, for a workflow that has no
 * ports to bind.
 *
 * Some canonical workflows are `connectedFrontendCoordinatorAllowed: false` yet call module
 * commands directly rather than through injected ports, so there is no binding to attach
 * the declaration to. Declaring it from the connected composition keeps the availability
 * registry owned by composition either way: the workflow boundary and its callers read the
 * same registry, and a demo composition declares nothing.
 */
export function declareUnavailableConnectedWorkflow(operation: string): void {
  declareUnavailableBusinessOperation(operation);
}

function cloneProjectionValue<T>(value: T): T {
  return structuredClone(value);
}
