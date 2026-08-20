import type { AuthoritativePage } from "@/shared/application";
import {
  cancelShippingBooking,
  changeShippingProvider,
  createShippingBooking,
  retryShippingBooking,
  syncShippingBooking,
} from "../application/commands/shippingCommands";
import type {
  ShippingApiRuntime,
  ShippingCommandOptions,
  ShippingMutationResult,
  ShippingVersionedCommandOptions,
} from "../application/ports/ShippingApiRuntime";
import type { ShippingConfigurationPort } from "../application/ports/ShippingConfigurationPort";
import type { ShippingProviderRegistry } from "../application/ports/ShippingProviderRegistry";
import type { ShippingRepository } from "../application/ports/ShippingRepository";
import type { ShippingBooking } from "../domain/model/shipping.types";

export function createShippingDemoApiRuntime(
  repository: ShippingRepository,
  providers: ShippingProviderRegistry,
  configuration: ShippingConfigurationPort,
  workspaceId: () => string,
): ShippingApiRuntime {
  return {
    mode: "demo",
    queries: {
      async list(): Promise<AuthoritativePage<ShippingBooking>> {
        const items = repository.list();
        return page(items);
      },
      async get(bookingId) {
        const item = repository.findById(bookingId);
        if (!item) throw new Error(`SHIPPING_BOOKING_NOT_FOUND:${bookingId}`);
        return item;
      },
      async listProviders() { return providers.list(); },
      async listPickupLocations() { return configuration.getPickupLocations(); },
      async listReturnLocations() { return configuration.getReturnLocations(); },
    },
    commands: {
      async createBooking(input, options) {
        const item = await createShippingBooking(repository, providers, {
          id: input.clientLocalId ?? `shipping_${crypto.randomUUID()}`,
          workspaceId: workspaceId(),
          code: input.clientCode ?? `SHP-${Date.now()}`,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          purpose: input.purpose,
          transportMode: input.transportMode,
          providerId: input.providerId,
          serviceCode: input.serviceCode,
          serviceName: input.serviceName,
          pickupLocationSnapshot: input.pickupLocationSnapshot,
          returnLocationSnapshot: input.returnLocationSnapshot,
          recipientSnapshot: input.recipientSnapshot,
          packageSnapshot: input.packageSnapshot,
          codAmount: input.codAmount,
          shipmentGroupId: input.shipmentGroupId,
          idempotencyKey: options.idempotencyKey,
          correlationId: options.correlationId ?? `corr_${crypto.randomUUID()}`,
          actorId: "demo-local-runtime",
        });
        return result(item, options);
      },
      async cancelBooking(bookingId, input, options) {
        requireVersion(repository, bookingId, options.expectedVersion);
        return result(await cancelShippingBooking(repository, providers, bookingId, { reason: input.reason, actorId: "demo-local-runtime" }), options);
      },
      async syncBooking(bookingId, options) {
        requireVersion(repository, bookingId, options.expectedVersion);
        return result(await syncShippingBooking(repository, providers, bookingId, { actorId: "demo-local-runtime" }), options);
      },
      async retryBooking(bookingId, input, options) {
        requireVersion(repository, bookingId, options.expectedVersion);
        return result(await retryShippingBooking(repository, providers, bookingId, {
          id: input.clientLocalId ?? `shipping_${crypto.randomUUID()}`,
          code: input.clientCode ?? `SHP-${Date.now()}`,
          providerId: input.providerId,
          actorId: "demo-local-runtime",
        }), options);
      },
      async changeProvider(bookingId, input, options) {
        requireVersion(repository, bookingId, options.expectedVersion);
        return result(await changeShippingProvider(repository, providers, bookingId, {
          id: input.clientLocalId ?? `shipping_${crypto.randomUUID()}`,
          code: input.clientCode ?? `SHP-${Date.now()}`,
          providerId: input.providerId,
          actorId: "demo-local-runtime",
        }), options);
      },
    },
  };
}

function page(items: ShippingBooking[]): AuthoritativePage<ShippingBooking> {
  return { items, pageInfo: { hasNextPage: false, totalCount: items.length }, loadedAt: new Date().toISOString(), authority: "demo" };
}

function requireVersion(repository: ShippingRepository, bookingId: string, expectedVersion: number): void {
  const item = repository.findById(bookingId);
  if (!item) throw new Error(`SHIPPING_BOOKING_NOT_FOUND:${bookingId}`);
  if (item.version !== expectedVersion) throw new Error(`SHIPPING_BOOKING_VERSION_CONFLICT:${bookingId}`);
}

function result(item: ShippingBooking, options: ShippingCommandOptions | ShippingVersionedCommandOptions): ShippingMutationResult {
  const occurredAt = item.updatedAt;
  return {
    booking: item,
    evidence: {
      authority: "demo",
      commandId: options.idempotencyKey,
      correlationId: options.correlationId ?? item.correlationId ?? `corr_${crypto.randomUUID()}`,
      aggregateId: item.id,
      aggregateType: "shipping-booking",
      version: item.version,
      occurredAt,
      outcome: "DEMO_COMMITTED",
      warnings: [],
      emittedEventIds: [],
      auditEvidenceIds: [],
    },
  };
}
