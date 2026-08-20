import { createApplicationServiceBinding } from "@/shared/application";
import type { ShippingApiRuntime } from "../ports/ShippingApiRuntime";
import type { ShippingConfigurationPort } from "../ports/ShippingConfigurationPort";
import type { ShippingProviderRegistry } from "../ports/ShippingProviderRegistry";
import type { ShippingRepository } from "../ports/ShippingRepository";

export interface ShippingApplicationServices {
  repository: ShippingRepository;
  providers: ShippingProviderRegistry;
  configuration: ShippingConfigurationPort;
  api: ShippingApiRuntime;
}

const binding = createApplicationServiceBinding<ShippingApplicationServices>("Shipping");
export const configureShippingApplication = binding.configure;
export const getShippingApplicationServices = binding.get;
export const resetShippingApplication = binding.reset;

import { createApplicationServiceProxy } from "@/shared/application";
export const shippingRepository = createApplicationServiceProxy(() => binding.get().repository);
export const shippingProviderRegistry = createApplicationServiceProxy(() => binding.get().providers);
export const getShippingApiRuntime = (): ShippingApiRuntime => binding.get().api;
export const getPickupLocations = () => binding.get().configuration.getPickupLocations();
export const getReturnLocations = () => binding.get().configuration.getReturnLocations();
export const getShippingProviderConfigurations = () => binding.get().configuration.getProviders();
export const saveShippingProviderConfigurations = (providers: Parameters<ShippingConfigurationPort["saveProviders"]>[0]) => binding.get().configuration.saveProviders(providers);
