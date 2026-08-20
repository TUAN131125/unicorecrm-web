import type { Product } from "../../domain/model/product.types";

export interface ProductListFilters {
  type: string;
  status: string;
  category: string;
  billingCycle: string;
  tag: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface ProductCatalogStats {
  totalCount: number;
  activeRecurring: number;
  activeOneTime: number;
  draftAndArchived: number;
}

export function getProductCategories(products: readonly Product[]): string[] {
  return Array.from(new Set(products.map((product) => product.category).filter(Boolean))) as string[];
}

export function getProductTags(products: readonly Product[]): string[] {
  return Array.from(new Set(products.flatMap((product) => product.tags ?? [])));
}

export function queryProducts(
  products: readonly Product[],
  searchTerm: string,
  filters: ProductListFilters,
  sortField: string,
  sortOrder: "asc" | "desc",
): Product[] {
  const query = searchTerm.trim().toLowerCase();
  const order = sortOrder === "asc" ? 1 : -1;

  return products
    .filter((product) => {
      if (query) {
        const matches =
          product.sku.toLowerCase().includes(query) ||
          product.name.toLowerCase().includes(query) ||
          product.description?.toLowerCase().includes(query) ||
          product.tags?.some((tag) => tag.toLowerCase().includes(query));
        if (!matches) return false;
      }

      if (filters.status !== "all" && product.status !== filters.status) return false;
      if (filters.type !== "all" && product.type !== filters.type) return false;
      if (filters.category !== "all" && product.category !== filters.category) return false;
      if (filters.billingCycle !== "all" && product.billingCycle !== filters.billingCycle) return false;
      if (filters.tag !== "all" && !product.tags?.includes(filters.tag)) return false;
      if (filters.minPrice !== undefined && product.listPrice < filters.minPrice) return false;
      if (filters.maxPrice !== undefined && product.listPrice > filters.maxPrice) return false;
      return true;
    })
    .sort((left, right) => {
      const compareText = (a: string, b: string) => a.localeCompare(b) * order;
      const compareNumber = (a: number, b: number) => (a - b) * order;

      switch (sortField) {
        case "sku":
          return compareText(left.sku, right.sku);
        case "name":
          return compareText(left.name, right.name);
        case "type":
          return compareText(left.type, right.type);
        case "category":
          return compareText(left.category, right.category);
        case "listPrice":
          return compareNumber(left.listPrice, right.listPrice);
        case "updatedAt":
          return compareNumber(new Date(left.updatedAt).getTime(), new Date(right.updatedAt).getTime());
        default:
          return compareNumber(new Date(right.createdAt).getTime(), new Date(left.createdAt).getTime());
      }
    });
}

export function getProductCatalogStats(products: readonly Product[]): ProductCatalogStats {
  return {
    totalCount: products.length,
    activeRecurring: products.filter((product) => product.status === "active" && product.isSubscription).length,
    activeOneTime: products.filter((product) => product.status === "active" && !product.isSubscription).length,
    draftAndArchived: products.filter((product) => product.status === "draft" || product.status === "archived").length,
  };
}
