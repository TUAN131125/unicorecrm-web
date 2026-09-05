import type { AuthoritativePage } from "@/shared/application";
import { archiveProducts, restoreProducts, saveProduct } from "../application/commands/productCatalogCommands";
import type {
  ProductApiRuntime,
  ProductCommandOptions,
  ProductDraftInput,
  ProductMutationEvidence,
  ProductMutationResult,
} from "../application/ports/ProductApiRuntime";
import type { ProductRepository } from "../application/ports/ProductRepository";
import type { Product } from "../domain/model/product.types";

export function createProductDemoApiRuntime(repository: ProductRepository): ProductApiRuntime {
  return {
    mode: "demo",
    queries: {
      async list(): Promise<AuthoritativePage<Product>> {
        const items = repository.list().filter((item) => !item.archivedAt);
        return {
          items,
          pageInfo: { hasNextPage: false, totalCount: items.length },
          loadedAt: new Date().toISOString(),
          authority: "demo",
        };
      },
      async get(productId) {
        return requireProduct(repository, productId);
      },
      async getAvailability(productId, _expectedVersion) {
        const product = requireProduct(repository, productId);
        const sellable = product.status === "active";
        return {
          productId,
          sellable,
          status: product.status === "archived"
            ? "ARCHIVED"
            : product.status === "inactive"
              ? "INACTIVE"
              : product.status === "draft"
                ? "DRAFT"
                : sellable ? "AVAILABLE" : "UNAVAILABLE",
          blockerCodes: sellable ? [] : [`PRODUCT_${product.status.toUpperCase()}`],
          resourceVersion: version(product),
          evaluatedAt: new Date().toISOString(),
        };
      },
      async getPriceProjection(productId, quantity, _expectedVersion) {
        const product = requireProduct(repository, productId);
        const qty = Number(quantity);
        const unit = Number(product.unitPrice?.amount ?? product.listPrice);
        const subtotal = qty * unit;
        const tax = product.taxMode === "exclusive" ? subtotal * (product.taxRate / 100) : 0;
        const currency = product.currency || product.unitPrice?.currency || "VND";
        return {
          productId,
          quantity: String(qty),
          unitPrice: { amount: String(unit), currency },
          subtotal: { amount: String(subtotal), currency },
          taxAmount: { amount: String(tax), currency },
          total: { amount: String(subtotal + tax), currency },
          pricingVersion: "demo-product-pricing/v1",
          evaluatedAt: new Date().toISOString(),
        };
      },
    },
    commands: {
      async create(input, options) {
        const saved = saveProduct(repository.list(), toPartial(input), null);
        repository.replace(saved.products);
        return result(saved.product, options);
      },
      async replace(productId, input, options) {
        const current = requireVersion(repository, productId, options.expectedVersion);
        const saved = saveProduct(repository.list(), toPartial(input), current);
        const product = { ...saved.product, resourceVersion: options.expectedVersion + 1 };
        repository.replace(saved.products.map((item) => item.id === product.id ? product : item));
        return result(product, options);
      },
      async archive(productId, reason, options) {
        requireVersion(repository, productId, options.expectedVersion);
        const products = archiveProducts(repository.list(), [productId], {
          reason,
          actorId: "demo-user",
          actorName: "Demo User",
        }).map((item) => item.id === productId
          ? { ...item, resourceVersion: options.expectedVersion + 1 }
          : item);
        repository.replace(products);
        return result(requireProduct(repository, productId), options);
      },
      async archiveBatch(items, reason, options) {
        for (const item of items) requireVersion(repository, item.productId, item.expectedVersion);
        let products = archiveProducts(repository.list(), items.map((item) => item.productId), {
          reason,
          actorId: "demo-user",
          actorName: "Demo User",
        });
        products = applyBatchVersions(products, items);
        repository.replace(products);
        return batchResult(repository, items, options);
      },
      async restore(productId, options) {
        requireVersion(repository, productId, options.expectedVersion);
        const products = restoreProducts(repository.list(), [productId]).map((item) => item.id === productId
          ? { ...item, resourceVersion: options.expectedVersion + 1 }
          : item);
        repository.replace(products);
        return result(requireProduct(repository, productId), options);
      },
      async restoreBatch(items, options) {
        for (const item of items) requireVersion(repository, item.productId, item.expectedVersion);
        let products = restoreProducts(repository.list(), items.map((item) => item.productId));
        products = applyBatchVersions(products, items);
        repository.replace(products);
        return batchResult(repository, items, options);
      },
    },
  };
}

function applyBatchVersions(
  products: readonly Product[],
  items: readonly { productId: string; expectedVersion: number }[],
): Product[] {
  return products.map((product) => {
    const target = items.find((item) => item.productId === product.id);
    return target ? { ...product, resourceVersion: target.expectedVersion + 1 } : product;
  });
}

function batchResult(
  repository: ProductRepository,
  items: readonly { productId: string; expectedVersion: number }[],
  options: ProductCommandOptions,
) {
  return {
    products: items.map((item) => requireProduct(repository, item.productId)),
    evidence: evidence(
      `products:${items.map((item) => item.productId).join(",")}`,
      Math.max(1, ...items.map((item) => item.expectedVersion + 1)),
      options,
    ),
  };
}

function toPartial(input: ProductDraftInput): Partial<Product> {
  return {
    ...input,
    listPrice: Number(input.unitPrice.amount),
    currency: input.unitPrice.currency,
    costPrice: input.costPriceMoney ? Number(input.costPriceMoney.amount) : undefined,
    taxRate: Number(input.taxRate),
    tags: [...input.tags],
  };
}

function requireProduct(repository: ProductRepository, id: string): Product {
  const item = repository.list().find((record) => record.id === id);
  if (!item) throw new Error(`PRODUCT_NOT_FOUND:${id}`);
  return item;
}

function version(product: Product): number {
  return product.resourceVersion ?? 1;
}

function requireVersion(repository: ProductRepository, id: string, expected: number): Product {
  const item = requireProduct(repository, id);
  if (version(item) !== expected) throw new Error(`PRODUCT_VERSION_CONFLICT:${id}`);
  return item;
}

function result(product: Product, options: ProductCommandOptions): ProductMutationResult {
  return { product, evidence: evidence(product.id, version(product), options) };
}

function evidence(
  id: string,
  versionValue: number,
  options: ProductCommandOptions,
): ProductMutationEvidence {
  const occurredAt = new Date().toISOString();
  return {
    authority: "demo",
    commandId: options.idempotencyKey,
    correlationId: options.correlationId ?? options.idempotencyKey,
    aggregateId: id,
    aggregateType: "product",
    version: versionValue,
    occurredAt,
    outcome: "DEMO_COMMITTED",
    warnings: [],
    emittedEventIds: [],
    auditEvidenceIds: [],
  };
}
