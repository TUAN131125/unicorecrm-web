import {
  getPickupLocations,
  getReturnLocations,
  getShippingProviderConfigurations,
  saveShippingProviderConfigurations,
} from "../infrastructure/shippingConfigurationStore";
import type { PickupLocationConfiguration, ShippingProviderSetup } from "../domain/model/shippingConfiguration.types";

export const getPickupLocationsRuntime = (): PickupLocationConfiguration[] => getPickupLocations();
export const getReturnLocationsRuntime = (): PickupLocationConfiguration[] => getReturnLocations();
export const getShippingProviderConfigurationsRuntime = (): ShippingProviderSetup[] => getShippingProviderConfigurations();
export const saveShippingProviderConfigurationsRuntime = (providers: ShippingProviderSetup[]): ShippingProviderSetup[] => saveShippingProviderConfigurations(providers);
