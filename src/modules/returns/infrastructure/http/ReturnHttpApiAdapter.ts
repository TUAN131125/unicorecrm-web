import type { HttpClient } from "@/platform/api";
import {
  CommercialApiClient,
  type ApproveReturnRequest,
  type AwaitReturnItemRequest,
  type CompleteReturnResolutionRequest,
  type ConfigureReturnMethodRequest,
  type CreateReturnRequest,
  type ReceiveReturnItemsRequest,
  type RejectReturnRequest,
  type ReturnListResponse,
  type ReturnMutationResponse,
  type ReturnResolutionInput,
} from "@/platform/api/generated/commercialApi";
import type { AuthoritativePage } from "@/shared/application";
import type {
  CreateReturnInput,
  ReturnCommandOptions,
  ReturnCommandPort,
  ReturnListQuery,
  ReturnMutationResult,
  ReturnQueryPort,
  ReturnVersionedCommandOptions,
} from "../../application/ports/ReturnApiRuntime";
import type { ReturnRequest, ReturnResolution } from "../../domain/model/return.types";
import { mapReturnReadModelToApplication } from "../openapi/returnReadModelMapper";

export class ReturnHttpApiAdapter implements ReturnQueryPort, ReturnCommandPort {
  private readonly api: CommercialApiClient;

  constructor(client: HttpClient) {
    this.api = new CommercialApiClient(client);
  }

  async list(query: ReturnListQuery = {}, signal?: AbortSignal): Promise<AuthoritativePage<ReturnRequest>> {
    const filters = query.filters ?? {};
    const response = await this.api.listReturns<ReturnListResponse>(compact({
      cursor: query.cursor,
      limit: query.limit,
      search: query.search,
      sortBy: query.sortBy as "updatedAt" | "createdAt" | "requestedAt" | "code" | "status" | undefined,
      sortDirection: query.sortDirection,
      status: filters.status,
      orderId: filters.orderId,
      buyerId: filters.buyerId,
    }), signal);
    return {
      items: response.items.map(mapReturnReadModelToApplication),
      pageInfo: response.pageInfo,
      loadedAt: new Date().toISOString(),
      authority: "backend",
    };
  }

  async get(returnId: string, signal?: AbortSignal): Promise<ReturnRequest> {
    return mapReturnReadModelToApplication(await this.api.getReturn(returnId, {}, signal));
  }

  async create(input: CreateReturnInput, options: ReturnCommandOptions): Promise<ReturnMutationResult> {
    const body: CreateReturnRequest = compact({
      orderId: input.orderId,
      buyerRef: input.buyerRef,
      ownerId: input.ownerId,
      items: input.items.map((item) => ({
        orderLineId: item.orderLineId,
        productId: item.productId,
        productName: item.productNameSnapshot,
        orderedQuantity: item.orderedQuantity,
        requestedQuantity: item.requestedQuantity,
      })),
      reason: input.reason,
      requestedResolution: input.requestedResolution,
      note: input.note?.trim(),
      deliveryEvidenceShippingBookingId: input.deliveryEvidenceShippingBookingId,
      manualDeliveryEvidence: input.manualDeliveryEvidence ? {
        deliveredAt: input.manualDeliveryEvidence.deliveredAt,
        reason: input.manualDeliveryEvidence.reason.trim(),
        evidenceRef: input.manualDeliveryEvidence.evidenceRef.trim(),
      } : undefined,
    });
    return mapMutation(await this.api.createReturnRequestCommand<ReturnMutationResponse, CreateReturnRequest>(body, transport(options)));
  }

  async approve(returnId: string, input: Parameters<ReturnCommandPort["approve"]>[1], options: ReturnVersionedCommandOptions): Promise<ReturnMutationResult> {
    const body: ApproveReturnRequest = compact({
      reason: input.reason.trim(),
      overrideReason: input.overrideReason?.trim(),
      items: input.items?.map((item) => compact({
        orderLineId: item.orderLineId,
        approvedQuantity: item.approvedQuantity,
        approvalReason: item.approvalReason?.trim(),
      })),
    });
    return mapMutation(await this.api.approveReturnCommand<ReturnMutationResponse, ApproveReturnRequest>(returnId, body, transport(options)));
  }

  async reject(returnId: string, input: { reason: string }, options: ReturnVersionedCommandOptions): Promise<ReturnMutationResult> {
    const body: RejectReturnRequest = { reason: input.reason.trim() };
    return mapMutation(await this.api.rejectReturnCommand<ReturnMutationResponse, RejectReturnRequest>(returnId, body, transport(options)));
  }

  async awaitItem(returnId: string, input: { shippingBookingId: string }, options: ReturnVersionedCommandOptions): Promise<ReturnMutationResult> {
    const body: AwaitReturnItemRequest = { shippingBookingId: input.shippingBookingId };
    return mapMutation(await this.api.awaitReturnItemCommand<ReturnMutationResponse, AwaitReturnItemRequest>(returnId, body, transport(options)));
  }

  async configureMethod(returnId: string, input: Parameters<ReturnCommandPort["configureMethod"]>[1], options: ReturnVersionedCommandOptions): Promise<ReturnMutationResult> {
    const body: ConfigureReturnMethodRequest = compact({
      method: input.method,
      shippingBookingId: input.shippingBookingId,
      carrier: input.carrier?.trim(),
      trackingCode: input.trackingCode?.trim(),
      dropOffLocation: input.dropOffLocation?.trim(),
      returnByDate: input.returnByDate,
    });
    return mapMutation(await this.api.configureReturnMethodCommand<ReturnMutationResponse, ConfigureReturnMethodRequest>(returnId, body, transport(options)));
  }

  async receiveItems(returnId: string, input: Parameters<ReturnCommandPort["receiveItems"]>[1], options: ReturnVersionedCommandOptions): Promise<ReturnMutationResult> {
    const body: ReceiveReturnItemsRequest = {
      items: input.items.map((item) => compact({
        orderLineId: item.orderLineId,
        receivedQuantity: item.receivedQuantity,
        acceptedQuantity: item.acceptedQuantity,
        rejectedQuantity: item.rejectedQuantity,
        condition: item.condition?.trim(),
        disposition: item.disposition,
        inspectionNote: item.inspectionNote?.trim(),
        evidenceRefs: item.evidenceRefs,
      })),
      conditionNote: input.conditionNote.trim(),
    };
    return mapMutation(await this.api.receiveReturnItemsCommand<ReturnMutationResponse, ReceiveReturnItemsRequest>(returnId, body, transport(options)));
  }

  async completeResolution(returnId: string, input: Parameters<ReturnCommandPort["completeResolution"]>[1], options: ReturnVersionedCommandOptions): Promise<ReturnMutationResult> {
    const body: CompleteReturnResolutionRequest = compact({
      resolution: mapResolutionInput(input.resolution),
      intentId: input.intentId,
      intentIds: input.intentIds,
    });
    return mapMutation(await this.api.completeReturnResolutionCommand<ReturnMutationResponse, CompleteReturnResolutionRequest>(returnId, body, transport(options)));
  }

  async close(returnId: string, options: ReturnVersionedCommandOptions): Promise<ReturnMutationResult> {
    return mapMutation(await this.api.closeReturnCommand<ReturnMutationResponse, Record<string, never>>(returnId, {}, transport(options)));
  }
}

function transport(options: ReturnCommandOptions | ReturnVersionedCommandOptions) {
  return {
    idempotencyKey: options.idempotencyKey,
    ...(options.correlationId ? { correlationId: options.correlationId } : {}),
    ...("expectedVersion" in options ? { expectedVersion: options.expectedVersion } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
    retry: "idempotent" as const,
  };
}

function mapMutation(response: ReturnMutationResponse): ReturnMutationResult {
  const request = mapReturnReadModelToApplication(response.result.request);
  if (request.id !== response.aggregateId) throw new Error("CONNECTED_CONTRACT_VIOLATION:return:aggregate-id-mismatch");
  return {
    request,
    evidence: {
      authority: "backend",
      commandId: response.commandId,
      correlationId: response.correlationId,
      aggregateId: response.aggregateId,
      aggregateType: response.aggregateType,
      version: response.version,
      occurredAt: response.occurredAt,
      outcome: response.outcome,
      warnings: response.warnings ?? [],
      emittedEventIds: response.emittedEventIds ?? [],
      auditEvidenceIds: response.auditEvidenceIds ?? [],
    },
  };
}

function mapResolutionInput(value: ReturnResolution): ReturnResolutionInput {
  if (value.type === "REFUND") return { ...value };
  if (value.type === "REPLACEMENT") {
    return {
      type: value.type,
      replacementLines: value.replacementLines.map((line) => ({
        productId: line.productId, productName: line.productNameSnapshot, quantity: line.quantity,
      })),
      ...(value.shippingBookingId ? { shippingBookingId: value.shippingBookingId } : {}),
    };
  }
  if (value.type === "EXCHANGE") {
    return compact({
      type: value.type,
      exchangeLines: value.exchangeLines.map((line) => ({
        productId: line.productId, productName: line.productNameSnapshot, quantity: line.quantity,
      })),
      commercialDelta: value.commercialDelta === undefined || !value.currency
        ? undefined
        : { amount: String(value.commercialDelta), currency: value.currency },
      commercialAdjustmentNote: value.commercialAdjustmentNote,
      paymentIntentId: value.paymentIntentId,
      shippingBookingId: value.shippingBookingId,
      creditNoteIds: value.creditNoteIds,
      refundIntentIds: value.refundIntentIds,
      refundPaymentRecordIds: value.refundPaymentRecordIds,
      creditedAmount: value.creditedAmount,
      refundedAmount: value.refundedAmount,
    }) as ReturnResolutionInput;
  }
  if (value.type === "REPAIR") {
    return {
      type: value.type,
      repairJob: {
        reference: value.repairJob.reference,
        provider: value.repairJob.provider,
        receivedAt: value.repairJob.receivedAt,
        expectedCompletionAt: value.repairJob.expectedCompletionAt,
        status: value.repairJob.status,
        result: value.repairJob.result,
      },
      returnShippingBookingId: value.returnShippingBookingId,
    };
  }
  return { ...value };
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== "")) as T;
}
