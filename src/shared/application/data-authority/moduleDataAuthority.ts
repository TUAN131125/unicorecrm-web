import type { MutationResourceVersion } from "../mutation/mutationAuthority";

export const MODULE_DATA_AUTHORITY_KEYS = [
  "commercialEvidence",
  "contacts",
  "customers",
  "deals",
  "invoices",
  "leads",
  "orders",
  "organizations",
  "payments",
  "products",
  "quotes",
  "returns",
  "shipping",
  "support",
  "tasks",
] as const;

export type ModuleDataAuthorityKey = typeof MODULE_DATA_AUTHORITY_KEYS[number];
export type ModuleDataAuthoritySource = "backend" | "demo" | "external";
export type ModuleSortDirection = "asc" | "desc";
export type ModuleQueryFilterValue = string | number | boolean | null | undefined;

export interface ModuleListQuery {
  cursor?: string;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDirection?: ModuleSortDirection;
  filters?: Record<string, ModuleQueryFilterValue>;
}

export interface AuthoritativePageInfo {
  hasNextPage: boolean;
  nextCursor?: string;
  totalCount?: number;
}

export interface AuthoritativePage<T> {
  items: T[];
  pageInfo: AuthoritativePageInfo;
  loadedAt: string;
  authority: ModuleDataAuthoritySource;
}

export interface ModuleQueryAdapter {
  list<T>(query?: ModuleListQuery, signal?: AbortSignal): Promise<AuthoritativePage<T>>;
  get<T>(id: string, signal?: AbortSignal): Promise<T>;
}

export interface ModuleCommandRequest<TPayload = unknown> {
  operation: string;
  aggregateId?: string;
  payload: TPayload;
}

export interface ModuleCommandMetadata {
  idempotencyKey: string;
  expectedVersion?: MutationResourceVersion;
  correlationId?: string;
  signal?: AbortSignal;
}

export interface AuthoritativeCommandResult<TResult> {
  data: TResult;
  version?: MutationResourceVersion;
  correlationId?: string;
  commandId?: string;
  occurredAt?: string;
  emittedEvents?: string[];
  auditEvidenceIds?: string[];
}

export interface ModuleCommandAdapter {
  readonly allowedOperations: ReadonlySet<string>;
  execute<TPayload, TResult>(
    request: ModuleCommandRequest<TPayload>,
    metadata: ModuleCommandMetadata,
  ): Promise<AuthoritativeCommandResult<TResult>>;
}

export interface ModuleDataAuthority {
  key: ModuleDataAuthorityKey;
  source: ModuleDataAuthoritySource;
  contractVersion: string;
  queries: ModuleQueryAdapter;
  commands: ModuleCommandAdapter;
}

export type ModuleDataAuthorityRegistry = Record<ModuleDataAuthorityKey, ModuleDataAuthority>;

export function assertCompleteModuleDataAuthorityRegistry(
  registry: Partial<ModuleDataAuthorityRegistry> | undefined,
  runtimeLabel: string,
): asserts registry is ModuleDataAuthorityRegistry {
  const missing = MODULE_DATA_AUTHORITY_KEYS.filter((key) => !registry?.[key]);
  if (missing.length > 0) {
    throw new Error(`${runtimeLabel} requires authoritative query and command adapters for every module. Missing: ${missing.join(", ")}.`);
  }

  const completeRegistry = registry as ModuleDataAuthorityRegistry;
  const invalid = MODULE_DATA_AUTHORITY_KEYS.filter((key) => {
    const authority = completeRegistry[key];
    return authority.key !== key
      || !authority.contractVersion.trim()
      || typeof authority.queries.list !== "function"
      || typeof authority.queries.get !== "function"
      || typeof authority.commands.execute !== "function";
  });
  if (invalid.length > 0) {
    throw new Error(`${runtimeLabel} contains invalid module authority adapters: ${invalid.join(", ")}.`);
  }
}
