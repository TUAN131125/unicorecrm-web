import { createWorkspaceScopedRepository } from "@/platform/workspace-scope/createWorkspaceScopedRepository";
import { InMemoryShippingRepository } from "../infrastructure/InMemoryShippingRepository";
import { ShippingProviderRegistry } from "../infrastructure/ShippingProviderRegistry";
import { ConfiguredShippingProvider } from "../infrastructure/providers/ConfiguredShippingProvider";
import { getShippingProviderConfigurationsRuntime } from "./shippingConfigurationRuntime";
import { SHIPPING_SEED } from "../infrastructure/shipping.seed";

export const shippingRepository = createWorkspaceScopedRepository({
  resourceKey: "shipping",
  createRepository: () => new InMemoryShippingRepository(structuredClone(SHIPPING_SEED)),
});

export const shippingProviderRegistry = new ShippingProviderRegistry(() =>
  getShippingProviderConfigurationsRuntime().map((configuration) => new ConfiguredShippingProvider(configuration)),
);
