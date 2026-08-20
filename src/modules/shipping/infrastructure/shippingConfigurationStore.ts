import { BrowserStorageAdapter } from "@/platform/persistence";
import { getWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { WorkspaceScopedStorageAdapter } from "@/platform/workspace-scope";
import type { PickupLocationConfiguration, ShippingProviderCapabilities, ShippingProviderSetup, ShippingServiceConfig } from "../domain/model/shippingConfiguration.types";

const PROVIDER_KEY = "provider-configurations";
const storage = new BrowserStorageAdapter();

const defaultCapabilities: ShippingProviderCapabilities = {
  quote: false,
  booking: true,
  cancel: true,
  sync: true,
  label: true,
  tracking: true,
  cod: true,
  returnPickup: true,
};

const defaultServices: ShippingServiceConfig[] = [
  { code: "standard", name: "Tiêu chuẩn", enabled: true, supportedModes: ["DOMESTIC"], supportsCod: true, estimatedDays: 3 },
  { code: "express", name: "Chuyển phát nhanh", enabled: true, supportedModes: ["DOMESTIC"], supportsCod: true, estimatedDays: 1 },
  { code: "economy", name: "Tiết kiệm", enabled: true, supportedModes: ["DOMESTIC"], supportsCod: true, estimatedDays: 5 },
  { code: "intl_express", name: "Quốc tế nhanh", enabled: true, supportedModes: ["INTERNATIONAL"], supportsCod: false, estimatedDays: 5 },
  { code: "intl_economy", name: "Quốc tế tiết kiệm", enabled: true, supportedModes: ["INTERNATIONAL"], supportsCod: false, estimatedDays: 10 },
  { code: "instant_now", name: "Giao ngay", enabled: true, supportedModes: ["INSTANT"], supportsCod: true, estimatedDays: 0 },
  { code: "instant_slot", name: "Giao theo khung giờ", enabled: true, supportedModes: ["INSTANT"], supportsCod: true, estimatedDays: 0 },
];

type StoredShippingProviderSetup = Partial<ShippingProviderSetup> & Pick<ShippingProviderSetup, "id" | "providerCode" | "name">;

const providerSeed: ShippingProviderSetup[] = [{
  id: "manual",
  providerCode: "manual",
  name: "Manual Shipping Provider",
  status: "ACTIVE",
  isDefault: true,
  environment: "SANDBOX",
  capabilities: defaultCapabilities,
  services: defaultServices,
  retryPolicy: { maxAttempts: 3, backoffSeconds: 30 },
  labelTemplate: "DEFAULT_A6",
  packingSlipTemplate: "DEFAULT_PACKING_SLIP",
}];

function workspaceStorage(): WorkspaceScopedStorageAdapter {
  return new WorkspaceScopedStorageAdapter(storage, getWorkspaceContextSnapshot().workspaceId, "shipping-configuration");
}

function normalizeProvider(provider: StoredShippingProviderSetup): ShippingProviderSetup {
  return {
    id: provider.id,
    providerCode: provider.providerCode,
    name: provider.name,
    credentialReference: provider.credentialReference,
    status: provider.status ?? "PAUSED",
    isDefault: Boolean(provider.isDefault),
    environment: provider.environment ?? "SANDBOX",
    capabilities: { ...defaultCapabilities, ...provider.capabilities },
    services: (provider.services?.length ? provider.services : defaultServices).map((service) => ({ ...service, supportedModes: [...service.supportedModes] })),
    retryPolicy: provider.retryPolicy ?? { maxAttempts: 3, backoffSeconds: 30 },
    trackingMapping: provider.trackingMapping,
    webhookReference: provider.webhookReference,
    labelTemplate: provider.labelTemplate ?? "DEFAULT_A6",
    packingSlipTemplate: provider.packingSlipTemplate ?? "DEFAULT_PACKING_SLIP",
  };
}

const projectWorkspaceAddresses = (purpose: "PICKUP" | "RETURN"): PickupLocationConfiguration[] => getWorkspaceOperationalConfiguration().addresses
  .filter((address) => address.active && address.purposes.includes(purpose))
  .map((address, index) => ({
    addressId: address.id,
    id: address.id,
    name: address.name,
    contactName: address.contactName,
    phone: address.contactPhone,
    addressLine: [address.addressLine1, address.addressLine2].filter(Boolean).join(", "),
    city: address.provinceCode,
    isDefault: index === 0,
    isActive: address.active,
  }));

export const getPickupLocations = (): PickupLocationConfiguration[] => projectWorkspaceAddresses("PICKUP");
export const getReturnLocations = (): PickupLocationConfiguration[] => projectWorkspaceAddresses("RETURN");

export const getShippingProviderConfigurations = (): ShippingProviderSetup[] => {
  const stored = workspaceStorage().get<StoredShippingProviderSetup[]>(PROVIDER_KEY) ?? providerSeed;
  return stored.map(normalizeProvider);
};

export const saveShippingProviderConfigurations = (providers: ShippingProviderSetup[]): ShippingProviderSetup[] => {
  const normalized = providers.map(normalizeProvider);
  const defaultId = normalized.find((item) => item.isDefault && item.status === "ACTIVE" && item.capabilities.booking)?.id
    ?? normalized.find((item) => item.status === "ACTIVE" && item.capabilities.booking)?.id;
  const next = normalized.map((item) => ({ ...item, isDefault: item.id === defaultId }));
  workspaceStorage().set(PROVIDER_KEY, next);
  return next;
};

export const getDefaultShippingProviderConfiguration = (): ShippingProviderSetup | undefined =>
  getShippingProviderConfigurations().find((provider) => provider.isDefault && provider.status === "ACTIVE" && provider.capabilities.booking);
