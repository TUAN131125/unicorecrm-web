import { createMutationMetadata, isBusinessOperationUnavailable, MutationCommandError, runBackendProjection, type MutationCommandMetadata, type MutationOutcome } from "@/shared/application";
import type { ProductAvailability, ProductDraftInput, ProductMutationEvidence, ProductPriceProjection } from "../application/ports/ProductApiRuntime";
import type { Product } from "../domain/model/product.types";
import { getProductApiRuntime, isProductConnectedApiRuntime, productCatalogExporter, productPreferences, productRepository, resetProductRepositoryToDemo } from "../application/composition/productApplicationServices";

export function getProductCatalogSnapshot(): Product[] { return productRepository.list(); }
export function replaceProductCatalog(products: Product[]): void { productRepository.replace(products); }
export type ProductRetentionMutationMetadata = Partial<MutationCommandMetadata>;

export async function loadProductDetail(productId: string, signal?: AbortSignal): Promise<Product> {
  const product = await getProductApiRuntime().queries.get(productId, signal);
  projectProduct(product);
  return product;
}

export function loadProductAvailability(product: Product, signal?: AbortSignal): Promise<ProductAvailability> {
  return getProductApiRuntime().queries.getAvailability(
    product.id,
    requireVersion(product.id, "availability projection"),
    signal,
  );
}

export function loadProductPriceProjection(
  product: Product,
  quantity: string,
  signal?: AbortSignal,
): Promise<ProductPriceProjection> {
  return getProductApiRuntime().queries.getPriceProjection(
    product.id,
    quantity,
    requireVersion(product.id, "price projection"),
    signal,
  );
}

export async function saveProductCommand(product: Product, metadata: ProductRetentionMutationMetadata = {}): Promise<MutationOutcome<Product>> {
  const current = product.id ? productRepository.list().find((item) => item.id === product.id) : undefined;
  const commandType = current ? "product.replace" : "product.create";
  const commandMetadata = createMutationMetadata(`${commandType}:${product.id || product.sku}`, metadata);
  const result = current
    ? await getProductApiRuntime().commands.replace(current.id, toDraftInput(product), versionedOptions(current, commandMetadata, "replace"))
    : await getProductApiRuntime().commands.create(toDraftInput(product), commandOptions(commandMetadata));
  projectProduct(result.product);
  return productOutcome(commandType, commandMetadata, result.product, result.evidence);
}

export async function archiveProductsCommand(productIds: readonly string[], input: { reason: string; actorId: string; actorName: string; now?: string }, metadata: ProductRetentionMutationMetadata = {}): Promise<MutationOutcome<Product[]>> {
  const items = productIds.map((productId) => ({ productId, expectedVersion: requireVersion(productId, "archive") }));
  const aggregateId = [...productIds].sort().join(",");
  const commandMetadata = createMutationMetadata(`product.archive-many:${aggregateId}`, { ...metadata, actor: metadata.actor ?? { id: input.actorId, name: input.actorName } });
  const singleItem = items.length === 1 ? items[0] : undefined;
  const result = singleItem
    ? await getProductApiRuntime().commands.archive(singleItem.productId, input.reason, versionedOptions(requireProduct(singleItem.productId), commandMetadata, "archive"))
    : await getProductApiRuntime().commands.archiveBatch(items, input.reason, commandOptions(commandMetadata));
  const products = "products" in result ? [...result.products] : [result.product];
  projectProducts(products);
  return productBatchOutcome("product.archive-many", commandMetadata, products, result.evidence);
}

export async function restoreProductsCommand(productIds: readonly string[], input: { actorId: string; actorName: string; now?: string }, metadata: ProductRetentionMutationMetadata = {}): Promise<MutationOutcome<Product[]>> {
  const items = productIds.map((productId) => ({ productId, expectedVersion: requireVersion(productId, "restore") }));
  const aggregateId = [...productIds].sort().join(",");
  const commandMetadata = createMutationMetadata(`product.restore-many:${aggregateId}`, { ...metadata, actor: metadata.actor ?? { id: input.actorId, name: input.actorName } });
  const singleItem = items.length === 1 ? items[0] : undefined;
  const result = singleItem
    ? await getProductApiRuntime().commands.restore(singleItem.productId, versionedOptions(requireProduct(singleItem.productId), commandMetadata, "restore"))
    : await getProductApiRuntime().commands.restoreBatch(items, commandOptions(commandMetadata));
  const products = "products" in result ? [...result.products] : [result.product];
  projectProducts(products);
  return productBatchOutcome("product.restore-many", commandMetadata, products, result.evidence);
}

export function subscribeToProductCatalog(listener: (products: Product[]) => void): () => void { return productRepository.subscribe(listener); }
export function assertProductCatalogImportAvailable(): void { assertDemoOnly("importProductCatalog"); }
/**
 * True when the demo catalog reset cannot run in the active runtime. Connected mode binds
 * the catalog reset to an unavailable operation because no backend reset contract exists.
 */
export function isProductDemoCatalogResetUnavailable(): boolean { return isBusinessOperationUnavailable("Product demo catalog reset"); }
export function resetProductCatalogToDemo(): Product[] { assertDemoOnly("resetProductCatalogToDemo"); return resetProductRepositoryToDemo(); }
export function exportProductCatalogJson(products: readonly Product[]): void { assertDemoOnly("exportProductCatalogJson"); productCatalogExporter.exportJson(products); }
export function exportProductCatalogCsv(products: readonly Product[]): void { assertDemoOnly("exportProductCatalogCsv"); productCatalogExporter.exportCsv(products); }
export function getProductPreference<T>(key: string, fallback: T): T { return productPreferences.get(key, fallback); }
export function setProductPreference<T>(key: string, value: T): void { productPreferences.set(key, value); }
export function removeProductPreference(key: string): void { productPreferences.remove(key); }

function toDraftInput(product: Product): ProductDraftInput { const currency = (product.unitPrice?.currency || product.currency || "VND").toUpperCase(); return { sku: product.sku, name: product.name, type: product.type, status: product.status === "archived" ? "inactive" : product.status, category: product.category, description: product.description, unit: product.unit, unitPrice: product.unitPrice ?? { amount: String(product.listPrice), currency }, costPriceMoney: product.costPriceMoney ?? (product.costPrice === undefined ? undefined : { amount: String(product.costPrice), currency }), taxRate: product.taxRate, taxMode: product.taxMode, billingCycle: product.billingCycle, isSubscription: product.isSubscription, isRenewable: product.isRenewable, warrantyMonths: product.warrantyMonths, defaultContractMonths: product.defaultContractMonths, tags: product.tags }; }
function projectProduct(product: Product): void { runBackendProjection("products", () => { const current = productRepository.list(); productRepository.replace(current.some((item) => item.id === product.id) ? current.map((item) => item.id === product.id ? structuredClone(product) : item) : [structuredClone(product), ...current]); }); }
function projectProducts(products: readonly Product[]): void { for (const product of products) projectProduct(product); }
function requireProduct(id: string): Product { const product = productRepository.list().find((item) => item.id === id); if (!product) throw new MutationCommandError({ code: "RESOURCE_NOT_FOUND", message: `Product ${id} was not found.`, category: "NOT_FOUND", retryable: false }); return product; }
function requireVersion(id: string, operation: string): number { const value = requireProduct(id).resourceVersion; if (typeof value === "number" && value > 0) return value; if (!isProductConnectedApiRuntime()) return 1; throw new MutationCommandError({ code: "PRODUCT_RESOURCE_VERSION_REQUIRED", message: `Product ${id} requires an authoritative resource version for ${operation}.`, category: "CONFLICT", retryable: false }); }
function commandOptions(metadata: MutationCommandMetadata) { return { idempotencyKey: metadata.idempotencyKey, correlationId: metadata.correlationId, signal: metadata.signal }; }
function versionedOptions(product: Product, metadata: MutationCommandMetadata, operation: string) { return { ...commandOptions(metadata), expectedVersion: requireVersion(product.id, operation) }; }
function productOutcome(commandType: string, metadata: MutationCommandMetadata, product: Product, evidence: ProductMutationEvidence): MutationOutcome<Product> { return { data: product, commandId: evidence.commandId, commandType, aggregateType: evidence.aggregateType, aggregateId: evidence.aggregateId, idempotencyKey: metadata.idempotencyKey, correlationId: evidence.correlationId, occurredAt: evidence.occurredAt, version: evidence.version, outcome: evidence.outcome, warnings: [...evidence.warnings], emittedEvents: [...evidence.emittedEventIds], audit: { authority: evidence.authority === "backend" ? "backend" : "demo", evidenceIds: [...evidence.auditEvidenceIds] } }; }
function productBatchOutcome(commandType: string, metadata: MutationCommandMetadata, products: readonly Product[], evidence: ProductMutationEvidence): MutationOutcome<Product[]> { return { ...productOutcome(commandType, metadata, products[0] ?? ({ id: evidence.aggregateId } as Product), evidence), data: [...products], aggregateType: "product-batch" }; }
function assertDemoOnly(operation: string): void { if (!isProductConnectedApiRuntime()) return; throw new MutationCommandError({ code: "PRODUCT_CONNECTED_OPERATION_REQUIRES_BACKEND_CONTRACT", message: `Connected Product operation ${operation} is unavailable until a backend export/import/reset contract exists.`, category: "INFRASTRUCTURE", retryable: false, details: { operation } }); }
