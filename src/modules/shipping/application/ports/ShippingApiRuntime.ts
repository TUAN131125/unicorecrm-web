import type { AuthoritativePage, ModuleListQuery } from "@/shared/application";
import type { PickupLocationConfiguration } from "../../domain/model/shippingConfiguration.types";
import type { ShippingProvider } from "../../domain/model/shippingProvider";
import type {
  AddressSnapshot,
  Money,
  RecipientSnapshot,
  ShippingBooking,
  ShippingPackageSnapshot,
  ShippingPurpose,
  ShippingSourceType,
  ShippingTransportMode,
} from "../../domain/model/shipping.types";

export type ShippingApiRuntimeMode = "demo" | "connected" | "test";

export interface ShippingBookingListQuery extends ModuleListQuery {
  filters?: {
    sourceType?: ShippingSourceType;
    sourceId?: string;
    purpose?: ShippingPurpose;
    bookingStatus?: ShippingBooking["bookingStatus"];
    providerId?: string;
  };
}

export interface CreateShippingBookingInput {
  clientLocalId?: string;
  clientCode?: string;
  sourceType: ShippingSourceType;
  sourceId: string;
  purpose: ShippingPurpose;
  transportMode?: ShippingTransportMode;
  providerId: string;
  serviceCode?: string;
  serviceName?: string;
  pickupLocationSnapshot: AddressSnapshot & { id?: string; name?: string; contactName?: string; phone?: string };
  returnLocationSnapshot?: AddressSnapshot & { id?: string; name?: string; contactName?: string; phone?: string };
  recipientSnapshot: RecipientSnapshot;
  packageSnapshot: ShippingPackageSnapshot;
  codAmount?: Money;
  shipmentGroupId: string;
}

export interface ShippingCommandOptions {
  idempotencyKey: string;
  correlationId?: string;
  signal?: AbortSignal;
}

export interface ShippingVersionedCommandOptions extends ShippingCommandOptions {
  expectedVersion: number;
}

export interface ShippingMutationEvidence {
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

export interface ShippingMutationResult {
  booking: ShippingBooking;
  evidence: ShippingMutationEvidence;
}

export interface ShippingQueryPort {
  list(query?: ShippingBookingListQuery, signal?: AbortSignal): Promise<AuthoritativePage<ShippingBooking>>;
  get(bookingId: string, signal?: AbortSignal): Promise<ShippingBooking>;
  listProviders(signal?: AbortSignal): Promise<ShippingProvider[]>;
  listPickupLocations(signal?: AbortSignal): Promise<PickupLocationConfiguration[]>;
  listReturnLocations(signal?: AbortSignal): Promise<PickupLocationConfiguration[]>;
}

export interface ShippingCommandPort {
  createBooking(input: CreateShippingBookingInput, options: ShippingCommandOptions): Promise<ShippingMutationResult>;
  cancelBooking(bookingId: string, input: { reason: string }, options: ShippingVersionedCommandOptions): Promise<ShippingMutationResult>;
  syncBooking(bookingId: string, options: ShippingVersionedCommandOptions): Promise<ShippingMutationResult>;
  retryBooking(bookingId: string, input: { providerId?: string; clientLocalId?: string; clientCode?: string }, options: ShippingVersionedCommandOptions): Promise<ShippingMutationResult>;
  changeProvider(bookingId: string, input: { providerId: string; clientLocalId?: string; clientCode?: string }, options: ShippingVersionedCommandOptions): Promise<ShippingMutationResult>;
}

export interface ShippingApiRuntime {
  mode: ShippingApiRuntimeMode;
  queries: ShippingQueryPort;
  commands: ShippingCommandPort;
}
