import type {
  AuthoritativeCommandResult,
  AuthoritativePage,
  ModuleCommandAdapter,
  ModuleCommandMetadata,
  ModuleCommandRequest,
  ModuleDataAuthority,
  ModuleDataAuthorityKey,
  ModuleDataAuthorityRegistry,
  ModuleListQuery,
  ModuleQueryAdapter,
} from "@/shared/application";
import { OPENAPI_RUNTIME_CONTRACT_VERSION } from "../contracts/generatedOpenApiRuntimeContract";
import {
  PRODUCTION_MODULE_QUERY_DEFINITIONS,
  type ProductionModuleQueryDefinition,
} from "../contracts/generatedProductionQueryRegistry";
import type { HttpClient } from "../client/HttpClient";
import { ApiClientError } from "../errors/ApiClientError";

export interface ModuleQueryResponseMapper {
  mapListItem?(value: unknown): unknown;
  mapDetail?(value: unknown): unknown;
}

export type ModuleQueryResponseMapperRegistry = Partial<Record<ModuleDataAuthorityKey, ModuleQueryResponseMapper>>;

interface PageEnvelope<T> {
  items: T[];
  pageInfo?: {
    hasNextPage?: boolean;
    nextCursor?: string;
    totalCount?: number;
  };
}

export class HttpModuleQueryAdapter implements ModuleQueryAdapter {
  constructor(
    private readonly client: HttpClient,
    private readonly definition: ProductionModuleQueryDefinition,
    private readonly mapper?: ModuleQueryResponseMapper,
  ) {}

  async list<T>(query: ModuleListQuery = {}, signal?: AbortSignal): Promise<AuthoritativePage<T>> {
    const contract = this.definition.list;
    if (!contract) throw queryContractBlocked(this.definition.key, "list");
    const response = await this.client.request<unknown[] | PageEnvelope<unknown>>({
      operationId: contract.operationId,
      method: "GET",
      path: contract.path,
      query: buildWhitelistedListQuery(query, contract.allowedQueryParameters, contract.operationId),
      ...(signal === undefined ? {} : { signal }),
      retry: "default",
      auth: "required",
      workspace: "required",
    });
    const normalized = normalizePageEnvelope<unknown>(response, contract.operationId);
    const items = this.mapper?.mapListItem
      ? normalized.items.map((item) => this.mapper?.mapListItem?.(item) as T)
      : normalized.items as T[];
    return {
      items,
      pageInfo: normalized.pageInfo,
      loadedAt: new Date().toISOString(),
      authority: "backend",
    };
  }

  get<T>(id: string, signal?: AbortSignal): Promise<T> {
    const contract = this.definition.detail;
    if (!contract) throw queryContractBlocked(this.definition.key, "detail");
    const normalizedId = id.trim();
    if (!normalizedId) {
      throw new ApiClientError({
        code: "RESOURCE_ID_REQUIRED",
        message: "An authoritative record query requires a resource ID.",
        retryable: false,
        details: { operationId: contract.operationId },
      });
    }
    const marker = `{${contract.pathParameter}}`;
    if (!contract.pathTemplate.includes(marker)) {
      throw queryContractViolation(contract.operationId, "The OpenAPI detail path template is invalid.");
    }
    return this.client.request<unknown>({
      operationId: contract.operationId,
      method: "GET",
      path: contract.pathTemplate.replace(marker, encodeURIComponent(normalizedId)),
      ...(signal === undefined ? {} : { signal }),
      retry: "default",
      auth: "required",
      workspace: "required",
    }).then((value) => this.mapper?.mapDetail ? this.mapper.mapDetail(value) as T : value as T);
  }
}

/**
 * Generic module mutations are intentionally unavailable in connected mode.
 * Production mutations must pass through RoutedHttpMutationAuthority and the
 * exact command-to-operation registry generated from OpenAPI.
 */
export class BlockedConnectedModuleCommandAdapter implements ModuleCommandAdapter {
  readonly allowedOperations = new Set<string>();

  constructor(private readonly moduleKey: string) {}

  execute<TPayload, TResult>(
    request: ModuleCommandRequest<TPayload>,
    _metadata: ModuleCommandMetadata,
  ): Promise<AuthoritativeCommandResult<TResult>> {
    return Promise.reject(new ApiClientError({
      code: "CONNECTED_GENERIC_MODULE_MUTATION_BLOCKED",
      message: `Connected module mutation ${this.moduleKey}.${request.operation} has no direct authority. Use a PRODUCTION_CONTRACT_READY command registry entry.`,
      retryable: false,
      details: {
        moduleKey: this.moduleKey,
        operation: request.operation,
        authority: "docs/backend-readiness/command-registry.json",
      },
    }));
  }
}

export function createHttpModuleDataAuthorityRegistry(
  client: HttpClient,
  definitions: readonly ProductionModuleQueryDefinition[] = PRODUCTION_MODULE_QUERY_DEFINITIONS,
  mappers: ModuleQueryResponseMapperRegistry = {},
): ModuleDataAuthorityRegistry {
  const entries = definitions.map((definition): [ModuleDataAuthorityKey, ModuleDataAuthority] => {
    const key = assertModuleKey(definition.key);
    return [
      key,
      {
        key,
        source: "backend",
        contractVersion: `openapi-${OPENAPI_RUNTIME_CONTRACT_VERSION}`,
        queries: new HttpModuleQueryAdapter(client, definition, mappers[key]),
        commands: new BlockedConnectedModuleCommandAdapter(key),
      },
    ];
  });
  return Object.fromEntries(entries) as ModuleDataAuthorityRegistry;
}

export const DEFAULT_MODULE_AUTHORITY_DEFINITIONS = PRODUCTION_MODULE_QUERY_DEFINITIONS;

function buildWhitelistedListQuery(
  query: ModuleListQuery,
  allowedParameters: readonly string[],
  operationId: string,
): Record<string, string | number | boolean | null | undefined> {
  const requested: Record<string, string | number | boolean | null | undefined> = {
    cursor: query.cursor,
    limit: query.limit,
    search: query.search,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
    ...(query.filters ?? {}),
  };
  const allowed = new Set(allowedParameters);
  const internalPaginationHints = new Set(["cursor", "limit"]);
  const unsupported = Object.entries(requested)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key)
    .filter((key) => !allowed.has(key) && !internalPaginationHints.has(key));
  if (unsupported.length > 0) {
    throw queryContractViolation(operationId, `Unsupported query parameters: ${unsupported.join(", ")}.`);
  }
  return Object.fromEntries(Object.entries(requested).filter(([key, value]) => allowed.has(key) && value !== undefined));
}

function normalizePageEnvelope<T>(
  response: T[] | PageEnvelope<T>,
  operationId: string,
): { items: T[]; pageInfo: { hasNextPage: boolean; nextCursor?: string; totalCount?: number } } {
  if (Array.isArray(response)) {
    return { items: response, pageInfo: { hasNextPage: false, totalCount: response.length } };
  }
  if (!response || typeof response !== "object" || !Array.isArray(response.items)) {
    throw queryContractViolation(operationId, "Collection response must contain an items array.");
  }
  return {
    items: response.items,
    pageInfo: {
      hasNextPage: response.pageInfo?.hasNextPage ?? false,
      ...(response.pageInfo?.nextCursor === undefined ? {} : { nextCursor: response.pageInfo.nextCursor }),
      ...(response.pageInfo?.totalCount === undefined ? {} : { totalCount: response.pageInfo.totalCount }),
    },
  };
}

function assertModuleKey(value: string): ModuleDataAuthorityKey {
  const keys: readonly string[] = [
    "commercialEvidence", "contacts", "customers", "deals", "invoices", "leads", "orders",
    "organizations", "payments", "products", "quotes", "returns", "shipping", "support", "tasks",
  ];
  if (!keys.includes(value)) throw new Error(`Unknown generated module authority key: ${value}.`);
  return value as ModuleDataAuthorityKey;
}

function queryContractBlocked(moduleKey: string, useCase: "list" | "detail"): ApiClientError {
  return new ApiClientError({
    code: "CONNECTED_QUERY_CONTRACT_BLOCKED",
    message: `Connected ${moduleKey} ${useCase} query is unresolved in the canonical query registry.`,
    retryable: false,
    details: { moduleKey, useCase, authority: "docs/backend-readiness/query-registry.json" },
  });
}

function queryContractViolation(operationId: string, message: string): ApiClientError {
  return new ApiClientError({
    code: "CONNECTED_QUERY_CONTRACT_VIOLATION",
    message,
    retryable: false,
    details: { operationId, authority: "docs/api/openapi.json" },
  });
}
