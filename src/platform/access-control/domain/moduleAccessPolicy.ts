import type { EffectiveAccess } from "./accessControl.types";
import { CAPABILITIES } from "./capabilityCatalog";

export interface ModuleAccessPolicy {
  moduleKey: string;
  ownerVi: string;
  ownerEn: string;
  writeCapabilities: readonly string[];
  showReadOnlyBanner: boolean;
}

const policy = (
  moduleKey: string,
  ownerVi: string,
  ownerEn: string,
  writeCapabilities: readonly string[],
  showReadOnlyBanner = true,
): ModuleAccessPolicy => ({ moduleKey, ownerVi, ownerEn, writeCapabilities, showReadOnlyBanner });

export const MODULE_ACCESS_POLICIES: Readonly<Record<string, ModuleAccessPolicy>> = {
  leads: policy("leads", "đội Sales", "Sales", [CAPABILITIES.LEADS_CREATE, CAPABILITIES.LEADS_UPDATE, CAPABILITIES.LEADS_ASSIGN, CAPABILITIES.LEADS_QUALIFY]),
  contacts: policy("contacts", "đội Sales và Chăm sóc khách hàng", "Sales and Customer Success", [CAPABILITIES.CONTACTS_CREATE, CAPABILITIES.CONTACTS_UPDATE, CAPABILITIES.CONTACTS_ASSIGN]),
  organizations: policy("organizations", "đội Sales và Chăm sóc khách hàng", "Sales and Customer Success", [CAPABILITIES.ORGANIZATIONS_CREATE, CAPABILITIES.ORGANIZATIONS_UPDATE]),
  customers: policy("customers", "đội Chăm sóc khách hàng", "Customer Success", [CAPABILITIES.CUSTOMERS_ONBOARD_EXISTING, CAPABILITIES.CUSTOMERS_EDIT, CAPABILITIES.CUSTOMERS_ASSIGN, CAPABILITIES.CUSTOMERS_ARCHIVE]),
  deals: policy("deals", "đội Sales", "Sales", [CAPABILITIES.DEALS_CREATE, CAPABILITIES.DEALS_UPDATE, CAPABILITIES.DEALS_ASSIGN, CAPABILITIES.DEALS_CLOSE]),
  quotes: policy("quotes", "đội Sales", "Sales", [CAPABILITIES.QUOTES_CREATE, CAPABILITIES.QUOTES_UPDATE, CAPABILITIES.QUOTES_APPROVE]),
  orders: policy("orders", "đội Sales và Vận hành", "Sales and Operations", [CAPABILITIES.ORDERS_CREATE, CAPABILITIES.ORDERS_UPDATE, CAPABILITIES.ORDERS_COMPLETE]),
  products: policy("products", "quản trị sản phẩm", "Product administration", [CAPABILITIES.PRODUCTS_CREATE, CAPABILITIES.PRODUCTS_EDIT, CAPABILITIES.PRODUCTS_DELETE]),
  payments: policy("payments", "bộ phận Tài chính", "Finance", [CAPABILITIES.PAYMENTS_RECORD_MANUAL, CAPABILITIES.PAYMENTS_ALLOCATE, CAPABILITIES.PAYMENTS_RECONCILE]),
  invoices: policy("invoices", "bộ phận Tài chính", "Finance", [CAPABILITIES.INVOICES_CREATE, CAPABILITIES.INVOICES_ISSUE, CAPABILITIES.INVOICES_CREATE_CREDIT_NOTE]),
  receivables: policy("receivables", "bộ phận Tài chính", "Finance", [CAPABILITIES.RECEIVABLES_EXPORT, CAPABILITIES.PAYMENTS_ALLOCATE]),
  shipping: policy("shipping", "bộ phận Vận hành", "Operations", [CAPABILITIES.SHIPPING_CREATE]),
  returns: policy("returns", "bộ phận Vận hành và Chăm sóc khách hàng", "Operations and Customer Success", [CAPABILITIES.RETURNS_UPDATE, CAPABILITIES.RETURNS_RESOLVE]),
  support: policy("support", "đội Chăm sóc khách hàng", "Customer Success", [CAPABILITIES.SUPPORT_CREATE, CAPABILITIES.SUPPORT_UPDATE, CAPABILITIES.SUPPORT_ASSIGN, CAPABILITIES.SUPPORT_COMPLETE]),
  tasks: policy("tasks", "đội phụ trách công việc", "the responsible team", [CAPABILITIES.TASKS_CREATE, CAPABILITIES.TASKS_UPDATE, CAPABILITIES.TASKS_ASSIGN, CAPABILITIES.TASKS_COMPLETE]),
  reports: policy("reports", "quản trị báo cáo", "Reporting administration", [CAPABILITIES.REPORTS_EXPORT], false),
  dashboard: policy("dashboard", "quản trị workspace", "Workspace administration", [], false),
};

export function canWriteModule(access: EffectiveAccess, moduleKey: string): boolean {
  const policyEntry = MODULE_ACCESS_POLICIES[moduleKey];
  if (!policyEntry || policyEntry.writeCapabilities.length === 0) return false;
  return policyEntry.writeCapabilities.some((capability) => access.can(capability));
}

export function moduleAccessPolicy(moduleKey: string): ModuleAccessPolicy | undefined {
  return MODULE_ACCESS_POLICIES[moduleKey];
}
