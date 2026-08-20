import type { WorkspaceCapabilityKey } from "@/platform/capability-manifest";
import type { HttpClient } from "@/platform/api";
import { ApiClientError } from "@/platform/api";
import type {
  ExternalAuthorityHealth,
  ExternalAuthorityHealthAuthority,
  ExternalAuthorityHealthRequest,
} from "../application/externalAuthorityHealth";

/** OpenAPI-blocked connected boundary; no handwritten capability-health URL is permitted. */
export class HttpExternalAuthorityHealthAuthority implements ExternalAuthorityHealthAuthority {
  readonly source = "backend" as const;

  constructor(_client: HttpClient) {}

  evaluate(
    request: ExternalAuthorityHealthRequest,
    _signal?: AbortSignal,
  ): Promise<ExternalAuthorityHealth> {
    return Promise.reject(new ApiClientError({
      code: "CONTRACT_OPERATION_BLOCKED",
      message: "External authority health evaluation is blocked until its OpenAPI projection is approved.",
      status: 501,
      retryable: false,
      details: {
        decisionId: "DEC-PLATFORM-EXTERNAL-AUTHORITY-HEALTH-API",
        workspaceId: request.workspaceId,
        capabilityKey: request.capabilityKey as WorkspaceCapabilityKey,
      },
    }));
  }
}
