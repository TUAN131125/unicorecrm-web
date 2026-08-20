import { BrowserEventBus } from "@/platform/events";
import { BrowserStorageAdapter } from "@/platform/persistence";
import { PreferenceStore } from "@/platform/preferences";
import { createWorkspaceScopedRepository } from "@/platform/workspace-scope/createWorkspaceScopedRepository";
import { WorkspaceScopedStorageAdapter } from "@/platform/workspace-scope/WorkspaceScopedStorageAdapter";
import { LocalProductRepository } from "../infrastructure/LocalProductRepository";
import { BrowserProductCatalogExporter } from "../infrastructure/BrowserProductCatalogExporter";
import { PRODUCT_DEMO_SEED } from "../infrastructure/dev-memory/productDemoSeed";

const storage = new BrowserStorageAdapter();
const events = new BrowserEventBus();

export const productRepository = createWorkspaceScopedRepository({
  resourceKey: "products",
  // The catalog is workspace reference data. Record-level owner projection can
  // otherwise hide every product from Sales roles because products have no owner.
  authorizeReads: false,
  createRepository: (workspaceId) => new LocalProductRepository(
    new WorkspaceScopedStorageAdapter(storage, workspaceId, "products"),
    events,
  ),
});
export const productCatalogExporter = new BrowserProductCatalogExporter();
export const productPreferences = new PreferenceStore(storage, "");


export function resetProductRepositoryToDemo() {
  const products = structuredClone([...PRODUCT_DEMO_SEED]);
  productRepository.replace(products);
  return products;
}
