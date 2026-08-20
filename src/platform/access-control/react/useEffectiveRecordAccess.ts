import React from "react";
import { createAuthoritativeResource } from "@/shared/application";
import { useAuthoritativeResource } from "@/shared/operations";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import type { EffectiveAccess, FieldAccess } from "../domain/accessControl.types";
import type {
  EffectiveRecordAccess,
  EffectiveRecordAccessRequest,
} from "../application/effectiveRecordAccess";
import {
  getEffectiveRecordAccessAuthority,
  isEffectiveRecordAccessAuthorityConfigured,
} from "../application/effectiveRecordAccessBinding";
import { useEffectiveAccess } from "./useEffectiveAccess";

export interface UseEffectiveRecordAccessInput {
  resourceKey: string;
  recordId?: string;
  record?: unknown;
  requestedCommands?: readonly string[];
  requestedFields?: readonly string[];
  includeExport?: boolean;
  includeApproval?: boolean;
  enabled?: boolean;
}

export function useEffectiveRecordAccess(input: UseEffectiveRecordAccessInput) {
  const workspace = useWorkspaceContextSnapshot();
  const localAccess = useEffectiveAccess();
  const connected = isEffectiveRecordAccessAuthorityConfigured();
  const enabled = input.enabled ?? true;
  const commandsKey = [...(input.requestedCommands ?? [])].sort().join("|");
  const fieldsKey = [...(input.requestedFields ?? [])].sort().join("|");
  const request = React.useMemo<EffectiveRecordAccessRequest>(() => ({
    workspaceId: workspace.workspaceId,
    resourceKey: input.resourceKey,
    ...(input.recordId ? { recordId: input.recordId } : {}),
    ...(input.record === undefined ? {} : { record: input.record }),
    ...(input.requestedCommands?.length ? { requestedCommands: [...input.requestedCommands] } : {}),
    ...(input.requestedFields?.length ? { requestedFields: [...input.requestedFields] } : {}),
    ...(input.includeExport === undefined ? {} : { includeExport: input.includeExport }),
    ...(input.includeApproval === undefined ? {} : { includeApproval: input.includeApproval }),
  }), [workspace.workspaceId, input.resourceKey, input.recordId, input.record, commandsKey, fieldsKey, input.includeExport, input.includeApproval]);

  const resource = React.useMemo(() => createAuthoritativeResource<EffectiveRecordAccess>((signal) =>
    getEffectiveRecordAccessAuthority().evaluate({ ...request, record: undefined }, signal)),
  [request]);
  const query = useAuthoritativeResource(resource, { enabled: connected && enabled });
  const local = React.useMemo(() => buildLocalEffectiveRecordAccess(localAccess, request), [localAccess, request]);

  if (!connected) {
    return {
      connected: false,
      loading: false,
      refreshing: false,
      stale: false,
      data: enabled ? local : undefined,
      error: undefined,
      loadedAt: local.evaluatedAt,
      refresh: async () => local,
      cancel: () => undefined,
    };
  }

  return {
    connected: true,
    loading: query.loading,
    refreshing: query.refreshing,
    stale: false,
    data: query.state === "READY" ? query.data : undefined,
    error: query.error,
    loadedAt: query.state === "READY" ? query.loadedAt : undefined,
    refresh: query.refresh,
    cancel: query.cancel,
  };
}

function buildLocalEffectiveRecordAccess(
  access: EffectiveAccess,
  request: EffectiveRecordAccessRequest,
): EffectiveRecordAccess {
  const canRead = request.record === undefined
    ? access.canAccessModule(request.resourceKey)
    : access.canAccessRecord(request.resourceKey, request.record);
  const requestedCommands = request.requestedCommands ?? [];
  const allowedCommands = requestedCommands.filter((command) => {
    const separator = command.indexOf(".");
    const prefix = separator > 0 ? command.slice(0, separator) : request.resourceKey;
    const action = separator > 0 ? command.slice(separator + 1) : command;
    return canRead && access.canPerform(commandResourceKey(prefix), normalizeAction(prefix, action));
  });
  const fieldAccess: Record<string, FieldAccess> = {};
  for (const fieldKey of request.requestedFields ?? []) {
    fieldAccess[fieldKey] = canRead ? access.getFieldAccess(request.resourceKey, fieldKey) : "HIDDEN";
  }
  const canUpdate = canRead && access.canPerform(request.resourceKey, "update");
  const canDelete = canRead && access.canPerform(request.resourceKey, "delete");
  const canExport = canRead && (access.can(`${request.resourceKey}.export`) || access.canPerform(request.resourceKey, "export"));
  const canApprove = canRead && access.canPerform(request.resourceKey, "approve");
  return {
    workspaceId: request.workspaceId,
    resourceKey: request.resourceKey,
    ...(request.recordId ? { recordId: request.recordId } : {}),
    canRead,
    canUpdate,
    canDelete,
    canExport,
    canApprove,
    allowedCommands,
    fieldAccess,
    decisionReasons: [{
      code: canRead ? "DEMO_EFFECTIVE_ACCESS_ALLOWED" : "DEMO_EFFECTIVE_ACCESS_DENIED",
      effect: canRead ? "ALLOW" : "DENY",
      source: "frontend-demo",
    }],
    evaluatedAt: new Date().toISOString(),
    authority: "demo",
  };
}

function normalizeAction(prefix: string, action: string): string {
  if (prefix === "support") {
    if (action === "resolve" || action === "close") return "complete";
    if (action === "reopen" || action === "cancel") return "update";
  }
  const aliases: Record<string, string> = {
    "request-approval": "approve",
    "reject-approval": "approve",
    "change-work-state": "update",
    "move-stage": "update",
    "close-won": "update",
    "close-lost": "update",
  };
  return aliases[action] ?? action;
}

function commandResourceKey(prefix: string): string {
  const resourceKeys: Record<string, string> = {
    lead: "leads",
    deal: "deals",
    quote: "quotes",
    order: "orders",
    contact: "contacts",
    organization: "organizations",
    customer: "customers",
    product: "products",
    payment: "payments",
    payments: "payments",
    invoice: "invoices",
    invoices: "invoices",
    shipping: "shipping",
    return: "returns",
    support: "support",
    task: "tasks",
  };
  return resourceKeys[prefix] ?? prefix;
}
