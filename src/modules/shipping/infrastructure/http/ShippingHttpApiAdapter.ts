import type { HttpClient } from "@/platform/api";
import {
  CommercialApiClient,
  type CancelShippingBookingRequest,
  type ChangeShippingProviderRequest,
  type CreateShippingBookingRequest,
  type RetryShippingBookingRequest,
  type ShippingBookingListResponse,
  type ShippingBookingMutationResponse,
  type ShippingProviderListResponse,
} from "@/platform/api/generated/commercialApi";
import {
  FinancialConfigurationApiClient,
  type ConfigurationDocumentResponse,
} from "@/platform/api/generated/financialConfigurationApi";
import type { AuthoritativePage } from "@/shared/application";
import type {
  CreateShippingBookingInput,
  ShippingBookingListQuery,
  ShippingCommandOptions,
  ShippingCommandPort,
  ShippingMutationResult,
  ShippingQueryPort,
  ShippingVersionedCommandOptions,
} from "../../application/ports/ShippingApiRuntime";
import type { PickupLocationConfiguration, ShippingProviderCapabilities, ShippingServiceConfig } from "../../domain/model/shippingConfiguration.types";
import type { ShippingProvider } from "../../domain/model/shippingProvider";
import type { AddressSnapshot, ShippingBooking, ShippingPackageSnapshot } from "../../domain/model/shipping.types";
import { mapShippingBookingReadModelToApplication } from "../openapi/shippingReadModelMapper";

export class ShippingHttpApiAdapter implements ShippingQueryPort, ShippingCommandPort {
  private readonly api: CommercialApiClient;
  private readonly configuration: FinancialConfigurationApiClient;

  constructor(client: HttpClient) {
    this.api = new CommercialApiClient(client);
    this.configuration = new FinancialConfigurationApiClient(client);
  }

  async list(query: ShippingBookingListQuery = {}, signal?: AbortSignal): Promise<AuthoritativePage<ShippingBooking>> {
    const filters = query.filters ?? {};
    const response = await this.api.listShippingBookings<ShippingBookingListResponse>(compact({
      cursor: query.cursor,
      limit: query.limit,
      search: query.search,
      sortBy: query.sortBy as "updatedAt" | "createdAt" | "code" | "bookingStatus" | "externalStatus" | undefined,
      sortDirection: query.sortDirection,
      sourceType: filters.sourceType,
      sourceId: filters.sourceId,
      bookingStatus: filters.bookingStatus,
    }), signal);
    return {
      items: response.items.map(mapShippingBookingReadModelToApplication),
      pageInfo: response.pageInfo,
      loadedAt: new Date().toISOString(),
      authority: "backend",
    };
  }

  async get(bookingId: string, signal?: AbortSignal): Promise<ShippingBooking> {
    return mapShippingBookingReadModelToApplication(await this.api.getShippingBooking(bookingId, {}, signal));
  }

  async listProviders(signal?: AbortSignal): Promise<ShippingProvider[]> {
    const response = await this.api.listShippingProviders<ShippingProviderListResponse>({}, signal);
    return response.items.map((provider) => {
      const capabilities = mapCapabilities(provider.capabilities, provider.id);
      const services = provider.services.map((service) => mapService(service, provider.id));
      return {
        id: provider.id,
        code: provider.code,
        name: provider.name,
        status: provider.status,
        environment: provider.environment,
        isDefault: provider.isDefault,
        capabilities,
        services,
        createBooking: async () => { throw new Error("CONNECTED_SHIPPING_PROVIDER_COMMAND_REQUIRES_HTTP_ADAPTER"); },
      } satisfies ShippingProvider;
    });
  }

  async listPickupLocations(signal?: AbortSignal): Promise<PickupLocationConfiguration[]> {
    return mapLocations(await this.configuration.listShippingPickupLocations<ConfigurationDocumentResponse>({}, signal), "listShippingPickupLocations");
  }

  async listReturnLocations(signal?: AbortSignal): Promise<PickupLocationConfiguration[]> {
    return mapLocations(await this.configuration.listShippingReturnLocations<ConfigurationDocumentResponse>({}, signal), "listShippingReturnLocations");
  }

  async createBooking(input: CreateShippingBookingInput, options: ShippingCommandOptions): Promise<ShippingMutationResult> {
    const body: CreateShippingBookingRequest = {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      purpose: input.purpose,
      ...(input.transportMode ? { transportMode: input.transportMode } : {}),
      providerId: input.providerId,
      ...(input.serviceCode?.trim() ? { serviceCode: input.serviceCode.trim() } : {}),
      pickupLocation: mapLocationInput(input.pickupLocationSnapshot),
      ...(input.returnLocationSnapshot ? { returnLocation: mapLocationInput(input.returnLocationSnapshot) } : {}),
      recipient: {
        name: input.recipientSnapshot.name.trim(),
        phone: input.recipientSnapshot.phone.trim(),
        ...(input.recipientSnapshot.email?.trim() ? { email: input.recipientSnapshot.email.trim() } : {}),
        address: mapAddressInput(input.recipientSnapshot.address),
      },
      package: mapPackageInput(input.packageSnapshot),
      ...(input.codAmount ? { codAmount: input.codAmount } : {}),
      shipmentGroupId: input.shipmentGroupId.trim(),
    };
    return mapMutation(await this.api.createShippingBookingCommand<ShippingBookingMutationResponse, CreateShippingBookingRequest>(body, transport(options)));
  }

  async cancelBooking(bookingId: string, input: { reason: string }, options: ShippingVersionedCommandOptions): Promise<ShippingMutationResult> {
    const body: CancelShippingBookingRequest = { reason: input.reason.trim() };
    return mapMutation(await this.api.cancelShippingBookingCommand<ShippingBookingMutationResponse, CancelShippingBookingRequest>(bookingId, body, transport(options)));
  }

  async syncBooking(bookingId: string, options: ShippingVersionedCommandOptions): Promise<ShippingMutationResult> {
    return mapMutation(await this.api.syncShippingBookingCommand<ShippingBookingMutationResponse, Record<string, never>>(bookingId, {}, transport(options)));
  }

  async retryBooking(bookingId: string, input: { providerId?: string }, options: ShippingVersionedCommandOptions): Promise<ShippingMutationResult> {
    const body: RetryShippingBookingRequest = compact({ providerId: input.providerId });
    return mapMutation(await this.api.retryShippingBookingCommand<ShippingBookingMutationResponse, RetryShippingBookingRequest>(bookingId, body, transport(options)));
  }

  async changeProvider(bookingId: string, input: { providerId: string }, options: ShippingVersionedCommandOptions): Promise<ShippingMutationResult> {
    const body: ChangeShippingProviderRequest = { providerId: input.providerId.trim() };
    return mapMutation(await this.api.changeShippingProviderCommand<ShippingBookingMutationResponse, ChangeShippingProviderRequest>(bookingId, body, transport(options)));
  }
}

function transport(options: ShippingCommandOptions | ShippingVersionedCommandOptions) {
  return {
    idempotencyKey: options.idempotencyKey,
    ...(options.correlationId ? { correlationId: options.correlationId } : {}),
    ...("expectedVersion" in options ? { expectedVersion: options.expectedVersion } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
    retry: "idempotent" as const,
  };
}

function mapMutation(response: ShippingBookingMutationResponse): ShippingMutationResult {
  const booking = mapShippingBookingReadModelToApplication(response.result.booking);
  if (booking.id !== response.aggregateId) throw new Error("CONNECTED_CONTRACT_VIOLATION:shipping:aggregate-id-mismatch");
  return {
    booking,
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

function mapAddressInput(value: AddressSnapshot) {
  return compact({
    line1: value.line1.trim(), line2: value.line2?.trim(), ward: value.ward?.trim(),
    wardCode: value.wardCode?.trim(), district: value.district?.trim(), districtCode: value.districtCode?.trim(),
    city: value.city.trim(), provinceCode: value.provinceCode?.trim(), country: value.country?.trim(),
    countryCode: value.countryCode?.trim(), postalCode: value.postalCode?.trim(),
  });
}

function mapLocationInput(value: AddressSnapshot & { id?: string; name?: string; contactName?: string; phone?: string }) {
  return compact({
    id: value.id, name: value.name?.trim(), contactName: value.contactName?.trim(), phone: value.phone?.trim(),
    ...mapAddressInput(value),
  });
}

function mapPackageInput(value: ShippingPackageSnapshot): CreateShippingBookingRequest["package"] {
  return compact({
    packageCount: value.packageCount,
    totalWeightGrams: value.totalWeightGrams,
    lengthCm: value.lengthCm,
    widthCm: value.widthCm,
    heightCm: value.heightCm,
    declaredValue: value.declaredValue,
    feePayer: value.feePayer,
    inspectionPolicy: value.inspectionPolicy,
    itemSummary: value.itemSummary?.trim(),
    note: value.note?.trim(),
    pickupNote: value.pickupNote?.trim(),
    deliveryNote: value.deliveryNote?.trim(),
    packageType: value.packageType,
    transportMode: value.transportMode,
    goodsType: value.goodsType,
    lineAllocations: value.lineAllocations?.map((line) => compact({
      orderLineId: line.orderLineId,
      productId: line.productId,
      sku: line.skuSnapshot,
      productName: line.productNameSnapshot,
      quantity: line.quantity,
      weightGrams: line.weightGrams,
      declaredValue: line.declaredValue,
      hsCode: line.hsCode,
      countryOfOrigin: line.countryOfOrigin,
    })),
  });
}

function mapCapabilities(value: Record<string, unknown>, providerId: string): ShippingProviderCapabilities {
  const keys = ["quote", "booking", "cancel", "sync", "label", "tracking", "cod", "returnPickup"] as const;
  for (const key of keys) if (typeof value[key] !== "boolean") throw new Error(`CONNECTED_CONTRACT_VIOLATION:listShippingProviders:${providerId}:${key}`);
  return Object.fromEntries(keys.map((key) => [key, value[key]])) as unknown as ShippingProviderCapabilities;
}

function mapService(value: Record<string, unknown>, providerId: string): ShippingServiceConfig {
  if (
    typeof value.code !== "string" || typeof value.name !== "string"
    || typeof value.enabled !== "boolean" || typeof value.supportsCod !== "boolean"
    || !Array.isArray(value.supportedModes)
  ) throw new Error(`CONNECTED_CONTRACT_VIOLATION:listShippingProviders:${providerId}:service`);
  return {
    code: value.code,
    name: value.name,
    enabled: value.enabled,
    supportedModes: value.supportedModes as ShippingServiceConfig["supportedModes"],
    supportsCod: value.supportsCod,
    maxWeightGrams: typeof value.maxWeightGrams === "number" ? value.maxWeightGrams : undefined,
    estimatedDays: typeof value.estimatedDays === "number" ? value.estimatedDays : undefined,
  };
}

function mapLocations(response: ConfigurationDocumentResponse, operationId: string): PickupLocationConfiguration[] {
  const items = Array.isArray(response.data) ? response.data : Array.isArray(response.data.items) ? response.data.items : null;
  if (!items) throw new Error(`CONNECTED_CONTRACT_VIOLATION:${operationId}:items`);
  return items.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`CONNECTED_CONTRACT_VIOLATION:${operationId}:item:${index}`);
    const item = value as Record<string, unknown>;
    for (const key of ["id", "name", "contactName", "phone", "addressLine", "city"]) {
      if (typeof item[key] !== "string") throw new Error(`CONNECTED_CONTRACT_VIOLATION:${operationId}:item:${index}:${key}`);
    }
    return {
      addressId: typeof item.addressId === "string" ? item.addressId : item.id as string,
      id: item.id as string,
      name: item.name as string,
      contactName: item.contactName as string,
      phone: item.phone as string,
      addressLine: item.addressLine as string,
      city: item.city as string,
      isDefault: item.isDefault === true,
      isActive: item.isActive !== false,
    };
  });
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== "")) as T;
}
