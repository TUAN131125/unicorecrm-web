import type { ArchiveProductsBatchRequest, CreateProductRequest, ProductBatchMutationResponse, ProductMutationResponse, ReplaceProductRequest, RestoreProductsBatchRequest } from "@/platform/api/generated/commercialApi";
import { normalizeDecimal } from "@/shared/money";
import type { ProductBatchMutationResult, ProductDraftInput, ProductMutationEvidence, ProductMutationResult, ProductVersionItem } from "../../application/ports/ProductApiRuntime";
import { mapProductDocumentToApplication } from "../openapi/productReadModelMapper";

export function mapProductDraft(input: ProductDraftInput): CreateProductRequest | ReplaceProductRequest {
  const unitPrice = input.unitPrice;
  return compact({ sku: input.sku.trim(), name: input.name.trim(), type: input.type, status: input.status.toUpperCase(), category: input.category.trim(), description: input.description?.trim(), unit: input.unit.trim(), unitPrice: { amount: normalizeDecimal(unitPrice.amount), currency: unitPrice.currency.toUpperCase() }, costPrice: input.costPriceMoney ? { amount: normalizeDecimal(input.costPriceMoney.amount), currency: input.costPriceMoney.currency.toUpperCase() } : undefined, taxRate: normalizeDecimal(String(input.taxRate)), taxMode: input.taxMode, billingCycle: input.billingCycle, isSubscription: input.isSubscription, isRenewable: input.isRenewable, warrantyMonths: input.warrantyMonths, defaultContractMonths: input.defaultContractMonths, tags: [...input.tags] }) as CreateProductRequest;
}
export function mapProductVersions(items: readonly ProductVersionItem[]): Array<{ productId: string; expectedVersion: number }> { return items.map((item) => ({ productId: item.productId, expectedVersion: item.expectedVersion })); }
export function mapArchiveProductsBatch(items: readonly ProductVersionItem[], reason: string): ArchiveProductsBatchRequest { return { items: mapProductVersions(items), reason: reason.trim() }; }
export function mapRestoreProductsBatch(items: readonly ProductVersionItem[]): RestoreProductsBatchRequest { return { items: mapProductVersions(items) }; }
export function mapProductMutation(response: ProductMutationResponse): ProductMutationResult { return { product: mapProductDocumentToApplication(response.result.product), evidence: mapEvidence(response) }; }
export function mapProductBatchMutation(response: ProductBatchMutationResponse): ProductBatchMutationResult { return { products: response.result.products.map(mapProductDocumentToApplication), evidence: mapEvidence(response) }; }
function mapEvidence(response: ProductMutationResponse | ProductBatchMutationResponse): ProductMutationEvidence { return { authority: "backend", commandId: response.commandId, correlationId: response.correlationId, aggregateId: response.aggregateId, aggregateType: response.aggregateType, version: response.version, occurredAt: response.occurredAt, outcome: response.outcome, warnings: response.warnings ?? [], emittedEventIds: response.emittedEventIds ?? [], auditEvidenceIds: response.auditEvidenceIds ?? [] }; }
function compact<T extends Record<string, unknown>>(value: T): T { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T; }
