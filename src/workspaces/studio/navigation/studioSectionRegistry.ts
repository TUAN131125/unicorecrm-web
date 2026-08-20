import { ROUTE_KEYS } from "@/platform/navigation";
import { relativeRoutePath } from "@/platform/navigation";
import { CAPABILITIES } from "@/platform/access-control/domain/capabilityCatalog";
import type { Capability } from "@/platform/access-control/domain/accessControl.types";

export type StudioSectionGroupId = "quick-setup" | "workspace" | "crm-data" | "finance" | "connections";
export type StudioSectionIconKey =
  | "quick-setup"
  | "building"
  | "locale"
  | "modules"
  | "pipeline"
  | "products"
  | "fields"
  | "payments"
  | "invoice"
  | "integrations"
  | "webhooks";

export type StudioSectionId =
  | "quick-setup"
  | "business-information"
  | "locale-region"
  | "feature-usage"
  | "pipelines-statuses"
  | "product-types"
  | "information-fields"
  | "payment-information"
  | "invoice-information"
  | "integrations"
  | "webhooks-api";

export interface StudioSectionDefinition {
  id: StudioSectionId;
  groupId: StudioSectionGroupId;
  routePath: string;
  labelVi: string;
  labelEn: string;
  descriptionVi: string;
  descriptionEn: string;
  icon: StudioSectionIconKey;
  requiredCapability: Capability;
  order: number;
}

export interface StudioSectionGroupDefinition {
  id: StudioSectionGroupId;
  labelVi: string;
  labelEn: string;
  order: number;
}

export const STUDIO_SECTION_GROUPS: readonly StudioSectionGroupDefinition[] = [
  { id: "quick-setup", labelVi: "BẮT ĐẦU", labelEn: "GET STARTED", order: 0 },
  { id: "workspace", labelVi: "WORKSPACE", labelEn: "WORKSPACE", order: 10 },
  { id: "crm-data", labelVi: "DỮ LIỆU CRM", labelEn: "CRM DATA", order: 20 },
  { id: "finance", labelVi: "TÀI CHÍNH", labelEn: "FINANCE", order: 30 },
  { id: "connections", labelVi: "KẾT NỐI", labelEn: "CONNECTIONS", order: 40 },
] as const;

export const STUDIO_SECTIONS: readonly StudioSectionDefinition[] = [
  {
    id: "quick-setup",
    groupId: "quick-setup",
    routePath: relativeRoutePath(ROUTE_KEYS.SETTINGS_QUICK_SETUP),
    labelVi: "Thiết lập nhanh",
    labelEn: "Quick Setup",
    descriptionVi: "Khảo sát tùy chọn, lưu từng bước và có thể mở lại bất kỳ lúc nào.",
    descriptionEn: "An optional step-by-step survey that can be reopened at any time.",
    icon: "quick-setup",
    requiredCapability: CAPABILITIES.STUDIO_READ,
    order: 0,
  },
  {
    id: "business-information",
    groupId: "workspace",
    routePath: relativeRoutePath(ROUTE_KEYS.SETTINGS_BUSINESS_INFORMATION),
    labelVi: "Thông tin doanh nghiệp",
    labelEn: "Business information",
    descriptionVi: "Thông tin nhận diện và pháp lý của doanh nghiệp trong workspace.",
    descriptionEn: "Business identity and legal information for the workspace.",
    icon: "building",
    requiredCapability: CAPABILITIES.STUDIO_READ,
    order: 10,
  },
  {
    id: "locale-region",
    groupId: "workspace",
    routePath: relativeRoutePath(ROUTE_KEYS.SETTINGS_LOCALE_REGION),
    labelVi: "Ngôn ngữ & khu vực",
    labelEn: "Language & region",
    descriptionVi: "Ngôn ngữ, múi giờ, tiền tệ và quy ước hiển thị.",
    descriptionEn: "Language, time zone, currency, and display conventions.",
    icon: "locale",
    requiredCapability: CAPABILITIES.STUDIO_READ,
    order: 20,
  },
  {
    id: "feature-usage",
    groupId: "workspace",
    routePath: relativeRoutePath(ROUTE_KEYS.SETTINGS_FEATURE_USAGE),
    labelVi: "Tính năng sử dụng",
    labelEn: "Feature usage",
    descriptionVi: "Bật hoặc tắt các module nghiệp vụ được sử dụng trong workspace.",
    descriptionEn: "Enable or disable the business modules used in the workspace.",
    icon: "modules",
    requiredCapability: CAPABILITIES.STUDIO_READ,
    order: 30,
  },
  {
    id: "pipelines-statuses",
    groupId: "crm-data",
    routePath: relativeRoutePath(ROUTE_KEYS.SETTINGS_PIPELINES_STATUSES),
    labelVi: "Pipeline & trạng thái",
    labelEn: "Pipelines & statuses",
    descriptionVi: "Quản lý nhiều pipeline và chỉnh sửa giai đoạn trực tiếp.",
    descriptionEn: "Manage multiple pipelines and edit stages directly.",
    icon: "pipeline",
    requiredCapability: CAPABILITIES.STUDIO_READ,
    order: 40,
  },
  {
    id: "product-types",
    groupId: "crm-data",
    routePath: relativeRoutePath(ROUTE_KEYS.SETTINGS_PRODUCT_TYPES),
    labelVi: "Loại sản phẩm",
    labelEn: "Product types",
    descriptionVi: "Danh mục loại sản phẩm do doanh nghiệp tự tạo.",
    descriptionEn: "Product type catalog defined by the business.",
    icon: "products",
    requiredCapability: CAPABILITIES.STUDIO_READ,
    order: 50,
  },
  {
    id: "information-fields",
    groupId: "crm-data",
    routePath: relativeRoutePath(ROUTE_KEYS.SETTINGS_INFORMATION_FIELDS),
    labelVi: "Trường thông tin",
    labelEn: "Information fields",
    descriptionVi: "Quản lý trường hệ thống và trường tùy chỉnh cho từng đối tượng CRM.",
    descriptionEn: "Manage system and custom fields for each CRM object.",
    icon: "fields",
    requiredCapability: CAPABILITIES.STUDIO_READ,
    order: 60,
  },
  {
    id: "payment-information",
    groupId: "finance",
    routePath: relativeRoutePath(ROUTE_KEYS.SETTINGS_PAYMENT_INFORMATION),
    labelVi: "Thông tin thanh toán",
    labelEn: "Payment information",
    descriptionVi: "Tài khoản nhận tiền và thông tin chuyển khoản của doanh nghiệp.",
    descriptionEn: "Business receiving accounts and transfer information.",
    icon: "payments",
    requiredCapability: CAPABILITIES.STUDIO_READ,
    order: 70,
  },
  {
    id: "invoice-information",
    groupId: "finance",
    routePath: relativeRoutePath(ROUTE_KEYS.SETTINGS_INVOICE_INFORMATION),
    labelVi: "Thông tin hóa đơn",
    labelEn: "Invoice information",
    descriptionVi: "Thông tin người bán và mặc định hiển thị trên hóa đơn.",
    descriptionEn: "Seller information and invoice display defaults.",
    icon: "invoice",
    requiredCapability: CAPABILITIES.STUDIO_READ,
    order: 80,
  },
  {
    id: "integrations",
    groupId: "connections",
    routePath: relativeRoutePath(ROUTE_KEYS.SETTINGS_INTEGRATIONS),
    labelVi: "Tích hợp",
    labelEn: "Integrations",
    descriptionVi: "Kết nối email, Zalo, vận chuyển, thanh toán và nhà cung cấp bên ngoài.",
    descriptionEn: "Connect email, messaging, shipping, payments, and external providers.",
    icon: "integrations",
    requiredCapability: CAPABILITIES.STUDIO_READ,
    order: 90,
  },
  {
    id: "webhooks-api",
    groupId: "connections",
    routePath: relativeRoutePath(ROUTE_KEYS.SETTINGS_WEBHOOKS_API),
    labelVi: "Webhook & API",
    labelEn: "Webhooks & API",
    descriptionVi: "Nhận dữ liệu vào CRM và phát sự kiện ra hệ thống khác.",
    descriptionEn: "Receive CRM data and publish events to external systems.",
    icon: "webhooks",
    requiredCapability: CAPABILITIES.STUDIO_READ,
    order: 100,
  },
] as const;

const sectionMap = new Map(STUDIO_SECTIONS.map((section) => [section.id, section]));
const routeMap = new Map(STUDIO_SECTIONS.map((section) => [section.routePath, section]));

export function getStudioSection(id: StudioSectionId): StudioSectionDefinition {
  const section = sectionMap.get(id);
  if (!section) throw new Error(`Unknown Studio section: ${id}`);
  return section;
}

export function listStudioSectionsForGroup(groupId: StudioSectionGroupId): StudioSectionDefinition[] {
  return STUDIO_SECTIONS.filter((section) => section.groupId === groupId).sort((left, right) => left.order - right.order);
}

export function isKnownStudioRoutePath(routePath: string): boolean {
  return routeMap.has(routePath.replace(/^\/+|\/+$/g, ""));
}
