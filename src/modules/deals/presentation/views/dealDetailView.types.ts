import type { getProductCatalogSnapshot } from "@/modules/products";
import type { useDealDetailController } from "../hooks/useDealDetailController";

export type DealDetailController = NonNullable<ReturnType<typeof useDealDetailController>>;
export type DealDetailProductCatalog = ReturnType<typeof getProductCatalogSnapshot>;
