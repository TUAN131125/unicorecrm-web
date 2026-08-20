import type { AppEventBus } from "@/platform/events";
import type { StoragePort } from "@/platform/persistence";
import type { ProductRepository } from "../application/ports/ProductRepository";
import type { Product } from "../domain/model/product.types";
import { PRODUCT_DEMO_SEED } from "./dev-memory/productDemoSeed";

export const PRODUCT_CATALOG_STORAGE_KEY = "centrix_product_catalog";
export const PRODUCT_CATALOG_CHANGED_EVENT = "centrix_product_catalog_changed";

export class LocalProductRepository implements ProductRepository {
  constructor(
    private readonly storage: StoragePort,
    private readonly events: AppEventBus,
  ) {}

  list(): Product[] {
    return this.storage.get<Product[]>(PRODUCT_CATALOG_STORAGE_KEY) ?? PRODUCT_DEMO_SEED;
  }

  replace(products: Product[]): void {
    this.storage.set(PRODUCT_CATALOG_STORAGE_KEY, products);
    this.events.publish<Product[]>(PRODUCT_CATALOG_CHANGED_EVENT, products);
  }

  subscribe(listener: (products: Product[]) => void): () => void {
    const unsubscribeEvent = this.events.subscribe<Product[] | undefined>(PRODUCT_CATALOG_CHANGED_EVENT, (payload) => {
      listener(payload ?? this.list());
    });

    if (typeof window === "undefined") return unsubscribeEvent;

    const handleStorage = (event: StorageEvent) => {
      const isCatalogKey = event.key === PRODUCT_CATALOG_STORAGE_KEY
        || event.key?.endsWith(`:${PRODUCT_CATALOG_STORAGE_KEY}`);
      if (isCatalogKey) listener(this.list());
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      unsubscribeEvent();
      window.removeEventListener("storage", handleStorage);
    };
  }
}
