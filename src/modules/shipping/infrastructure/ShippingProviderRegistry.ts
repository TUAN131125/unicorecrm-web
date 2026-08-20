import type { ShippingProviderRegistry as ShippingProviderRegistryPort } from "../application/ports/ShippingProviderRegistry";
import type { ShippingProvider } from "../domain/model/shippingProvider";

export class ShippingProviderRegistry implements ShippingProviderRegistryPort {
  private readonly resolveProviders: () => ShippingProvider[];

  constructor(providers: ShippingProvider[] | (() => ShippingProvider[])) {
    this.resolveProviders = typeof providers === "function" ? providers : () => providers;
  }

  private all(): ShippingProvider[] {
    return this.resolveProviders();
  }

  get(providerId: string): ShippingProvider | undefined {
    return this.all().find((provider) => provider.id === providerId);
  }

  list(): ShippingProvider[] {
    return this.all()
      .filter((provider) => provider.status === "ACTIVE" && provider.capabilities?.booking !== false)
      .sort((left, right) => Number(Boolean(right.isDefault)) - Number(Boolean(left.isDefault)) || left.name.localeCompare(right.name));
  }
}
