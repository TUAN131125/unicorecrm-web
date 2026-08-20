import { ProductType, BillingCycle, TaxMode } from "../model/product.types";

export interface LifecycleConfig {
  canBeQuoted: boolean;
  canBeSold: boolean;
  canBeRenewed: boolean;
  hasWarranty: boolean;
  hasSLA: boolean;
  hasSubscriptionPeriod: boolean;
  requiresStartDate: boolean;
  requiresEndDate: boolean;
  createsCustomerOwnedProduct: boolean;
  createsRenewalOpportunity: boolean;
}

export interface CustomFieldDefinition {
  name: string;
  label: string;
  type: "text" | "number" | "boolean" | "select";
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface ProductTypeConfig {
  type: ProductType;
  label: string;
  lifecycle: LifecycleConfig;
  customFields: CustomFieldDefinition[];
}

export const PRODUCT_TYPES: ProductType[] = [
  "physical_product",
  "service",
  "subscription",
  "package",
  "implementation",
  "support_sla",
  "addon",
  "license",
  "maintenance"
];

export const PRODUCT_CATEGORIES = [
  "Software License",
  "Professional Services",
  "Support SLA",
  "Marketing Plugins",
  "Analytics Tools",
  "Hardware",
  "Training",
  "Maintenance & Repair"
];

export const PRODUCT_UNITS = [
  "item",
  "user",
  "seat",
  "license",
  "hour",
  "day",
  "month",
  "year",
  "project",
  "package"
];

export const BILLING_CYCLES: BillingCycle[] = [
  "one_time",
  "monthly",
  "quarterly",
  "yearly",
  "custom"
];

export const TAX_MODES: TaxMode[] = [
  "exclusive",
  "inclusive",
  "none"
];

export const PRODUCT_TYPE_CONFIGS: Record<ProductType, ProductTypeConfig> = {
  physical_product: {
    type: "physical_product",
    label: "Sản phẩm vật lý",
    lifecycle: {
      canBeQuoted: true,
      canBeSold: true,
      canBeRenewed: false,
      hasWarranty: true,
      hasSLA: false,
      hasSubscriptionPeriod: false,
      requiresStartDate: false,
      requiresEndDate: false,
      createsCustomerOwnedProduct: true,
      createsRenewalOpportunity: false
    },
    customFields: [
      { name: "serialRequired", label: "Yêu cầu số Serial", type: "boolean", required: false },
      { name: "warrantyMonths", label: "Số tháng bảo hành", type: "number", required: true, placeholder: "12" },
      { name: "inventoryTracking", label: "Theo dõi kho hàng", type: "boolean", required: false }
    ]
  },
  service: {
    type: "service",
    label: "Dịch vụ chuyên nghiệp",
    lifecycle: {
      canBeQuoted: true,
      canBeSold: true,
      canBeRenewed: false,
      hasWarranty: false,
      hasSLA: false,
      hasSubscriptionPeriod: false,
      requiresStartDate: true,
      requiresEndDate: true,
      createsCustomerOwnedProduct: false,
      createsRenewalOpportunity: false
    },
    customFields: [
      { name: "estimatedDeliveryDays", label: "Số ngày bàn giao dự kiến", type: "number", required: false },
      { name: "projectScope", label: "Phạm vi dự án (Scope)", type: "text", required: false }
    ]
  },
  subscription: {
    type: "subscription",
    label: "Thuê bao phần mềm (SaaS)",
    lifecycle: {
      canBeQuoted: true,
      canBeSold: true,
      canBeRenewed: true,
      hasWarranty: false,
      hasSLA: false,
      hasSubscriptionPeriod: true,
      requiresStartDate: true,
      requiresEndDate: true,
      createsCustomerOwnedProduct: true,
      createsRenewalOpportunity: true
    },
    customFields: [
      { name: "billingCycle", label: "Chu kỳ thanh toán", type: "select", required: true, options: ["monthly", "quarterly", "yearly", "custom"] },
      { name: "seats", label: "Số lượng Seat/User", type: "number", required: true, placeholder: "1" },
      { name: "renewalNoticeDays", label: "Số ngày báo trước gia hạn", type: "number", required: false, placeholder: "30" }
    ]
  },
  package: {
    type: "package",
    label: "Gói Combo sản phẩm",
    lifecycle: {
      canBeQuoted: true,
      canBeSold: true,
      canBeRenewed: false,
      hasWarranty: true,
      hasSLA: false,
      hasSubscriptionPeriod: false,
      requiresStartDate: false,
      requiresEndDate: false,
      createsCustomerOwnedProduct: true,
      createsRenewalOpportunity: false
    },
    customFields: [
      { name: "bundleItems", label: "Các sản phẩm trong gói", type: "text", required: false, placeholder: "Mô tả sản phẩm đi kèm..." }
    ]
  },
  implementation: {
    type: "implementation",
    label: "Triển khai lắp đặt",
    lifecycle: {
      canBeQuoted: true,
      canBeSold: true,
      canBeRenewed: false,
      hasWarranty: true,
      hasSLA: false,
      hasSubscriptionPeriod: false,
      requiresStartDate: true,
      requiresEndDate: true,
      createsCustomerOwnedProduct: false,
      createsRenewalOpportunity: false
    },
    customFields: [
      { name: "estimatedDeliveryDays", label: "Số ngày lắp đặt dự kiến", type: "number", required: true, placeholder: "5" },
      { name: "projectScope", label: "Mô tả phạm vi lắp đặt", type: "text", required: false }
    ]
  },
  support_sla: {
    type: "support_sla",
    label: "Dịch vụ hỗ trợ & SLA",
    lifecycle: {
      canBeQuoted: true,
      canBeSold: true,
      canBeRenewed: true,
      hasWarranty: false,
      hasSLA: true,
      hasSubscriptionPeriod: true,
      requiresStartDate: true,
      requiresEndDate: true,
      createsCustomerOwnedProduct: true,
      createsRenewalOpportunity: true
    },
    customFields: [
      { name: "slaLevel", label: "Cấp độ SLA", type: "select", required: true, options: ["Bronze", "Silver", "Gold", "Platinum"] },
      { name: "responseTimeHours", label: "Thời gian phản hồi (Giờ)", type: "number", required: true, placeholder: "2" },
      { name: "supportHours", label: "Khung giờ hỗ trợ", type: "text", required: false, placeholder: "24/7 hoặc 8/5..." }
    ]
  },
  addon: {
    type: "addon",
    label: "Tiện ích bổ sung",
    lifecycle: {
      canBeQuoted: true,
      canBeSold: true,
      canBeRenewed: true,
      hasWarranty: false,
      hasSLA: false,
      hasSubscriptionPeriod: true,
      requiresStartDate: true,
      requiresEndDate: true,
      createsCustomerOwnedProduct: true,
      createsRenewalOpportunity: true
    },
    customFields: [
      { name: "addonType", label: "Loại Add-on", type: "text", required: false }
    ]
  },
  license: {
    type: "license",
    label: "Bản quyền phần mềm (On-premise)",
    lifecycle: {
      canBeQuoted: true,
      canBeSold: true,
      canBeRenewed: true,
      hasWarranty: true,
      hasSLA: false,
      hasSubscriptionPeriod: false,
      requiresStartDate: false,
      requiresEndDate: false,
      createsCustomerOwnedProduct: true,
      createsRenewalOpportunity: true
    },
    customFields: [
      { name: "licenseKeys", label: "Số lượng License Key", type: "number", required: true, placeholder: "1" },
      { name: "renewalNoticeDays", label: "Báo trước gia hạn (Ngày)", type: "number", required: false, placeholder: "30" }
    ]
  },
  maintenance: {
    type: "maintenance",
    label: "Bảo trì định kỳ",
    lifecycle: {
      canBeQuoted: true,
      canBeSold: true,
      canBeRenewed: true,
      hasWarranty: false,
      hasSLA: false,
      hasSubscriptionPeriod: true,
      requiresStartDate: true,
      requiresEndDate: true,
      createsCustomerOwnedProduct: true,
      createsRenewalOpportunity: true
    },
    customFields: [
      { name: "maintenanceInterval", label: "Chu kỳ bảo trì", type: "select", required: true, options: ["monthly", "quarterly", "yearly"] }
    ]
  }
};

export function getProductLifecycle(type: ProductType): LifecycleConfig {
  return PRODUCT_TYPE_CONFIGS[type]?.lifecycle || {
    canBeQuoted: true,
    canBeSold: true,
    canBeRenewed: false,
    hasWarranty: false,
    hasSLA: false,
    hasSubscriptionPeriod: false,
    requiresStartDate: false,
    requiresEndDate: false,
    createsCustomerOwnedProduct: false,
    createsRenewalOpportunity: false
  };
}
