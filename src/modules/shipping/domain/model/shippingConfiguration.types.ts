export interface PickupLocationConfiguration {
  addressId: string;
  id: string;
  name: string;
  contactName: string;
  phone: string;
  addressLine: string;
  city: string;
  isDefault: boolean;
  isActive: boolean;
}

export type ShippingProviderStatus = "ACTIVE" | "PAUSED" | "DISABLED";
export type ShippingProviderEnvironment = "SANDBOX" | "PRODUCTION";

export interface ShippingProviderCapabilities {
  quote: boolean;
  booking: boolean;
  cancel: boolean;
  sync: boolean;
  label: boolean;
  tracking: boolean;
  cod: boolean;
  returnPickup: boolean;
}

export interface ShippingServiceConfig {
  code: string;
  name: string;
  enabled: boolean;
  supportedModes: Array<"DOMESTIC" | "INTERNATIONAL" | "INSTANT">;
  supportsCod: boolean;
  maxCodAmount?: number;
  maxWeightGrams?: number;
  supportedRegions?: string[];
  estimatedDays?: number;
}

export interface ShippingProviderSetup {
  id: string;
  providerCode: string;
  name: string;
  credentialReference?: string;
  status: ShippingProviderStatus;
  isDefault: boolean;
  environment: ShippingProviderEnvironment;
  capabilities: ShippingProviderCapabilities;
  services: ShippingServiceConfig[];
  retryPolicy: { maxAttempts: number; backoffSeconds: number };
  trackingMapping?: Record<string, string>;
  webhookReference?: string;
  labelTemplate?: string;
  packingSlipTemplate?: string;
}
