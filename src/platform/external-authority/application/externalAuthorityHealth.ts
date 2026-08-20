import type { WorkspaceCapabilityKey } from "@/platform/capability-manifest";

export type ExternalAuthorityHealthStatus =
  | "HEALTHY"
  | "DEGRADED"
  | "UNAVAILABLE"
  | "AUTHENTICATION_EXPIRED"
  | "SYNC_DELAYED"
  | "RECONCILIATION_REQUIRED"
  | "UNCONFIGURED";

export type ExternalAuthorityAccessMode = "READ_ONLY" | "BLOCKED";
export type ExternalAuthorityHealthSource = "backend" | "demo";

export interface ExternalAuthorityHealthRequest {
  workspaceId: string;
  capabilityKey: WorkspaceCapabilityKey;
}

export interface ExternalAuthorityHealth {
  workspaceId: string;
  capabilityKey: WorkspaceCapabilityKey;
  providerId?: string;
  providerName?: string;
  status: ExternalAuthorityHealthStatus;
  accessMode: ExternalAuthorityAccessMode;
  sourceOfTruth: "EXTERNAL";
  lastSuccessfulSyncAt?: string;
  lastCheckedAt?: string;
  tokenExpiresAt?: string;
  syncLagSeconds?: number;
  outstandingReconciliationCount?: number;
  reasonCodes: readonly string[];
  evaluatedAt: string;
  authority: ExternalAuthorityHealthSource;
}

export interface ExternalAuthorityHealthAuthority {
  readonly source: "backend";
  evaluate(
    request: ExternalAuthorityHealthRequest,
    signal?: AbortSignal,
  ): Promise<ExternalAuthorityHealth>;
}

export function externalAuthorityBlocksRead(health: ExternalAuthorityHealth | undefined): boolean {
  return !health || health.accessMode === "BLOCKED";
}
