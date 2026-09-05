import type { AuthoritativePage, ModuleListQuery } from "@/shared/application";
import type { MoneyDto } from "@/shared/money";
import type { Product } from "../../domain/model/product.types";

export type ProductApiRuntimeMode = "demo" | "connected" | "test";
export interface ProductListQuery extends ModuleListQuery {}
export interface ProductDraftInput { sku: string; name: string; type: Product["type"]; status: Exclude<Product["status"], "archived">; category: string; description?: string; unit: string; unitPrice: MoneyDto; costPriceMoney?: MoneyDto; taxRate: number | string; taxMode: Product["taxMode"]; billingCycle: Product["billingCycle"]; isSubscription: boolean; isRenewable: boolean; warrantyMonths?: number; defaultContractMonths?: number; tags: readonly string[]; }
export interface ProductAvailability { productId: string; sellable: boolean; status: "AVAILABLE" | "UNAVAILABLE" | "ARCHIVED" | "INACTIVE" | "DRAFT"; blockerCodes: readonly string[]; resourceVersion: number; evaluatedAt: string; }
export interface ProductPriceProjection { productId: string; quantity: string; unitPrice: MoneyDto; subtotal: MoneyDto; taxAmount: MoneyDto; total: MoneyDto; pricingVersion: string; evaluatedAt: string; }
export interface ProductCommandOptions { idempotencyKey: string; correlationId?: string; signal?: AbortSignal; }
export interface ProductVersionedCommandOptions extends ProductCommandOptions { expectedVersion: number; }
export interface ProductMutationEvidence { authority: "backend" | "demo" | "test"; commandId: string; correlationId: string; aggregateId: string; aggregateType: string; version: number; occurredAt: string; outcome: "COMMITTED" | "REPLAYED" | "DEMO_COMMITTED"; warnings: readonly string[]; emittedEventIds: readonly string[]; auditEvidenceIds: readonly string[]; }
export interface ProductMutationResult { product: Product; evidence: ProductMutationEvidence; }
export interface ProductBatchMutationResult { products: readonly Product[]; evidence: ProductMutationEvidence; }
export interface ProductVersionItem { productId: string; expectedVersion: number; }
export interface ProductQueryPort { list(query?: ProductListQuery, signal?: AbortSignal): Promise<AuthoritativePage<Product>>; get(productId: string, signal?: AbortSignal): Promise<Product>; getAvailability(productId: string, expectedVersion: number, signal?: AbortSignal): Promise<ProductAvailability>; getPriceProjection(productId: string, quantity: string, expectedVersion: number, signal?: AbortSignal): Promise<ProductPriceProjection>; }
export interface ProductCommandPort { create(input: ProductDraftInput, options: ProductCommandOptions): Promise<ProductMutationResult>; replace(productId: string, input: ProductDraftInput, options: ProductVersionedCommandOptions): Promise<ProductMutationResult>; archive(productId: string, reason: string, options: ProductVersionedCommandOptions): Promise<ProductMutationResult>; archiveBatch(items: readonly ProductVersionItem[], reason: string, options: ProductCommandOptions): Promise<ProductBatchMutationResult>; restore(productId: string, options: ProductVersionedCommandOptions): Promise<ProductMutationResult>; restoreBatch(items: readonly ProductVersionItem[], options: ProductCommandOptions): Promise<ProductBatchMutationResult>; }
export interface ProductApiRuntime { mode: ProductApiRuntimeMode; queries: ProductQueryPort; commands: ProductCommandPort; }
