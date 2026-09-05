import type { CommercialApiClient, ProductAvailabilityReadModel, ProductBatchMutationResponse, ProductList, ProductMutationResponse, ProductPriceProjectionReadModel } from "@/platform/api/generated/commercialApi";
import type { AuthoritativePage } from "@/shared/application";
import type { ProductApiRuntime, ProductBatchMutationResult, ProductCommandOptions, ProductDraftInput, ProductListQuery, ProductMutationResult, ProductVersionedCommandOptions, ProductQueryPort, ProductCommandPort } from "../../application/ports/ProductApiRuntime";
import type { Product } from "../../domain/model/product.types";
import { mapProductDocumentToApplication } from "../openapi/productReadModelMapper";
import { mapArchiveProductsBatch, mapProductBatchMutation, mapProductDraft, mapProductMutation, mapRestoreProductsBatch } from "./ProductApiMapper";
export class ProductHttpApiAdapter implements ProductQueryPort, ProductCommandPort {
  constructor(private readonly api: CommercialApiClient) {}
  async list(_query: ProductListQuery = {}, signal?: AbortSignal): Promise<AuthoritativePage<Product>> { const records = await this.api.listProducts<ProductList>({}, signal); return { items: records.map(mapProductDocumentToApplication), pageInfo: { hasNextPage: false, totalCount: records.length }, loadedAt: new Date().toISOString(), authority: "backend" }; }
  async get(productId: string, signal?: AbortSignal): Promise<Product> { return mapProductDocumentToApplication(await this.api.getProduct(productId, {}, signal)); }
  getAvailability(productId: string, expectedVersion: number, signal?: AbortSignal) { return this.api.getProductAvailability<ProductAvailabilityReadModel>(productId, {}, { expectedVersion, signal }); }
  getPriceProjection(productId: string, quantity: string, expectedVersion: number, signal?: AbortSignal) { return this.api.getProductPriceProjection<ProductPriceProjectionReadModel>(productId, { quantity }, { expectedVersion, signal }); }
  async create(input: ProductDraftInput, options: ProductCommandOptions): Promise<ProductMutationResult> { return mapProductMutation(await this.api.createProduct<ProductMutationResponse>(mapProductDraft(input), options)); }
  async replace(productId: string, input: ProductDraftInput, options: ProductVersionedCommandOptions): Promise<ProductMutationResult> { return mapProductMutation(await this.api.replaceProduct<ProductMutationResponse>(productId, mapProductDraft(input), options)); }
  async archive(productId: string, reason: string, options: ProductVersionedCommandOptions): Promise<ProductMutationResult> { return mapProductMutation(await this.api.archiveProduct<ProductMutationResponse>(productId, { reason: reason.trim() }, options)); }
  async archiveBatch(items: readonly { productId: string; expectedVersion: number }[], reason: string, options: ProductCommandOptions): Promise<ProductBatchMutationResult> { return mapProductBatchMutation(await this.api.archiveProductsBatch<ProductBatchMutationResponse>(mapArchiveProductsBatch(items, reason), options)); }
  async restore(productId: string, options: ProductVersionedCommandOptions): Promise<ProductMutationResult> { return mapProductMutation(await this.api.restoreProduct<ProductMutationResponse>(productId, {}, options)); }
  async restoreBatch(items: readonly { productId: string; expectedVersion: number }[], options: ProductCommandOptions): Promise<ProductBatchMutationResult> { return mapProductBatchMutation(await this.api.restoreProductsBatch<ProductBatchMutationResponse>(mapRestoreProductsBatch(items), options)); }
}
