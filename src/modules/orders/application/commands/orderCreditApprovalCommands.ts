import { createMutationMetadata, executeMutationCommand, type MutationOutcome } from "@/shared/application";
import type {
  DecideOrderCreditApprovalCommand,
  RequestOrderCreditApprovalCommand,
  RevokeOrderCreditApprovalCommand,
} from "../ports/OrderCreditApprovalApiPort";
import type { OrderCreditApprovalMutationResult } from "../credit-approval/orderCreditApproval.types";

export function requestOrderCreditApprovalCommand(
  command: RequestOrderCreditApprovalCommand,
  signal?: AbortSignal,
): Promise<MutationOutcome<OrderCreditApprovalMutationResult>> {
  return executeMutationCommand(
    {
      commandType: "order.credit-approval.request",
      aggregateType: "order-credit-approval",
      aggregateId: command.creationIntentId,
      payload: command,
    },
    createMutationMetadata(`order.credit-approval.request:${command.creationIntentId}`, {
      idempotencyKey: command.idempotencyKey,
      expectedVersion: command.expectedOrderVersion,
      signal,
    }),
  );
}

export function approveOrderCreditApprovalCommand(
  approvalId: string,
  command: DecideOrderCreditApprovalCommand,
  signal?: AbortSignal,
): Promise<MutationOutcome<OrderCreditApprovalMutationResult>> {
  return decide(approvalId, "approve", command, signal);
}

export function rejectOrderCreditApprovalCommand(
  approvalId: string,
  command: DecideOrderCreditApprovalCommand,
  signal?: AbortSignal,
): Promise<MutationOutcome<OrderCreditApprovalMutationResult>> {
  return decide(approvalId, "reject", command, signal);
}

export function revokeOrderCreditApprovalCommand(
  approvalId: string,
  command: RevokeOrderCreditApprovalCommand,
  signal?: AbortSignal,
): Promise<MutationOutcome<OrderCreditApprovalMutationResult>> {
  return executeMutationCommand(
    {
      commandType: "order.credit-approval.revoke",
      aggregateType: "order-credit-approval",
      aggregateId: approvalId,
      payload: command,
    },
    createMutationMetadata(`order.credit-approval.revoke:${approvalId}`, {
      idempotencyKey: command.idempotencyKey,
      expectedVersion: command.expectedVersion,
      signal,
    }),
  );
}

function decide(
  approvalId: string,
  action: "approve" | "reject",
  command: DecideOrderCreditApprovalCommand,
  signal?: AbortSignal,
): Promise<MutationOutcome<OrderCreditApprovalMutationResult>> {
  return executeMutationCommand(
    {
      commandType: `order.credit-approval.${action}`,
      aggregateType: "order-credit-approval",
      aggregateId: approvalId,
      payload: command,
    },
    createMutationMetadata(`order.credit-approval.${action}:${approvalId}`, {
      idempotencyKey: command.idempotencyKey,
      expectedVersion: command.expectedVersion,
      signal,
    }),
  );
}
