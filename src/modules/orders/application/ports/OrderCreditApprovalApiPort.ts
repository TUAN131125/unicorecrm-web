import type { OrderCreditApprovalDocument } from "../credit-approval/orderCreditApproval.types";

export interface RequestOrderCreditApprovalCommand {
  creationIntentId: string;
  orderId: string;
  expectedOrderVersion: number;
  reason: string;
  idempotencyKey: string;
}

export interface DecideOrderCreditApprovalCommand {
  expectedVersion: number;
  decisionNote?: string;
  idempotencyKey: string;
}

export interface RevokeOrderCreditApprovalCommand {
  expectedVersion: number;
  reason: string;
  idempotencyKey: string;
}

export interface OrderCreditApprovalApiPort {
  get(approvalId: string, signal?: AbortSignal): Promise<OrderCreditApprovalDocument>;
  request(command: RequestOrderCreditApprovalCommand, signal?: AbortSignal): Promise<OrderCreditApprovalDocument>;
  approve(approvalId: string, command: DecideOrderCreditApprovalCommand, signal?: AbortSignal): Promise<OrderCreditApprovalDocument>;
  reject(approvalId: string, command: DecideOrderCreditApprovalCommand, signal?: AbortSignal): Promise<OrderCreditApprovalDocument>;
  revoke(approvalId: string, command: RevokeOrderCreditApprovalCommand, signal?: AbortSignal): Promise<OrderCreditApprovalDocument>;
}
