import type {
  AuthoritativeCommandResult,
  ModuleCommandAdapter,
  ModuleCommandMetadata,
  ModuleCommandRequest,
  ModuleDataAuthority,
  ModuleListQuery,
} from "@/shared/application";
import { ApiClientError } from "@/platform/api/errors";
import { OPENAPI_RUNTIME_CONTRACT_VERSION } from "@/platform/api/contracts";
import type { LeadApiRuntime, LeadListQuery } from "../../application/ports/LeadApiRuntime";

/**
 * Transitional compatibility bridge for shared consumers that still resolve
 * ModuleDataAuthorityRegistry. The connected Lead query implementation is the
 * module-owned LeadApiRuntime; no generic HTTP query adapter is used.
 *
 * Mutations stay fail-closed. New Lead presentation/application code must call
 * LeadCommandPort directly rather than this compatibility surface.
 */
export function createLeadModuleDataAuthorityBridge(runtime: LeadApiRuntime): ModuleDataAuthority {
  return {
    key: "leads",
    source: runtime.mode === "connected" ? "backend" : "demo",
    contractVersion: `openapi-${OPENAPI_RUNTIME_CONTRACT_VERSION}`,
    queries: {
      list: <T>(query: ModuleListQuery = {}, signal?: AbortSignal) => runtime.queries.list(query as LeadListQuery, signal) as Promise<{
        items: T[];
        pageInfo: { hasNextPage: boolean; nextCursor?: string; totalCount?: number };
        loadedAt: string;
        authority: "backend" | "demo" | "external";
      }>,
      get: <T>(id: string, signal?: AbortSignal) => runtime.queries.get(id, signal) as Promise<T>,
    },
    commands: new BlockedLeadCompatibilityCommandAdapter(),
  };
}

class BlockedLeadCompatibilityCommandAdapter implements ModuleCommandAdapter {
  readonly allowedOperations = new Set<string>();

  execute<TPayload, TResult>(
    request: ModuleCommandRequest<TPayload>,
    _metadata: ModuleCommandMetadata,
  ): Promise<AuthoritativeCommandResult<TResult>> {
    return Promise.reject(new ApiClientError({
      code: "LEAD_GENERIC_MUTATION_BOUNDARY_BLOCKED",
      message: `Lead mutation ${request.operation} must use LeadCommandPort or an explicit workflow port.`,
      retryable: false,
      details: {
        module: "leads",
        operation: request.operation,
        authority: "src/modules/leads/application/ports/LeadApiRuntime.ts",
      },
    }));
  }
}
