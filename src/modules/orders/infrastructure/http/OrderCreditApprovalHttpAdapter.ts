import {
  CommercialApiClient,
  type ApproveOrderCreditApprovalRequest,
  type GetOrderCreditApprovalQuery,
  type OrderCreditApprovalDocument as ApiOrderCreditApprovalDocument,
  type OrderCreditApprovalMutationResponse,
  type RejectOrderCreditApprovalRequest,
  type RequestOrderCreditApprovalRequest,
  type RevokeOrderCreditApprovalRequest,
} from "@/platform/api/generated/commercialApi";
import type { HttpClient } from "@/platform/api";
import type { OrderCreditApprovalDocument } from "../../application/credit-approval/orderCreditApproval.types";
import type {
  DecideOrderCreditApprovalCommand,
  OrderCreditApprovalApiPort,
  RequestOrderCreditApprovalCommand,
  RevokeOrderCreditApprovalCommand,
} from "../../application/ports/OrderCreditApprovalApiPort";

export class OrderCreditApprovalHttpAdapter implements OrderCreditApprovalApiPort {
  private readonly api: CommercialApiClient;

  constructor(http: HttpClient) {
    this.api = new CommercialApiClient(http);
  }

  async get(approvalId: string, signal?: AbortSignal): Promise<OrderCreditApprovalDocument> {
    const value = await this.api.getOrderCreditApproval<ApiOrderCreditApprovalDocument>(approvalId, {} satisfies GetOrderCreditApprovalQuery, signal);
    return project(value);
  }

  async request(command: RequestOrderCreditApprovalCommand, signal?: AbortSignal): Promise<OrderCreditApprovalDocument> {
    const body: RequestOrderCreditApprovalRequest = { orderId: command.orderId, reason: command.reason };
    const response = await this.api.requestOrderCreditApproval<OrderCreditApprovalMutationResponse, RequestOrderCreditApprovalRequest>(body, {
      signal,
      idempotencyKey: command.idempotencyKey,
      expectedVersion: command.expectedOrderVersion,
      retry: "idempotent",
    });
    return project(response.result.approval);
  }

  approve(approvalId: string, command: DecideOrderCreditApprovalCommand, signal?: AbortSignal): Promise<OrderCreditApprovalDocument> {
    return this.decide(approvalId, "approve", command, signal);
  }

  reject(approvalId: string, command: DecideOrderCreditApprovalCommand, signal?: AbortSignal): Promise<OrderCreditApprovalDocument> {
    return this.decide(approvalId, "reject", command, signal);
  }

  async revoke(approvalId: string, command: RevokeOrderCreditApprovalCommand, signal?: AbortSignal): Promise<OrderCreditApprovalDocument> {
    const body: RevokeOrderCreditApprovalRequest = { reason: command.reason };
    const response = await this.api.revokeOrderCreditApproval<OrderCreditApprovalMutationResponse, RevokeOrderCreditApprovalRequest>(approvalId, body, {
      signal,
      idempotencyKey: command.idempotencyKey,
      expectedVersion: command.expectedVersion,
      retry: "idempotent",
    });
    return project(response.result.approval);
  }

  private async decide(
    approvalId: string,
    action: "approve" | "reject",
    command: DecideOrderCreditApprovalCommand,
    signal?: AbortSignal,
  ): Promise<OrderCreditApprovalDocument> {
    const body = command.decisionNote ? { decisionNote: command.decisionNote } : {};
    const response = action === "approve"
      ? await this.api.approveOrderCreditApproval<OrderCreditApprovalMutationResponse, ApproveOrderCreditApprovalRequest>(approvalId, body, {
          signal, idempotencyKey: command.idempotencyKey, expectedVersion: command.expectedVersion, retry: "idempotent",
        })
      : await this.api.rejectOrderCreditApproval<OrderCreditApprovalMutationResponse, RejectOrderCreditApprovalRequest>(approvalId, body, {
          signal, idempotencyKey: command.idempotencyKey, expectedVersion: command.expectedVersion, retry: "idempotent",
        });
    return project(response.result.approval);
  }
}

function project(value: ApiOrderCreditApprovalDocument): OrderCreditApprovalDocument {
  return {
    id: value.id,
    orderId: value.orderId,
    orderResourceVersion: value.orderResourceVersion,
    paymentPlanId: value.paymentPlanId,
    paymentPlanResourceVersion: value.paymentPlanResourceVersion,
    amount: value.amount,
    policyVersion: value.policyVersion,
    evaluationFingerprint: value.evaluationFingerprint,
    state: value.state,
    requestReason: value.requestReason,
    requestedBy: value.requestedBy,
    requestedAt: value.requestedAt,
    ...(value.decisionBy ? { decisionBy: value.decisionBy } : {}),
    ...(value.decisionAt ? { decisionAt: value.decisionAt } : {}),
    ...(value.decisionNote ? { decisionNote: value.decisionNote } : {}),
    ...(value.revokedBy ? { revokedBy: value.revokedBy } : {}),
    ...(value.revokedAt ? { revokedAt: value.revokedAt } : {}),
    ...(value.revocationReason ? { revocationReason: value.revocationReason } : {}),
    ...(value.consumedAt ? { consumedAt: value.consumedAt } : {}),
    ...(value.consumedByCommandId ? { consumedByCommandId: value.consumedByCommandId } : {}),
    resourceVersion: value.resourceVersion,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}
