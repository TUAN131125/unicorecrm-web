import type { AuthoritativePage } from "@/shared/application";
import {
  approveReturn,
  closeReturn,
  completeReturnResolution,
  configureReturnMethod,
  confirmReturnedItemsReceived,
  createReturnRequest,
  markReturnAwaitingItem,
  rejectReturn,
} from "../application/commands/returnCommands";
import type {
  ReturnApiRuntime,
  ReturnCommandOptions,
  ReturnMutationResult,
  ReturnVersionedCommandOptions,
} from "../application/ports/ReturnApiRuntime";
import type { ReturnRepository } from "../application/ports/ReturnRepository";
import type { ReturnRequest } from "../domain/model/return.types";

export function createReturnDemoApiRuntime(repository: ReturnRepository, workspaceId: () => string): ReturnApiRuntime {
  return {
    mode: "demo",
    queries: {
      async list(): Promise<AuthoritativePage<ReturnRequest>> {
        const items = repository.listRequests();
        return { items, pageInfo: { hasNextPage: false, totalCount: items.length }, loadedAt: new Date().toISOString(), authority: "demo" };
      },
      async get(returnId) {
        const item = repository.findById(returnId);
        if (!item) throw new Error(`RETURN_NOT_FOUND:${returnId}`);
        return item;
      },
    },
    commands: {
      async create(input, options) {
        return result(createReturnRequest(repository, {
          id: input.clientLocalId ?? `return_${crypto.randomUUID()}`,
          workspaceId: workspaceId(),
          code: input.clientCode ?? `RET-${Date.now()}`,
          orderId: input.orderId,
          buyerRef: input.buyerRef,
          ownerId: input.ownerId,
          items: input.items,
          reason: input.reason,
          requestedResolution: input.requestedResolution,
          note: input.note,
          deliveredAt: input.deliveredAt,
          deliveryEvidenceShippingBookingId: input.deliveryEvidenceShippingBookingId,
          manualDeliveryEvidence: input.manualDeliveryEvidence,
          returnWindowDays: input.returnWindowDays,
          actorId: "demo-local-runtime",
          correlationId: options.correlationId,
        }), options);
      },
      async approve(returnId, input, options) {
        requireVersion(repository, returnId, options.expectedVersion);
        return result(approveReturn(repository, returnId, { ...input, actorId: "demo-local-runtime" }), options);
      },
      async reject(returnId, input, options) {
        requireVersion(repository, returnId, options.expectedVersion);
        return result(rejectReturn(repository, returnId, { ...input, actorId: "demo-local-runtime" }), options);
      },
      async awaitItem(returnId, input, options) {
        requireVersion(repository, returnId, options.expectedVersion);
        return result(markReturnAwaitingItem(repository, returnId, { ...input, actorId: "demo-local-runtime" }), options);
      },
      async configureMethod(returnId, input, options) {
        requireVersion(repository, returnId, options.expectedVersion);
        return result(configureReturnMethod(repository, returnId, { ...input, actorId: "demo-local-runtime" }), options);
      },
      async receiveItems(returnId, input, options) {
        requireVersion(repository, returnId, options.expectedVersion);
        return result(confirmReturnedItemsReceived(repository, returnId, { ...input, actorId: "demo-local-runtime" }), options);
      },
      async completeResolution(returnId, input, options) {
        requireVersion(repository, returnId, options.expectedVersion);
        return result(completeReturnResolution(repository, returnId, { ...input, actorId: "demo-local-runtime" }), options);
      },
      async close(returnId, options) {
        requireVersion(repository, returnId, options.expectedVersion);
        return result(closeReturn(repository, returnId, { actorId: "demo-local-runtime" }), options);
      },
    },
  };
}

function requireVersion(repository: ReturnRepository, returnId: string, expectedVersion: number): void {
  const item = repository.findById(returnId);
  if (!item) throw new Error(`RETURN_NOT_FOUND:${returnId}`);
  if (item.version !== expectedVersion) throw new Error(`RETURN_VERSION_CONFLICT:${returnId}`);
}

function result(item: ReturnRequest, options: ReturnCommandOptions | ReturnVersionedCommandOptions): ReturnMutationResult {
  return {
    request: item,
    evidence: {
      authority: "demo",
      commandId: options.idempotencyKey,
      correlationId: options.correlationId ?? item.correlationId ?? `corr_${crypto.randomUUID()}`,
      aggregateId: item.id,
      aggregateType: "return",
      version: item.version,
      occurredAt: item.updatedAt,
      outcome: "DEMO_COMMITTED",
      warnings: [],
      emittedEventIds: [],
      auditEvidenceIds: [],
    },
  };
}
