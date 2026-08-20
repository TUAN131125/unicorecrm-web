import type { PickupLocationConfiguration, ShippingProviderSetup } from "../../domain/model/shippingConfiguration.types";

export interface ShippingConfigurationPort {
  getPickupLocations(): PickupLocationConfiguration[];
  getReturnLocations(): PickupLocationConfiguration[];
  getProviders(): ShippingProviderSetup[];
  saveProviders(providers: ShippingProviderSetup[]): ShippingProviderSetup[];
  /** Connected read-model projection only. */
  replaceLocations?(pickup: PickupLocationConfiguration[], returns: PickupLocationConfiguration[]): void;
}
