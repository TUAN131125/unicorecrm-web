import type { CreateShippingBookingResult, ExternalShippingSnapshot, ShippingBooking, ShippingQuote, ShippingTransportMode } from "./shipping.types";
import type { ShippingProviderCapabilities, ShippingProviderEnvironment, ShippingProviderStatus, ShippingServiceConfig } from "./shippingConfiguration.types";

export interface ShippingBookingRequirements {
  serviceCode?: boolean;
  administrativeCodes?: boolean;
  dimensions?: boolean;
  lineAllocations?: boolean;
  declaredValue?: boolean;
  feePayer?: boolean;
  inspectionPolicy?: boolean;
}

export interface ShippingQuoteInput { booking: Pick<ShippingBooking, "sourceType" | "sourceId" | "purpose" | "pickupLocationSnapshot" | "recipientSnapshot" | "packageSnapshot" | "codAmount">; }
export interface CreateShippingBookingInput { booking: ShippingBooking; }
export interface CancelShippingBookingInput { booking: ShippingBooking; reason: string; }

export interface ShippingProvider {
  readonly id: string;
  readonly code?: string;
  readonly name: string;
  readonly status?: ShippingProviderStatus;
  readonly environment?: ShippingProviderEnvironment;
  readonly isDefault?: boolean;
  readonly capabilities?: ShippingProviderCapabilities;
  readonly services?: ShippingServiceConfig[];
  readonly bookingRequirements?: ShippingBookingRequirements;
  supportsMode?(mode: ShippingTransportMode): boolean;
  getQuotes?(input: ShippingQuoteInput): Promise<ShippingQuote[]>;
  createBooking(input: CreateShippingBookingInput): Promise<CreateShippingBookingResult>;
  cancelBooking?(input: CancelShippingBookingInput): Promise<void>;
  getBooking?(externalBookingId: string): Promise<ExternalShippingSnapshot>;
  syncBooking?(externalBookingId: string): Promise<ExternalShippingSnapshot>;
}
