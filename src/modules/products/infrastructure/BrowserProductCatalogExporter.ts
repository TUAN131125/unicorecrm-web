import type { ProductCatalogExporter } from "../application/ports/ProductCatalogExporter";
import { serializeProductsAsCsv, serializeProductsAsJson } from "../application/import-export/productCsv";
import type { Product } from "../domain/model/product.types";

export class BrowserProductCatalogExporter implements ProductCatalogExporter {
  exportJson(products: readonly Product[]): void {
    this.download(
      serializeProductsAsJson(products),
      "application/json;charset=utf-8",
      `product-catalog-${Date.now()}.json`,
    );
  }

  exportCsv(products: readonly Product[]): void {
    this.download(
      serializeProductsAsCsv(products),
      "text/csv;charset=utf-8",
      `product-catalog-${Date.now()}.csv`,
    );
  }

  private download(content: string, mimeType: string, fileName: string): void {
    if (typeof document === "undefined") return;
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }
}
