import type { EffectiveAccess } from "@/platform/access-control";

export type NavigationProfileId = "administrator" | "sales" | "finance" | "operations" | "customer-service" | "viewer" | "custom";

export interface RoleNavigationProfile {
  id: NavigationProfileId;
  labelVi: string;
  labelEn: string;
  primaryModules: ReadonlySet<string>;
  showAllAccessible: boolean;
}

const ALL = new Set<string>();
const profile = (id: NavigationProfileId, labelVi: string, labelEn: string, modules: readonly string[], showAllAccessible = false): RoleNavigationProfile => ({
  id,
  labelVi,
  labelEn,
  primaryModules: new Set(modules),
  showAllAccessible,
});

const PROFILE_BY_TEMPLATE: Readonly<Record<string, RoleNavigationProfile>> = {
  "workspace-administrator": profile("administrator", "Quản trị workspace", "Workspace administration", [], true),
  "sales-manager": profile("sales", "Quản lý bán hàng", "Sales management", ["dashboard", "tasks", "calendar", "notifications", "leads", "contacts", "organizations", "customers", "deals", "quotes", "orders", "products", "reports"]),
  "sales-representative": profile("sales", "Bán hàng", "Sales", ["dashboard", "tasks", "calendar", "notifications", "leads", "contacts", "organizations", "customers", "deals", "quotes", "orders", "products", "reports"]),
  finance: profile("finance", "Tài chính và thanh toán", "Finance and payments", ["dashboard", "tasks", "notifications", "contacts", "organizations", "customers", "orders", "payments", "invoices", "receivables", "returns", "reports"]),
  operations: profile("operations", "Vận hành đơn hàng", "Order operations", ["dashboard", "tasks", "notifications", "contacts", "organizations", "customers", "orders", "products", "invoices", "receivables", "shipping", "returns", "support", "reports"]),
  "customer-success": profile("customer-service", "Chăm sóc khách hàng", "Customer success", ["dashboard", "tasks", "calendar", "notifications", "contacts", "organizations", "customers", "orders", "invoices", "receivables", "returns", "support", "reports"]),
  support: profile("customer-service", "Hỗ trợ khách hàng", "Customer support", ["dashboard", "tasks", "calendar", "notifications", "contacts", "organizations", "customers", "orders", "returns", "support"]),
  viewer: profile("viewer", "Chế độ chỉ xem", "Read-only workspace", [], true),
};

export function resolveRoleNavigationProfile(access: EffectiveAccess): RoleNavigationProfile {
  const templateIds = [...access.roleTemplateIds];
  if (templateIds.includes("workspace-administrator")) return PROFILE_BY_TEMPLATE["workspace-administrator"];
  if (templateIds.length === 0) return profile("custom", "Không gian theo quyền", "Capability-based workspace", [], true);

  const matched = templateIds.map((id) => PROFILE_BY_TEMPLATE[id]).filter(Boolean);
  if (matched.length === 0) return profile("custom", "Không gian theo quyền", "Capability-based workspace", [], true);
  const showAllProfile = matched.find((entry) => entry.showAllAccessible);
  if (showAllProfile) return showAllProfile;

  const primaryModules = new Set<string>();
  for (const entry of matched) for (const moduleKey of entry.primaryModules) primaryModules.add(moduleKey);
  const first = matched[0];
  if (matched.length === 1) return { ...first, primaryModules };
  return profile("custom", "Không gian kết hợp theo vai trò", "Combined role workspace", [...primaryModules]);
}

export function isPrimaryNavigationModule(access: EffectiveAccess, moduleKey: string): boolean {
  const navigation = resolveRoleNavigationProfile(access);
  return navigation.showAllAccessible || navigation.primaryModules.has(moduleKey);
}

export const EMPTY_NAVIGATION_MODULES = ALL;
