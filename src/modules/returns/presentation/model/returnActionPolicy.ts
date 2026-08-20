import type { ReturnRequest } from "../../domain/model/return.types";

export const RETURN_ACTION_IDS = ["view", "approve", "reject", "create-pickup", "receive", "resolve", "close"] as const;
export type ReturnActionId = (typeof RETURN_ACTION_IDS)[number];

export interface ReturnActionPermissions {
  canView: boolean;
  canApprove: boolean;
  canUpdate: boolean;
  canResolve: boolean;
}

export function resolveReturnActionIds(
  request: Pick<ReturnRequest, "status">,
  permissions: ReturnActionPermissions,
): ReturnActionId[] {
  const actions: ReturnActionId[] = [];
  if (permissions.canView) actions.push("view");
  if (request.status === "REQUESTED" && permissions.canApprove) actions.push("approve", "reject");
  if (request.status === "APPROVED" && permissions.canUpdate) actions.push("create-pickup", "receive");
  if (request.status === "AWAITING_ITEM" && permissions.canUpdate) actions.push("receive");
  if (request.status === "RECEIVED" && permissions.canResolve) actions.push("resolve");
  if (request.status === "RESOLVED" && permissions.canUpdate) actions.push("close");
  return actions;
}

export function resolveReturnHeaderActionIds(
  request: Pick<ReturnRequest, "status">,
  permissions: ReturnActionPermissions,
): ReturnActionId[] {
  return resolveReturnActionIds(request, permissions).filter((id) => id !== "view");
}
