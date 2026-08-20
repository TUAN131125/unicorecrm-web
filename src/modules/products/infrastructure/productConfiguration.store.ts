import type { Product } from "../domain/model/product.types";
import { BrowserStorageAdapter, type StoragePort } from "@/platform/persistence";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { WorkspaceScopedStorageAdapter } from "@/platform/workspace-scope/WorkspaceScopedStorageAdapter";

import type { ConfiguredProductField, ConfiguredProductType } from "../domain/model/productConfiguration.types";

export const DEFAULT_PRODUCT_TYPES: ConfiguredProductType[] = [
  {
    id: "type_physical_product",
    code: "physical_product",
    displayNameEn: "Physical Product",
    displayNameVi: "Sản phẩm vật lý",
    descriptionEn: "Physical goods bought, warehoused, and packaged.",
    descriptionVi: "Hàng hóa vật lý, có lưu kho vận chuyển.",
    status: "active",
    canBeQuoted: true,
    canBeSold: true,
    createsOwnedProduct: true,
    hasWarranty: true,
    hasSLA: false,
    hasSubscriptionPeriod: false,
    canBeRenewed: false,
    requiresStartDate: false,
    requiresEndDate: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "type_service",
    code: "service",
    displayNameEn: "Professional Service",
    displayNameVi: "Dịch vụ chuyên nghiệp",
    descriptionEn: "Time-and-material consulting or project milestones.",
    descriptionVi: "Dịch vụ tư vấn theo ngày công hoặc tiến độ.",
    status: "active",
    canBeQuoted: true,
    canBeSold: true,
    createsOwnedProduct: false,
    hasWarranty: false,
    hasSLA: false,
    hasSubscriptionPeriod: false,
    canBeRenewed: false,
    requiresStartDate: true,
    requiresEndDate: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "type_subscription",
    code: "subscription",
    displayNameEn: "SaaS Subscription",
    displayNameVi: "Thuê bao phần mềm (SaaS)",
    descriptionEn: "Cloud-hosted subscription models with recurring bills.",
    descriptionVi: "Dịch vụ đám mây trả phí định kỳ thuê bao.",
    status: "active",
    canBeQuoted: true,
    canBeSold: true,
    createsOwnedProduct: true,
    hasWarranty: false,
    hasSLA: false,
    hasSubscriptionPeriod: true,
    canBeRenewed: true,
    requiresStartDate: true,
    requiresEndDate: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "type_package",
    code: "package",
    displayNameEn: "Product Bundle / Package",
    displayNameVi: "Gói Combo sản phẩm",
    descriptionEn: "Bundled groups of services, hardware, and licenses.",
    descriptionVi: "Gói tích hợp nhiều sản phẩm, bản quyền phần mềm.",
    status: "active",
    canBeQuoted: true,
    canBeSold: true,
    createsOwnedProduct: true,
    hasWarranty: true,
    hasSLA: false,
    hasSubscriptionPeriod: false,
    canBeRenewed: false,
    requiresStartDate: false,
    requiresEndDate: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "type_implementation",
    code: "implementation",
    displayNameEn: "Implementation Services",
    displayNameVi: "Dịch vụ triển khai lắp đặt",
    descriptionEn: "Onsite implementation, installation, and calibration details.",
    descriptionVi: "Dịch vụ cài đặt hệ thống kĩ thuật, cấu hình thực tế.",
    status: "active",
    canBeQuoted: true,
    canBeSold: true,
    createsOwnedProduct: false,
    hasWarranty: true,
    hasSLA: false,
    hasSubscriptionPeriod: false,
    canBeRenewed: false,
    requiresStartDate: true,
    requiresEndDate: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "type_support_sla",
    code: "support_sla",
    displayNameEn: "Support & SLA Contract",
    displayNameVi: "Cam kết dịch vụ SLA",
    descriptionEn: "Ongoing support packages with critical response hours SLA.",
    descriptionVi: "Hợp đồng hỗ trợ kỹ thuật có cam kết thời gian khắc phục.",
    status: "active",
    canBeQuoted: true,
    canBeSold: true,
    createsOwnedProduct: true,
    hasWarranty: false,
    hasSLA: true,
    hasSubscriptionPeriod: true,
    canBeRenewed: true,
    requiresStartDate: true,
    requiresEndDate: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "type_addon",
    code: "addon",
    displayNameEn: "Product Add-on / Extension",
    displayNameVi: "Tiện ích bổ sung (Add-on)",
    descriptionEn: "Modular widgets or capacity supplements.",
    descriptionVi: "Phân hệ tính năng bổ trợ độc lập.",
    status: "active",
    canBeQuoted: true,
    canBeSold: true,
    createsOwnedProduct: true,
    hasWarranty: false,
    hasSLA: false,
    hasSubscriptionPeriod: true,
    canBeRenewed: true,
    requiresStartDate: true,
    requiresEndDate: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "type_license",
    code: "license",
    displayNameEn: "Software License",
    displayNameVi: "Bản quyền phần mềm (License)",
    descriptionEn: "On-premise digital codes or keys.",
    descriptionVi: "Bản quyền số cung cấp khóa kích hoạt dạng tĩnh.",
    status: "active",
    canBeQuoted: true,
    canBeSold: true,
    createsOwnedProduct: true,
    hasWarranty: true,
    hasSLA: false,
    hasSubscriptionPeriod: false,
    canBeRenewed: true,
    requiresStartDate: false,
    requiresEndDate: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "type_maintenance",
    code: "maintenance",
    displayNameEn: "Periodic Maintenance",
    displayNameVi: "Bảo trì định kỳ",
    descriptionEn: "Repeated hardware or software diagnostic checking intervals.",
    descriptionVi: "Công tác khám lỗi bảo trì lập lại theo định kỳ.",
    status: "active",
    canBeQuoted: true,
    canBeSold: true,
    createsOwnedProduct: true,
    hasWarranty: false,
    hasSLA: false,
    hasSubscriptionPeriod: true,
    canBeRenewed: true,
    requiresStartDate: true,
    requiresEndDate: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  }
];

export const DEFAULT_PRODUCT_FIELDS: ConfiguredProductField[] = [
  {
    id: "field_warrantyMonths",
    fieldKey: "warrantyMonths",
    labelEn: "Warranty Period (Months)",
    labelVi: "Thời gian bảo hành (Tháng)",
    type: "number",
    appliesToProductTypes: ["physical_product", "package", "license", "implementation"],
    required: false,
    visible: true,
    placeholderEn: "e.g. 12 or 24 months",
    placeholderVi: "Ví dụ: 12 hoặc 24 tháng",
    displayOrder: 1,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "field_defaultContractMonths",
    fieldKey: "defaultContractMonths",
    labelEn: "Subscription Duration (Months)",
    labelVi: "Kỳ hạn thuê bao mặc định (Tháng)",
    type: "number",
    appliesToProductTypes: ["subscription", "support_sla", "maintenance", "addon"],
    required: true,
    visible: true,
    placeholderEn: "e.g. 12",
    placeholderVi: "Ví dụ: 12 tháng",
    displayOrder: 2,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "field_renewalNoticeDays",
    fieldKey: "renewalNoticeDays",
    labelEn: "Renewal Notice Lead Time (Days)",
    labelVi: "Cảnh báo gia hạn trước (Ngày)",
    type: "number",
    appliesToProductTypes: ["subscription", "support_sla", "maintenance", "license", "addon"],
    required: false,
    visible: true,
    placeholderEn: "e.g. 30 days of notice",
    placeholderVi: "Mặc định báo trước 30 ngày",
    displayOrder: 3,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "field_slaLevel",
    fieldKey: "slaLevel",
    labelEn: "SLA Support Tier",
    labelVi: "Cấp độ hỗ trợ SLA",
    type: "select",
    appliesToProductTypes: ["support_sla"],
    required: true,
    visible: true,
    options: ["Bronze", "Silver", "Gold", "Platinum"],
    displayOrder: 4,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "field_responseTimeHours",
    fieldKey: "responseTimeHours",
    labelEn: "SLA Response SLA (Hours)",
    labelVi: "Thời gian cam kết hồi đáp (Giờ)",
    type: "number",
    appliesToProductTypes: ["support_sla"],
    required: false,
    visible: true,
    placeholderEn: "e.g. 1 hour, 4 hours",
    placeholderVi: "Ví dụ: 1 giờ, 2 giờ",
    displayOrder: 5,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "field_supportHours",
    fieldKey: "supportHours",
    labelEn: "Support Active Coverage",
    labelVi: "Khung thời gian hỗ trợ kỹ thuật",
    type: "text",
    appliesToProductTypes: ["support_sla"],
    required: false,
    visible: true,
    placeholderEn: "e.g. 24/7 or Business Hours 8/5",
    placeholderVi: "Ví dụ: 24/7 hoặc Giờ hành chính 8x5",
    displayOrder: 6,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "field_licenseSeats",
    fieldKey: "licenseSeats",
    labelEn: "Included License Seats",
    labelVi: "Số lượng người dùng hệ thống",
    type: "number",
    appliesToProductTypes: ["subscription", "license"],
    required: false,
    visible: true,
    placeholderEn: "e.g. 10 users limit",
    placeholderVi: "Ví dụ: tối đa 5 người sử dụng",
    displayOrder: 7,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "field_implementationScope",
    fieldKey: "implementationScope",
    labelEn: "Deployment Deliverables Scope",
    labelVi: "Phạm vi triển khai chi tiết",
    type: "textarea",
    appliesToProductTypes: ["implementation", "service"],
    required: false,
    visible: true,
    placeholderEn: "Outline setup specifications...",
    placeholderVi: "Cam kết hạng mục chuyển giao...",
    displayOrder: 8,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "field_inventoryTracking",
    fieldKey: "inventoryTracking",
    labelEn: "Enable Cargo Stock Tracking",
    labelVi: "Kích hoạt kiểm kê kho vận",
    type: "boolean",
    appliesToProductTypes: ["physical_product"],
    required: false,
    visible: true,
    displayOrder: 9,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "field_serialRequired",
    fieldKey: "serialRequired",
    labelEn: "Track Individual Serial Keys",
    labelVi: "Yêu cầu lưu kho mã Serial",
    type: "boolean",
    appliesToProductTypes: ["physical_product"],
    required: false,
    visible: true,
    displayOrder: 10,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "field_serviceDuration",
    fieldKey: "serviceDuration",
    labelEn: "Estimated Service Delivery (Days)",
    labelVi: "Công hạn triển khai dịch vụ (Ngày)",
    type: "number",
    appliesToProductTypes: ["service", "implementation"],
    required: false,
    visible: true,
    placeholderEn: "e.g. 30",
    placeholderVi: "Ví dụ: 45 ngày thực tế",
    displayOrder: 11,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "field_billingCycle",
    fieldKey: "billingCycle",
    labelEn: "Default Bill Frequency",
    labelVi: "Tần suất thu phí định kỳ",
    type: "select",
    appliesToProductTypes: ["subscription", "support_sla", "maintenance", "addon"],
    required: true,
    visible: true,
    options: ["monthly", "quarterly", "yearly", "custom"],
    displayOrder: 12,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  }
];

const KEYS = {
  TYPES: "product_types",
  FIELDS: "product_fields",
  LEGACY_TYPES: "centrix_product_types",
  LEGACY_FIELDS: "centrix_product_fields",
  OLDER_LEGACY_TYPES: "crm_product_types",
  OLDER_LEGACY_FIELDS: "crm_product_fields",
  MIGRATION_TARGET: "unicore_product_config_workspace_migration_v1",
};

const baseStorage = new BrowserStorageAdapter();

function scopedStorage(): StoragePort {
  const workspaceId = getWorkspaceContextSnapshot().workspaceId;
  return new WorkspaceScopedStorageAdapter(baseStorage, workspaceId, "product-configuration");
}

function cloneTypes(types: readonly ConfiguredProductType[]): ConfiguredProductType[] {
  return types.map((type) => ({ ...type }));
}

function cloneFields(fields: readonly ConfiguredProductField[]): ConfiguredProductField[] {
  return fields.map((field) => ({ ...field, appliesToProductTypes: [...field.appliesToProductTypes], options: field.options ? [...field.options] : undefined }));
}

function migrateLegacyTypesOnce(storage: StoragePort): ConfiguredProductType[] | null {
  const workspaceId = getWorkspaceContextSnapshot().workspaceId;
  const migratedTarget = baseStorage.get<string>(KEYS.MIGRATION_TARGET);
  if (migratedTarget && migratedTarget !== workspaceId) return null;

  const legacy = baseStorage.get<unknown[]>(KEYS.LEGACY_TYPES) ?? baseStorage.get<unknown[]>(KEYS.OLDER_LEGACY_TYPES);
  if (!Array.isArray(legacy)) return null;

  const now = new Date().toISOString();
  const migrated = legacy.map((raw, idx) => {
    const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const code = String(item.code || `type_code_${idx}`);
    return {
      id: String(item.id || `type_${code}`),
      code,
      displayNameVi: String(item.nameVi || item.displayNameVi || code),
      displayNameEn: String(item.nameEn || item.displayNameEn || code),
      descriptionVi: typeof item.descriptionVi === "string" ? item.descriptionVi : "",
      descriptionEn: typeof item.descriptionEn === "string" ? item.descriptionEn : "",
      status: item.status === "inactive" ? "inactive" as const : "active" as const,
      canBeQuoted: item.canBeQuoted !== false,
      canBeSold: item.canBeSold !== false,
      createsOwnedProduct: Boolean(item.createsOwnedProduct),
      hasWarranty: Boolean(item.hasWarranty),
      hasSLA: Boolean(item.hasSLA),
      hasSubscriptionPeriod: Boolean(item.hasSubscriptionPeriod),
      canBeRenewed: Boolean(item.canBeRenewed),
      requiresStartDate: Boolean(item.requiresStartDate),
      requiresEndDate: Boolean(item.requiresEndDate),
      createdAt: typeof item.createdAt === "string" ? item.createdAt : now,
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
    } satisfies ConfiguredProductType;
  });
  storage.set(KEYS.TYPES, migrated);
  baseStorage.set(KEYS.MIGRATION_TARGET, workspaceId);
  return migrated;
}

function migrateLegacyFieldsOnce(storage: StoragePort): ConfiguredProductField[] | null {
  const workspaceId = getWorkspaceContextSnapshot().workspaceId;
  const migratedTarget = baseStorage.get<string>(KEYS.MIGRATION_TARGET);
  if (migratedTarget && migratedTarget !== workspaceId) return null;

  const legacy = baseStorage.get<unknown[]>(KEYS.LEGACY_FIELDS) ?? baseStorage.get<unknown[]>(KEYS.OLDER_LEGACY_FIELDS);
  if (!Array.isArray(legacy)) return null;

  const now = new Date().toISOString();
  const migrated = legacy.map((raw, idx) => {
    const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const fieldKey = String(item.key || item.fieldKey || `fieldKey_${idx}`);
    const options = Array.isArray(item.options) ? item.options.map(String) : [];
    const appliesToProductTypes = Array.isArray(item.appliesToTypes)
      ? item.appliesToTypes.map(String)
      : Array.isArray(item.appliesToProductTypes)
        ? item.appliesToProductTypes.map(String)
        : ["all"];
    return {
      id: String(item.id || `field_${fieldKey}`),
      fieldKey,
      labelVi: typeof item.labelVi === "string" ? item.labelVi : "",
      labelEn: typeof item.labelEn === "string" ? item.labelEn : "",
      type: (["text", "number", "currency", "date", "select", "boolean", "textarea"] as const).includes(item.type as any) ? item.type as ConfiguredProductField["type"] : "text",
      appliesToProductTypes,
      required: Boolean(item.required),
      visible: item.visible !== false,
      placeholderVi: typeof item.placeholderVi === "string" ? item.placeholderVi : "",
      placeholderEn: typeof item.placeholderEn === "string" ? item.placeholderEn : "",
      helpTextVi: typeof item.helpTextVi === "string" ? item.helpTextVi : "",
      helpTextEn: typeof item.helpTextEn === "string" ? item.helpTextEn : "",
      options,
      displayOrder: typeof item.displayOrder === "number" ? item.displayOrder : idx + 1,
      status: item.status === "inactive" ? "inactive" as const : "active" as const,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : now,
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now,
    } satisfies ConfiguredProductField;
  });
  storage.set(KEYS.FIELDS, migrated);
  baseStorage.set(KEYS.MIGRATION_TARGET, workspaceId);
  return migrated;
}

export const productConfigStore = {
  getProductTypes(): ConfiguredProductType[] {
    const storage = scopedStorage();
    const saved = storage.get<ConfiguredProductType[]>(KEYS.TYPES);
    if (Array.isArray(saved)) return cloneTypes(saved);
    const migrated = migrateLegacyTypesOnce(storage);
    if (migrated) return cloneTypes(migrated);
    const defaults = cloneTypes(DEFAULT_PRODUCT_TYPES);
    storage.set(KEYS.TYPES, defaults);
    return cloneTypes(defaults);
  },

  saveProductTypes(types: ConfiguredProductType[]): void {
    scopedStorage().set(KEYS.TYPES, cloneTypes(types));
  },

  getProductFields(): ConfiguredProductField[] {
    const storage = scopedStorage();
    const saved = storage.get<ConfiguredProductField[]>(KEYS.FIELDS);
    if (Array.isArray(saved)) return cloneFields(saved);
    const migrated = migrateLegacyFieldsOnce(storage);
    if (migrated) return cloneFields(migrated);
    const defaults = cloneFields(DEFAULT_PRODUCT_FIELDS);
    storage.set(KEYS.FIELDS, defaults);
    return cloneFields(defaults);
  },

  saveProductFields(fields: ConfiguredProductField[]): void {
    scopedStorage().set(KEYS.FIELDS, cloneFields(fields));
  },

  getDefaultProductConfiguration(): { types: ConfiguredProductType[]; fields: ConfiguredProductField[] } {
    return { types: cloneTypes(DEFAULT_PRODUCT_TYPES), fields: cloneFields(DEFAULT_PRODUCT_FIELDS) };
  },

  resetProductConfiguration(): { types: ConfiguredProductType[]; fields: ConfiguredProductField[] } {
    const types = cloneTypes(DEFAULT_PRODUCT_TYPES);
    const fields = cloneFields(DEFAULT_PRODUCT_FIELDS);
    const storage = scopedStorage();
    storage.set(KEYS.TYPES, types);
    storage.set(KEYS.FIELDS, fields);
    return { types: cloneTypes(types), fields: cloneFields(fields) };
  },

  isProductTypeUsed(typeCode: string, products: Product[]): boolean {
    return products.some((product) => product.type === typeCode);
  },

  isProductFieldUsed(fieldKey: string, products: Product[]): boolean {
    return products.some((product) => product.customFields?.[fieldKey] !== undefined && product.customFields[fieldKey] !== "");
  },
};
