import type { BuyerRef } from "@/platform/identity";
import type { AuthoritativePage, ModuleListQuery } from "@/shared/application";
import type {
  RequestedReturnResolution,
  ReturnItem,
  ReturnMethod,
  ReturnReason,
  ReturnRequest,
  ReturnResolution,
  ReturnStatus,
} from "../../domain/model/return.types";

export type ReturnApiRuntimeMode = "demo" | "connected" | "test";

export interface ReturnListQuery extends ModuleListQuery {
  filters?: {
    orderId?: string;
    buyerId?: string;
    status?: ReturnStatus;
    reason?: ReturnReason;
    requestedResolution?: RequestedReturnResolution;
    ownerId?: string;
  };
}

export interface CreateReturnInput {
  clientLocalId?: string;
  clientCode?: string;
  orderId: string;
  buyerRef: BuyerRef;
  ownerId: string;
  items: ReturnItem[];
  reason: ReturnReason;
  requestedResolution: RequestedReturnResolution;
  note?: string;
  deliveredAt?: string;
  deliveryEvidenceShippingBookingId?: string;
  manualDeliveryEvidence?: { deliveredAt: string; reason: string; evidenceRef: string };
  returnWindowDays?: number;
}

export interface ReturnCommandOptions {
  idempotencyKey: string;
  correlationId?: string;
  signal?: AbortSignal;
}

export interface ReturnVersionedCommandOptions extends ReturnCommandOptions {
  expectedVersion: number;
}

export interface ReturnMutationEvidence {
  authority: "backend" | "demo" | "test";
  commandId: string;
  correlationId: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  occurredAt: string;
  outcome: "COMMITTED" | "REPLAYED" | "DEMO_COMMITTED";
  warnings: readonly string[];
  emittedEventIds: readonly string[];
  auditEvidenceIds: readonly string[];
}

export interface ReturnMutationResult {
  request: ReturnRequest;
  evidence: ReturnMutationEvidence;
}

export interface ReturnQueryPort {
  list(query?: ReturnListQuery, signal?: AbortSignal): Promise<AuthoritativePage<ReturnRequest>>;
  get(returnId: string, signal?: AbortSignal): Promise<ReturnRequest>;
}

export interface ReturnCommandPort {
  create(input: CreateReturnInput, options: ReturnCommandOptions): Promise<ReturnMutationResult>;
  approve(returnId: string, input: { reason: string; overrideReason?: string; items?: Array<{ orderLineId: string; approvedQuantity: number; approvalReason?: string }> }, options: ReturnVersionedCommandOptions): Promise<ReturnMutationResult>;
  reject(returnId: string, input: { reason: string }, options: ReturnVersionedCommandOptions): Promise<ReturnMutationResult>;
  awaitItem(returnId: string, input: { shippingBookingId: string }, options: ReturnVersionedCommandOptions): Promise<ReturnMutationResult>;
  configureMethod(returnId: string, input: { method: ReturnMethod; shippingBookingId?: string; carrier?: string; trackingCode?: string; dropOffLocation?: string; returnByDate?: string }, options: ReturnVersionedCommandOptions): Promise<ReturnMutationResult>;
  receiveItems(returnId: string, input: { items: Array<{ orderLineId: string; receivedQuantity: number; acceptedQuantity?: number; rejectedQuantity?: number; condition?: string; disposition?: ReturnItem["disposition"]; inspectionNote?: string; evidenceRefs?: string[] }>; conditionNote: string }, options: ReturnVersionedCommandOptions): Promise<ReturnMutationResult>;
  completeResolution(returnId: string, input: { resolution: ReturnResolution; intentId?: string; intentIds?: string[] }, options: ReturnVersionedCommandOptions): Promise<ReturnMutationResult>;
  close(returnId: string, options: ReturnVersionedCommandOptions): Promise<ReturnMutationResult>;
}

export interface ReturnApiRuntime {
  mode: ReturnApiRuntimeMode;
  queries: ReturnQueryPort;
  commands: ReturnCommandPort;
}
