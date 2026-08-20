import type { Product } from "../../domain/model/product.types";

export interface ProductCatalogExporter {
  exportJson(products: readonly Product[]): void;
  exportCsv(products: readonly Product[]): void;
}
