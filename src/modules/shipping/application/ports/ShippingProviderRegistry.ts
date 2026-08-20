import type { ShippingProvider } from "../../domain/model/shippingProvider";
export interface ShippingProviderRegistry {
  get(providerId: string): ShippingProvider | undefined;
  list(): ShippingProvider[];
  /** Connected read-model projection only. */
  replace?(providers: ShippingProvider[]): void;
}
