import type { Product, ProductStatus } from "../../domain/model/product.types";
import { CAPABILITIES, assertRuntimeCommandAccess, assertRuntimeCapability } from "@/platform/access-control";
import { assertDestructiveActionAllowed } from "@/shared/application";

export interface SaveProductResult {
  products: Product[];
  product: Product;
  mode: "created" | "updated";
}

export function saveProduct(
  products: readonly Product[],
  data: Partial<Product>,
  activeProduct: Product | null,
  now = new Date().toISOString(),
): SaveProductResult {
  if (activeProduct?.id) {
    assertRuntimeCommandAccess(CAPABILITIES.PRODUCTS_UPDATE, "products", activeProduct);
    const updatedProduct = {
      ...activeProduct,
      ...data,
      id: activeProduct.id,
      updatedAt: now,
    } as Product;

    return {
      mode: "updated",
      product: updatedProduct,
      products: products.map((product) => product.id === activeProduct.id ? updatedProduct : product),
    };
  }

  assertRuntimeCapability(CAPABILITIES.PRODUCTS_CREATE);
  const createdProduct = {
    ...data,
    id: `prod_${Math.random().toString(36).substring(2, 9)}`,
    createdAt: now,
    updatedAt: now,
  } as Product;

  return {
    mode: "created",
    product: createdProduct,
    products: [createdProduct, ...products],
  };
}

export function createProductDuplicateDraft(products: readonly Product[], source: Product): Product {
  assertRuntimeCommandAccess(CAPABILITIES.PRODUCTS_CREATE, "products", source);
  let sku = `${source.sku}_COPY`;
  let index = 1;

  while (products.some((product) => product.sku === sku)) {
    sku = `${source.sku}_COPY${index}`;
    index += 1;
  }

  return {
    ...source,
    id: undefined as unknown as string,
    sku,
    name: `${source.name} (Copy)`,
    status: "draft",
  };
}

export function toggleProductArchived(
  products: readonly Product[],
  productId: string,
  now = new Date().toISOString(),
): { products: Product[]; status: ProductStatus } {
  const target = products.find((product) => product.id === productId);
  assertRuntimeCommandAccess(CAPABILITIES.PRODUCTS_UPDATE, "products", target);
  const status: ProductStatus = target?.status === "archived" ? "active" : "archived";

  return {
    status,
    products: products.map((product) =>
      product.id === productId ? { ...product, status, updatedAt: now } : product,
    ),
  };
}

export function setProductsStatus(
  products: readonly Product[],
  productIds: readonly string[],
  status: ProductStatus,
  now = new Date().toISOString(),
): Product[] {
  assertRuntimeCapability(CAPABILITIES.PRODUCTS_UPDATE);
  const ids = new Set(productIds);
  return products.map((product) =>
    ids.has(product.id) ? { ...product, status, updatedAt: now } : product,
  );
}

export interface ProductRetentionCommandInput {
  reason: string;
  actorId: string;
  actorName: string;
  now?: string;
}

export function archiveProducts(
  products: readonly Product[],
  productIds: readonly string[],
  input: ProductRetentionCommandInput,
): Product[] {
  assertRuntimeCapability(CAPABILITIES.PRODUCTS_UPDATE);
  assertDestructiveActionAllowed({
    recordType: "Product",
    retentionClass: "MASTER",
    action: "ARCHIVE",
    reason: input.reason,
  });
  const ids = new Set(productIds);
  const now = input.now ?? new Date().toISOString();
  return products.map((product) => ids.has(product.id) ? {
    ...product,
    status: "archived",
    archivedAt: product.archivedAt ?? now,
    archiveReason: input.reason.trim(),
    updatedAt: now,
  } : product);
}

export function restoreProducts(
  products: readonly Product[],
  productIds: readonly string[],
  now = new Date().toISOString(),
): Product[] {
  assertRuntimeCapability(CAPABILITIES.PRODUCTS_UPDATE);
  const ids = new Set(productIds);
  return products.map((product) => ids.has(product.id) ? {
    ...product,
    status: "active",
    archivedAt: undefined,
    archiveReason: undefined,
    updatedAt: now,
  } : product);
}
