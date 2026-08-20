import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { appendTamperEvidentAuditRecord } from "@/platform/enterprise-security";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { getCurrentMembershipForWorkspaceId } from "@/platform/workspace-membership";
import type { Capability } from "../domain/accessControl.types";
import { can, canAccessRecord } from "./accessControlRuntime";

function shouldEnforceRuntimeAuthorization(): boolean {
  return typeof window !== "undefined" && getAuthSessionSnapshot() !== null;
}

function deny(action: string, reason: string, metadata: Record<string, unknown>): never {
  const session = getAuthSessionSnapshot();
  const workspaceId = getWorkspaceContextSnapshot().workspaceId;
  appendTamperEvidentAuditRecord({
    scopeId: workspaceId,
    category: "AUTHORIZATION",
    action,
    actorId: session?.principal.accountId ?? "anonymous",
    subjectId: typeof metadata.resourceKey === "string" ? metadata.resourceKey : undefined,
    metadata: { reason, ...metadata },
  });
  throw new Error(`Access denied: ${reason}`);
}

/** Ensures the authenticated principal has an active membership in the active tenant. */
export function assertRuntimeWorkspaceAccess(expectedWorkspaceId?: string): void {
  if (!shouldEnforceRuntimeAuthorization()) return;
  const activeWorkspaceId = getWorkspaceContextSnapshot().workspaceId;
  if (expectedWorkspaceId && expectedWorkspaceId !== activeWorkspaceId) {
    deny("WorkspaceBoundaryDenied", "command targets a different workspace.", { expectedWorkspaceId, activeWorkspaceId });
  }
  const membership = getCurrentMembershipForWorkspaceId(activeWorkspaceId);
  if (!membership || membership.status !== "active") {
    deny("WorkspaceMembershipDenied", "active workspace membership is required.", { activeWorkspaceId });
  }
}

/** Enforces action authorization at an application/runtime command boundary. */
export function assertRuntimeCapability(capability: Capability): void {
  if (!shouldEnforceRuntimeAuthorization()) return;
  assertRuntimeWorkspaceAccess();
  if (!can(capability)) deny("CapabilityDenied", `missing capability ${capability}.`, { capability });
}

/** Enforces tenant and record scope before a command mutates an existing record. */
export function assertRuntimeRecordAccess(resourceKey: string, record: unknown): void {
  if (!shouldEnforceRuntimeAuthorization()) return;
  const activeWorkspaceId = getWorkspaceContextSnapshot().workspaceId;
  const recordWorkspaceId = record && typeof record === "object" && typeof (record as Record<string, unknown>).workspaceId === "string"
    ? String((record as Record<string, unknown>).workspaceId)
    : undefined;
  assertRuntimeWorkspaceAccess(recordWorkspaceId);
  if (!canAccessRecord(resourceKey, record)) {
    deny("DataScopeDenied", `record is outside the active ${resourceKey} data scope.`, { resourceKey, activeWorkspaceId, recordWorkspaceId });
  }
}

export function assertRuntimeCommandAccess(capability: Capability, resourceKey?: string, record?: unknown): void {
  assertRuntimeCapability(capability);
  if (resourceKey && record !== undefined) assertRuntimeRecordAccess(resourceKey, record);
}
