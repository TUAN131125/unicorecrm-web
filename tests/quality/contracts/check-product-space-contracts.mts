import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CANONICAL_PRODUCT_SPACES,
  canonicalizeLegacyPath,
  parseCanonicalRoute,
  productSpaceHome,
  toWorkspacePath,
} from "@/platform/navigation";

const root = repositoryRoot;
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

assert.deepEqual(CANONICAL_PRODUCT_SPACES, ["crm", "studio", "people"], "The product must expose exactly CRM, Studio and People & Access product spaces");
assert.equal(new Set(CANONICAL_PRODUCT_SPACES).size, 3);
assert.equal(toWorkspacePath("acme", "crm", "/leads"), "/w/acme/crm/leads");
assert.equal(productSpaceHome("acme", "studio"), "/w/acme/studio");
assert.deepEqual(parseCanonicalRoute("/w/acme/people/members"), { workspaceKey: "acme", productSpace: "people", relativePath: "members" });
assert.equal(canonicalizeLegacyPath("acme", "/settings/audit-logs"), "/w/acme/people/audit");
assert.equal(canonicalizeLegacyPath("acme", "/settings/system"), "/w/acme/studio/settings/system");
assert.equal(canonicalizeLegacyPath("acme", "/leads"), "/w/acme/crm/leads");

const crmRoutesRoot = source("src/app/router/CrmRoutes.tsx");
for (const prefix of ['/w/:workspaceKey/crm', '/w/:workspaceKey/studio', '/w/:workspaceKey/people']) {
  assert.ok(crmRoutesRoot.includes(`path: "${prefix}"`), `CrmRoutes must compose ${prefix}`);
}
assert.ok(crmRoutesRoot.includes("createPeopleAccessWorkspaceRoutes"));
assert.equal(crmRoutesRoot.includes("createConversationsWorkspaceRoutes"), false);

const productSpaceNav = source("src/app/shell/layout/ProductSpaceNav.tsx");
for (const key of ['key: "crm"', 'key: "studio"', 'key: "people"']) assert.ok(productSpaceNav.includes(key), `ProductSpaceNav must define ${key}`);
assert.ok(productSpaceNav.includes("Users & Access"));
assert.equal(productSpaceNav.includes("AI"), false, "AI must not be a product-space navigation item");

const sidebar = source("src/app/shell/layout/Sidebar.tsx");
for (const space of ["crm", "studio", "people"]) assert.ok(sidebar.includes(`activeProductSpace === "${space}"`), `Sidebar must be contextual for ${space}`);
assert.ok(sidebar.includes("workspaceMemberships.filter"), "Workspace switcher must render membership-scoped options");
assert.equal(sidebar.includes("ai-assistant"), false, "AI must not appear in contextual Sidebar navigation");
assert.ok(sidebar.includes('"quick-setup"'), "Studio Sidebar must expose the always-reopenable Quick Setup route");

const applicationShell = source("src/app/shell/CrmApplicationShell.tsx");
assert.ok(applicationShell.includes('routeContext?.productSpace === "crm"'));
assert.ok(applicationShell.includes("CrmAiFloatingUtility"));
assert.equal(applicationShell.includes("AiAssistantPage"), false);

const appShell = source("src/app/shell/layout/AppShell.tsx");
for (const marker of ["getDirtyUnsavedWork", "saveDirtyUnsavedWork", "discardDirtyUnsavedWork", "useBlocker", "Lưu và tiếp tục", "Bỏ thay đổi", "Tiếp tục chỉnh sửa"]) assert.ok(appShell.includes(marker), `Workspace and route navigation must guard unsaved work with ${marker}`);
assert.ok(appShell.includes("switchWorkspace(workspaceKey)"));
assert.ok(appShell.includes("toWorkspacePath(workspaceKey, targetSpace"));
for (const roleName of ["owner_admin", "sales_manager", "sales_rep", "cs_manager", "cs_rep"]) {
  assert.equal(appShell.includes(`\"${roleName}\"`), false, `AppShell must not hard-code role name ${roleName}`);
}

const studioRoutes = source("src/app/router/workspaces/studioWorkspaceRoutes.tsx");
assert.equal(studioRoutes.includes("UsersPermissionsPage"), false);
assert.equal(studioRoutes.includes("AuditLogsPage"), false);
const peopleRoutes = source("src/app/router/workspaces/peopleAccessWorkspaceRoutes.tsx");
assert.ok(peopleRoutes.includes("UsersPermissionsPage"));
assert.ok(peopleRoutes.includes("AuditLogsPage"));
assert.equal(fs.existsSync(path.join(root, "src/workspaces/studio/presentation/pages/UsersPermissionsPage.tsx")), false);
assert.equal(fs.existsSync(path.join(root, "src/workspaces/studio/presentation/pages/AuditLogsPage.tsx")), false);
assert.ok(fs.existsSync(path.join(root, "src/workspaces/people-access/presentation/pages/UsersPermissionsPage.tsx")));
assert.ok(fs.existsSync(path.join(root, "src/workspaces/people-access/presentation/pages/AuditLogsPage.tsx")));

assert.equal(fs.existsSync(path.join(root, "src/app/router/workspaces/conversationsWorkspaceRoutes.tsx")), false, "Conversations must not exist as a product-space route tree");
assert.equal(fs.existsSync(path.join(root, "src/workspaces/conversations")), false, "Only CRM, Studio and People & Access may own workspace route trees");
assert.equal(source("src/platform/navigation/routeKeys.ts").includes("AI_ASSISTANT"), false, "AI must not own a primary route key");

const routeGuard = source("src/app/router/guards/CanonicalProductSpaceGuard.tsx");
assert.ok(routeGuard.includes("workspaceMemberships.find"));
assert.ok(routeGuard.includes("access.productSpaces.has(productSpace)"));
assert.ok(routeGuard.includes("return <Outlet />"));

const repositorySnapshotHook = source("src/workspaces/crm/read-models/core/useRepositorySnapshot.ts");
assert.ok(repositorySnapshotHook.includes("useSubscribableSnapshot"), "Repository snapshots must update from repository subscription events");
assert.equal(/\buseSyncExternalStore\s*\(/.test(repositorySnapshotHook), false, "Defensive-copy repository getters must not be passed directly to useSyncExternalStore");

const errorBoundary = source("src/components/AppErrorBoundary.tsx");
for (const storageKey of [
  "centrix_auth_session_v1",
  "centrix_admin_users_permissions_v2",
  "centrix_admin_users_permissions_v1",
  "unicore_active_workspace_key_v1",
]) assert.ok(errorBoundary.includes(storageKey), `Crash recovery must clear ${storageKey}`);
assert.equal(errorBoundary.includes("centrix_active_admin_role_id"), false, "Crash recovery must not restore the retired active-role impersonation key");
assert.ok(errorBoundary.includes("#/login"), "Crash recovery must return to the HashRouter login route");

for (const removed of [
  "src/modules/fulfillment",
  "src/modules/care",
  "src/modules/acquisition",
  "src/modules/campaigns",
  "src/features/onboarding",
  "src/features/renewals",
  "src/features/forecast",
  "src/workspaces/crm/read-models/analytics/forecastReadModel.ts",
  "src/workspaces/crm/read-models/analytics/useForecastReadModel.ts",
  "src/utils/forecastSelectors.ts",
  "src/workflows/acquisition-routing",
  "src/workflows/relationship-buying-motion",
  "src/workspaces/crm/read-models/renewals",
]) assert.equal(fs.existsSync(path.join(root, removed)), false, `${removed} must remain outside the current product scope`);

for (const required of [
  "src/modules/shipping",
  "src/modules/returns",
  "src/workflows/order-shipping-booking",
  "src/workspaces/studio/navigation/studioSectionRegistry.ts",
  "src/workspaces/studio/presentation/views/BusinessInformationView.tsx",
]) assert.equal(fs.existsSync(path.join(root, required)), true, `${required} must exist`);

for (const label of ["KHÁCH HÀNG", "BÁN HÀNG", "SẢN PHẨM", "VẬN HÀNH ĐƠN HÀNG", "DỊCH VỤ"]) assert.match(sidebar, new RegExp(label), `Sidebar must contain ${label}`);
for (const removedLabel of ["Signal Inbox", "Care Queue", "Renewals", "Onboarding", "Fulfillment"]) assert.equal(sidebar.includes(removedLabel), false, `Sidebar must not expose ${removedLabel}`);
const studioNavigation = `${sidebar}\n${source("src/workspaces/studio/navigation/studioSectionRegistry.ts")}`;
for (const studioLabel of ["WORKSPACE", "DỮ LIỆU CRM", "TÀI CHÍNH", "KẾT NỐI", "Thông tin doanh nghiệp", "Ngôn ngữ & khu vực", "Tính năng sử dụng", "Pipeline & trạng thái", "Loại sản phẩm", "Trường thông tin", "Thông tin thanh toán", "Thông tin hóa đơn", "Tích hợp", "Webhook & API"]) assert.match(studioNavigation, new RegExp(studioLabel), `Studio navigation must contain ${studioLabel}`);
for (const obsoleteStudioLabel of ["Tổng quan", "Thiết lập doanh nghiệp", "Quy trình bán hàng", "Thiết lập chăm sóc khách hàng", "Sản phẩm chủ lực", "Tùy chỉnh nâng cao"]) assert.equal(studioNavigation.includes(obsoleteStudioLabel), false, `Studio navigation must not expose ${obsoleteStudioLabel}`);

assert.match(studioNavigation, /ROUTE_KEYS\.SETTINGS_PAYMENT_INFORMATION/);
assert.match(studioRoutes, /StudioBusinessInformationView/);
assert.match(studioRoutes, /StudioWebhooksApiView/);
const crmWorkspaceRoutes = source("src/app/router/workspaces/crmWorkspaceRoutes.tsx");
assert.match(crmWorkspaceRoutes, /ROUTE_KEYS\.SHIPPING/);
assert.match(crmWorkspaceRoutes, /ROUTE_KEYS\.RETURNS/);
for (const token of ["SIGNAL_INBOX", "ACQUISITION_OPERATIONS", "LEAD_SOURCES", "FORECAST", "RENEWALS", "CARE_QUEUE", "FULFILLMENT", "ONBOARDING", "PRICE_BOOK"]) {
  assert.equal(crmWorkspaceRoutes.includes(token), false, `CRM routes must not expose ${token}`);
}

console.log("Product-space contracts: OK");
