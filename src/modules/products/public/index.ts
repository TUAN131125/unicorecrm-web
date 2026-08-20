export * from "./catalog";
export * from "./configuration";

export type { ProductRepository } from "../application/ports/ProductRepository";

export { getProductCatalogStats, getProductCategories, getProductTags, queryProducts } from "../application/queries/productCatalogQueries";

export { getProductUsageSummary } from "../application/usage/productUsage";

export { calculateTaxAmount } from "../domain/rules/productPricing";

export type * from "../domain/model/product.types";

export { getProductLifecycle } from "../domain/rules/product.config";

export { ProductPickerModal } from "../presentation/components/ProductPickerModal";

export type { SelectedPickerItem } from "../presentation/components/ProductPickerModal";
