import type { HttpClient } from "../client/HttpClient";
import { ApiClientError } from "../errors/ApiClientError";

/**
 * Initial Workspace Provisioning.
 *
 * POST /workspaces/initial-provisioning is a single authenticated intent owned by the
 * backend durable workflow. The automatic bootstrap omits every optional value and
 * therefore selects the server-owned defaults. The caller can never
 * supply an account, member, membership status, workspace key, aggregate identifier,
 * role, capability, enabled module or product space, so no such field exists here.
 *
 * The operation is not described by the historical frontend OpenAPI document, so it
 * uses the semantic-extension contract authority with a colocated response validator.
 */
export interface ProvisionInitialWorkspaceRequest {
  name?: string;
  logoText?: string;
  locale?: string;
  timeZone?: string;
  baseCurrency?: string;
}

export type InitialWorkspaceProvisioningOutcome = "PROVISIONED" | "REPLAYED";

export interface ProvisionedWorkspaceSummary {
  membershipId: string;
  workspaceId: string;
  workspaceKey: string;
  name: string;
  status: string;
  logoText: string;
}

export interface ProvisionInitialWorkspaceResponse {
  commandId: string;
  correlationId: string;
  outcome: InitialWorkspaceProvisioningOutcome;
  workspaceId: string;
  membershipId: string;
  workspace: ProvisionedWorkspaceSummary;
  provisionedAt: string;
}

export class WorkspaceProvisioningApiClient {
  constructor(private readonly http: HttpClient) {}

  async provisionInitialWorkspace(
    body: ProvisionInitialWorkspaceRequest,
    options: { idempotencyKey: string; signal?: AbortSignal },
  ): Promise<ProvisionInitialWorkspaceResponse> {
    const payload = await this.http.request<unknown, ProvisionInitialWorkspaceRequest>({
      operationId: "provisionInitialWorkspace",
      method: "POST",
      path: "/workspaces/initial-provisioning",
      body,
      // No trusted workspace can exist for an account that holds zero memberships,
      // so this intent is deliberately not workspace-scoped.
      workspace: "none",
      credentials: "include",
      idempotencyKey: options.idempotencyKey,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      // The durable workflow converges rather than duplicating, but a transport-level
      // replay is still the caller's decision, so retries stay explicit.
      retry: "never",
      contractAuthority: "semantic-extension",
    });
    return validateProvisioningResponse(payload);
  }
}

export function createProvisioningIdempotencyKey(): string {
  const random = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `workspace-provisioning-${random}`;
}

function validateProvisioningResponse(value: unknown): ProvisionInitialWorkspaceResponse {
  if (!isRecord(value)
    || !isNonEmptyString(value.commandId)
    || !isNonEmptyString(value.correlationId)
    || (value.outcome !== "PROVISIONED" && value.outcome !== "REPLAYED")
    || !isNonEmptyString(value.workspaceId)
    || !isNonEmptyString(value.membershipId)
    || !isNonEmptyString(value.provisionedAt)
    || !isWorkspaceSummary(value.workspace)) {
    throw new ApiClientError({
      code: "WORKSPACE_PROVISIONING_RESPONSE_INVALID",
      message: "The initial workspace provisioning response did not match the backend contract.",
      status: 502,
      retryable: true,
    });
  }
  return {
    commandId: value.commandId,
    correlationId: value.correlationId,
    outcome: value.outcome,
    workspaceId: value.workspaceId,
    membershipId: value.membershipId,
    workspace: { ...value.workspace },
    provisionedAt: value.provisionedAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isWorkspaceSummary(value: unknown): value is ProvisionedWorkspaceSummary {
  return isRecord(value)
    && isNonEmptyString(value.membershipId)
    && isNonEmptyString(value.workspaceId)
    && isNonEmptyString(value.workspaceKey)
    && isNonEmptyString(value.name)
    && isNonEmptyString(value.status)
    && typeof value.logoText === "string";
}
