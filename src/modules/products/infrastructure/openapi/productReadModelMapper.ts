import type { ProductDocument } from "@/platform/api/generated/commercialApi";
import { decimalToDisplayNumber, moneyToDisplayNumber } from "@/shared/money";
import type { Product, ProductStatus } from "../../domain/model/product.types";

const PRODUCT_STATUS: Record<ProductDocument["status"], ProductStatus> = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  DRAFT: "draft",
  ARCHIVED: "archived",
};

export function mapProductDocumentToApplication(dto: ProductDocument): Product {
  return {
    id: dto.id,
    sku: dto.sku,
    name: dto.name,
    type: dto.type,
    status: PRODUCT_STATUS[dto.status],
    category: dto.category,
    description: dto.description,
    unit: dto.unit,
    listPrice: moneyToDisplayNumber(dto.unitPrice),
    unitPrice: dto.unitPrice,
    currency: dto.unitPrice.currency,
    taxRate: decimalToDisplayNumber(dto.taxRate),
    taxMode: dto.taxMode,
    billingCycle: dto.billingCycle,
    costPrice: dto.costPrice === undefined ? undefined : moneyToDisplayNumber(dto.costPrice),
    costPriceMoney: dto.costPrice,
    marginPercent: dto.marginPercent === undefined ? undefined : decimalToDisplayNumber(dto.marginPercent),
    isSubscription: dto.isSubscription,
    isRenewable: dto.isRenewable,
    warrantyMonths: dto.warrantyMonths,
    defaultContractMonths: dto.defaultContractMonths,
    tags: [...dto.tags],
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    archivedAt: dto.archivedAt,
    archiveReason: dto.archiveReason,
    resourceVersion: dto.version,
  };
}
