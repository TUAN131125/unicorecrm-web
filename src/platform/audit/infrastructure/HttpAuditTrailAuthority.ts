import type { HttpClient } from "@/platform/api";
import { ApiClientError } from "@/platform/api";
import type {
  AuditTrailAuthority,
  AuditTrailPage,
  AuditTrailRequest,
} from "../application/auditTrail";

/** OpenAPI-blocked connected boundary; audit data must never come from a handwritten URL. */
export class HttpAuditTrailAuthority implements AuditTrailAuthority {
  readonly source = "backend" as const;

  constructor(_client: HttpClient) {}

  list(request: AuditTrailRequest, _signal?: AbortSignal): Promise<AuditTrailPage> {
    return Promise.reject(new ApiClientError({
      code: "CONTRACT_OPERATION_BLOCKED",
      message: "Audit trail queries are blocked until an OpenAPI audit projection is approved.",
      status: 501,
      retryable: false,
      details: {
        decisionId: "DEC-PLATFORM-AUDIT-TRAIL-API",
        workspaceId: request.workspaceId,
        resourceKey: request.resourceKey,
        recordId: request.recordId,
      },
    }));
  }
}
