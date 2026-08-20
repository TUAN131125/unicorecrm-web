import { Product, ProductType, ProductStatus, BillingCycle, TaxMode, ProductConfiguration } from "../model/product.types";

/** Formats product pricing with the ISO 4217 minor unit resolved by Intl. */
export function formatProductPrice(price: number, currency: string, locale: string = "vi"): string {
  try {
    const formatted = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
      style: "currency",
      currency,
    }).format(price);
    return formatted;
  } catch (err) {
    return `${price.toLocaleString()} ${currency}`;
  }
}

/**
 * Returns translated label for the billing cycle
 */
export function formatBillingCycle(cycle: BillingCycle, tx: (k: string, fallback: string) => string): string {
  switch (cycle) {
    case "one_time":
      return tx("products.billingCycle.one_time", "Một lần");
    case "monthly":
      return tx("products.billingCycle.monthly", "Hàng tháng");
    case "quarterly":
      return tx("products.billingCycle.quarterly", "Hàng quý");
    case "yearly":
      return tx("products.billingCycle.yearly", "Hàng năm");
    default:
      return cycle;
  }
}

/**
 * Calculates tax amount for a product list price based on taxMode and taxRate
 */
export function calculateProductTaxAmount(price: number, taxRate: number, taxMode: TaxMode): number {
  if (!taxRate || taxRate <= 0 || taxMode === "none") return 0;
  
  if (taxMode === "inclusive") {
    // price = priceWithoutTax * (1 + rate/100)
    // priceWithoutTax = price / (1 + rate/100)
    // tax = price - priceWithoutTax
    const base = price / (1 + taxRate / 100);
    return price - base;
  } else {
    // exclusive
    return price * (taxRate / 100);
  }
}

/**
 * Calculates grand total price including tax
 */
export function calculateProductTotal(price: number, taxRate: number, taxMode: TaxMode): number {
  if (taxMode === "exclusive") {
    return price + calculateProductTaxAmount(price, taxRate, taxMode);
  }
  return price; // inclusive or none has total equals the list price
}

/**
 * Calculates product profit margin percentage
 */
export function calculateProductMarginPercent(listPrice: number, costPrice?: number): number {
  if (listPrice <= 0 || costPrice === undefined || costPrice < 0) return 100;
  const margin = listPrice - costPrice;
  return Math.round((margin / listPrice) * 1000) / 10;
}

/**
 * Translates product type status
 */
export function getProductTypeLabel(type: ProductType, tx: (k: string, fallback: string) => string): string {
  switch (type) {
    case "physical_product":
      return tx("products.types.physical_product", "Sản phẩm vật lý");
    case "service":
      return tx("products.types.service", "Dịch vụ");
    case "subscription":
      return tx("products.products.types.subscription", "Thuê bao phần mềm (SaaS)"); // Compatible with general saas sub
    case "package":
      return tx("products.types.package", "Gói Combo sản phẩm");
    case "implementation":
      return tx("products.types.implementation", "Triển khai lắp đặt");
    case "support_sla":
      return tx("products.types.support_sla", "Dịch vụ hỗ trợ & SLA");
    case "addon":
      return tx("products.types.addon", "Tiện ích bổ sung");
    default:
      return type;
  }
}

/**
 * Translates product status
 */
export function getProductStatusLabel(status: ProductStatus, tx: (k: string, fallback: string) => string): string {
  switch (status) {
    case "active":
      return tx("products.status.active", "Đang hoạt động");
    case "inactive":
      return tx("products.status.inactive", "Ngừng kinh doanh");
    case "draft":
      return tx("products.status.draft", "Bản nháp");
    case "archived":
      return tx("products.status.archived", "Đã lưu trữ");
    default:
      return status;
  }
}

/**
 * Checks if a product is selectable (active & non-archived etc.)
 */
export function getProductSelectableState(product: Product): boolean {
  return product.status === "active";
}

/**
 * Filters standard product array according to criteria
 */
export function filterProducts(
  products: Product[],
  filters: {
    search?: string;
    type?: string;
    status?: string;
    category?: string;
    billingCycle?: string;
    minPrice?: number;
    maxPrice?: number;
    tag?: string;
  }
): Product[] {
  return products.filter((prod) => {
    // Search matching
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      const skuMatch = prod.sku?.toLowerCase().includes(q);
      const nameMatch = prod.name?.toLowerCase().includes(q);
      const catMatch = prod.category?.toLowerCase().includes(q);
      const descMatch = prod.description?.toLowerCase().includes(q);
      const tagsMatch = prod.tags?.some((t) => t.toLowerCase().includes(q));
      
      if (!skuMatch && !nameMatch && !catMatch && !descMatch && !tagsMatch) {
         return false;
      }
    }

    // Type filter
    if (filters.type && filters.type !== "all") {
      if (prod.type !== filters.type) return false;
    }

    // Status filter
    if (filters.status && filters.status !== "all") {
      if (prod.status !== filters.status) return false;
    }

    // Category filter
    if (filters.category && filters.category !== "all") {
      if (prod.category !== filters.category) return false;
    }

    // Billing cycle filter
    if (filters.billingCycle && filters.billingCycle !== "all") {
      if (prod.billingCycle !== filters.billingCycle) return false;
    }

    // Price range filters
    if (filters.minPrice !== undefined && prod.listPrice < filters.minPrice) return false;
    if (filters.maxPrice !== undefined && prod.listPrice > filters.maxPrice) return false;

    // Tag filter
    if (filters.tag && filters.tag !== "all") {
      if (!prod.tags?.includes(filters.tag)) return false;
    }

    return true;
  });
}

/**
 * Sorts products list
 */
export function sortProducts(
  products: Product[],
  sortBy: string,
  sortOrder: "asc" | "desc"
): Product[] {
  const sorted = [...products];
  const order = sortOrder === "asc" ? 1 : -1;

  sorted.sort((a, b) => {
    switch (sortBy) {
      case "sku":
        return a.sku.localeCompare(b.sku) * order;
      case "name":
        return a.name.localeCompare(b.name) * order;
      case "type":
        return a.type.localeCompare(b.type) * order;
      case "category":
        return a.category.localeCompare(b.category) * order;
      case "listPrice":
        return (a.listPrice - b.listPrice) * order;
      case "updatedAt":
        return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * order;
      default:
        // default by createdAt newer first
        return (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  });

  return sorted;
}

export interface ProductValidationError {
  field: string;
  message: string;
}

/**
 * Validates product details prior to CRUD saving
 */
export function validateProductForm(
  data: Partial<Product>,
  existingProducts: Product[],
  isEditing: boolean,
  tx: (k: string, fallback: string) => string
): ProductValidationError[] {
  const errors: ProductValidationError[] = [];

  // SKU checks 
  if (!data.sku || !data.sku.trim()) {
    errors.push({ field: "sku", message: tx("products.validation.skuRequired", "Mã SKU bắt buộc thiết lập.") });
  } else {
    const skuClean = data.sku.trim().toUpperCase();
    const isDup = existingProducts.some((p) => p.sku.toUpperCase() === skuClean && (!isEditing || p.id !== data.id));
    if (isDup) {
      errors.push({ field: "sku", message: tx("products.validation.skuDup", "Mã SKU đã tồn tại trong danh mục.") });
    }
  }

  // Name check
  if (!data.name || !data.name.trim()) {
    errors.push({ field: "name", message: tx("products.validation.nameRequired", "Tên sản phẩm/dịch vụ bắt buộc nhập.") });
  }

  // List pricing validations
  if (data.listPrice === undefined || data.listPrice < 0) {
    errors.push({ field: "listPrice", message: tx("products.validation.priceMin", "Đơn giá danh sách phải lớn hơn hoặc bằng 0.") });
  }

  // Tax Rate checks
  if (data.taxRate !== undefined && (data.taxRate < 0 || data.taxRate > 100)) {
    errors.push({ field: "taxRate", message: tx("products.validation.taxRange", "Tỷ lệ thuế VAT phải từ 0% đến 100%.") });
  }

  // Contract limitations
  if (data.warrantyMonths !== undefined && data.warrantyMonths < 0) {
    errors.push({ field: "warrantyMonths", message: tx("products.validation.warrantyNegative", "Thời hạn bảo hành không được âm.") });
  }

  if (data.defaultContractMonths !== undefined && data.defaultContractMonths < 0) {
    errors.push({ field: "defaultContractMonths", message: tx("products.validation.contractNegative", "Thời hạn hợp đồng tối thiểu không được âm.") });
  }

  return errors;
}

/**
 * Calculates the configured price based on Product type and ProductConfiguration
 */
export function calculateConfiguredPrice(product: Product, config?: ProductConfiguration): number {
  if (!config) return product.listPrice;

  const basePrice = product.listPrice;

  if (product.type === "subscription" || product.isSubscription || product.type === "license") {
    // SaaS: Select billing frequency (Monthly/Quarterly/Annual), user licenses (qty), add-ons (Support SLA, Training days).
    const freq = config.billingFrequency || "monthly";
    let multiplier = 1;
    if (freq === "quarterly") multiplier = 2.8; // discounted quarterly
    if (freq === "yearly") multiplier = 10; // buy 10 months, get 12 months

    const licenses = config.userLicenses || 1;
    let addOns = 0;
    if (config.supportSla) addOns += 5000000; // SLA VIP Support fee
    if (config.trainingDays) addOns += (config.trainingDays * 2000000); // 2M VND per training day

    return (basePrice * multiplier * licenses) + addOns;
  }

  if (product.type === "physical_product") {
    // Physical Product: Select quantities, custom warranty package (standard list/prices), shipping option (Air/Express/Sea).
    let warrantyFee = 0;
    if (config.warrantyPackage === "silver") warrantyFee = 1000000;
    if (config.warrantyPackage === "gold") warrantyFee = 2500000;
    if (config.warrantyPackage === "platinum") warrantyFee = 5000000;

    let shippingFee = 0;
    if (config.shippingOption === "sea") shippingFee = 50000;
    if (config.shippingOption === "express") shippingFee = 200000;
    if (config.shippingOption === "air") shippingFee = 500000;

    return basePrice + warrantyFee + shippingFee;
  }

  if (product.type === "service" || product.type === "implementation" || product.type === "maintenance" || product.type === "support_sla") {
    // Professional Services: Man-days, consultant seniority (Junior/Senior/Principal with different rates), and travel/expense inclusion flag.
    const days = config.manDays || 1;
    let seniorityRate = 1.0;
    if (config.consultantSeniority === "senior") seniorityRate = 1.8;
    if (config.consultantSeniority === "principal") seniorityRate = 2.5;

    let teFee = 0;
    if (config.travelExpenseIncluded) teFee = 1500000; // flat 1.5M VND

    return (basePrice * seniorityRate * days) + teFee;
  }

  return basePrice;
}

/**
 * Returns a detailed snapshot/description summarizing the exact product configuration
 */
export function getConfiguredSnapshotDescription(product: Product, config?: ProductConfiguration, locale: string = "vi"): string {
  if (!config) return "";

  const parts: string[] = [];

  if (product.type === "subscription" || product.isSubscription || product.type === "license") {
    const freqLabel = config.billingFrequency === "yearly" ? "Hàng năm" : config.billingFrequency === "quarterly" ? "Hàng quý" : "Hàng tháng";
    parts.push(`Chu kỳ: ${freqLabel}`);
    parts.push(`Số lượng license: ${config.userLicenses || 1} users`);
    if (config.supportSla) parts.push("Kèm hỗ trợ SLA VIP (+5M)");
    if (config.trainingDays) parts.push(`Đào tạo kỹ thuật: ${config.trainingDays} ngày (+${(config.trainingDays * 2).toLocaleString()}M)`);
  } else if (product.type === "physical_product") {
    if (config.warrantyPackage && config.warrantyPackage !== "standard") {
      const wLabel = config.warrantyPackage === "silver" ? "Bạc VIP (+1M)" : config.warrantyPackage === "gold" ? "Vàng VIP (+2.5M)" : "Bạch kim VIP (+5M)";
      parts.push(`Gói bảo hành: ${wLabel}`);
    }
    if (config.shippingOption) {
      const sLabel = config.shippingOption === "air" ? "Hàng không (+500k)" : config.shippingOption === "express" ? "Hỏa tốc (+200k)" : "Đường biển (+50k)";
      parts.push(`Vận chuyển: ${sLabel}`);
    }
  } else {
    parts.push(`Công tác: ${config.manDays || 1} ngày-công`);
    const senLabel = config.consultantSeniority === "senior" ? "Trực tiếp Senior (x1.8)" : config.consultantSeniority === "principal" ? "Trực tiếp Principal (x2.5)" : "Trực tiếp Junior (x1.0)";
    parts.push(`Cấp bậc tư vấn: ${senLabel}`);
    if (config.travelExpenseIncluded) parts.push("Bao gồm chi phí đi lại (+1.5M)");
  }

  return parts.join(", ");
}
