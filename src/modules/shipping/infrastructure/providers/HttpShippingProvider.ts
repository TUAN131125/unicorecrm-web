import type { HttpClient } from "@/platform/api";
import type { ShippingProviderSetup } from "../../domain/model/shippingConfiguration.types";
import type { ShippingProvider } from "../../domain/model/shippingProvider";
import type { CreateShippingBookingResult, ExternalShippingSnapshot, ShippingQuote, ShippingTransportMode } from "../../domain/model/shipping.types";

/**
 * Connected carrier adapter. Carrier credentials remain server-side; this client
 * only calls the workspace Shipping API and never talks to a carrier directly.
 */
export class HttpShippingProvider implements ShippingProvider {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly status: ShippingProviderSetup["status"];
  readonly environment: ShippingProviderSetup["environment"];
  readonly isDefault: boolean;
  readonly capabilities: ShippingProviderSetup["capabilities"];
  readonly services: ShippingProviderSetup["services"];
  readonly bookingRequirements = {
    serviceCode: true,
    administrativeCodes: false,
    dimensions: true,
    lineAllocations: true,
    declaredValue: true,
    feePayer: true,
    inspectionPolicy: true,
  } as const;

  constructor(private readonly setup: ShippingProviderSetup, _http: HttpClient) {
    this.id = setup.id;
    this.code = setup.providerCode;
    this.name = setup.name;
    this.status = setup.status;
    this.environment = setup.environment;
    this.isDefault = setup.isDefault;
    this.capabilities = setup.capabilities;
    this.services = setup.services.filter((service) => service.enabled);
  }

  supportsMode(mode: ShippingTransportMode): boolean {
    return this.services.some((service) => service.supportedModes.includes(mode));
  }

  async getQuotes(_input: Parameters<NonNullable<ShippingProvider["getQuotes"]>>[0]): Promise<ShippingQuote[]> {
    return Promise.reject(this.contractBlocked("quotes"));
  }

  async createBooking(_input: Parameters<ShippingProvider["createBooking"]>[0]): Promise<CreateShippingBookingResult> {
    return Promise.reject(this.contractBlocked("create-booking"));
  }

  async cancelBooking(_input: Parameters<NonNullable<ShippingProvider["cancelBooking"]>>[0]): Promise<void> {
    return Promise.reject(this.contractBlocked("cancel-booking"));
  }

  async getBooking(_externalBookingId: string): Promise<ExternalShippingSnapshot> {
    return Promise.reject(this.contractBlocked("get-booking"));
  }

  async syncBooking(_externalBookingId: string): Promise<ExternalShippingSnapshot> {
    return Promise.reject(this.contractBlocked("sync-booking"));
  }

  private contractBlocked(operation: string): Error {
    return new Error(`CONTRACT_OPERATION_BLOCKED:DEC-SHIPPING-PROVIDER-${operation.toUpperCase()}: provider ${this.id}`);
  }
}
