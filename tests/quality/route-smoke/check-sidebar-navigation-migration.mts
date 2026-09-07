import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { evaluateEffectiveAccess } from "../../../src/platform/access-control/domain/evaluateEffectiveAccess";
import type { Capability } from "../../../src/platform/access-control/domain/accessControl.types";
import { CAPABILITIES } from "../../../src/platform/access-control/domain/capabilityCatalog";
import { createDefaultAccessControlSnapshot } from "../../../src/platform/access-control/runtime/accessControlSeed";
import { migrateStoredAccessControlSnapshot } from "../../../src/platform/access-control/runtime/accessControlMigration";
import { CURRENT_ACCESS_CONTROL_SCHEMA_VERSION } from "../../../src/platform/access-control/runtime/accessControlSchema";
import { BrowserWorkspaceConfigRepository } from "../../../src/platform/workspace-config/BrowserWorkspaceConfigRepository";
import type { StoragePort } from "../../../src/platform/persistence/StoragePort";

const root = repositoryRoot;
const workspaceId = "ws_default";
const fresh = createDefaultAccessControlSnapshot(workspaceId);

class MemoryStorage implements StoragePort {
  private values = new Map<string, unknown>();
  get<T>(key: string): T | null { return (this.values.has(key) ? this.values.get(key) : null) as T | null; }
  set<T>(key: string, value: T): void { this.values.set(key, value); }
  remove(key: string): void { this.values.delete(key); }
}

const configStorage = new MemoryStorage();
configStorage.set("centrix_admin_system_config_v1", {
  workspaceName: "Stale B2B Workspace",
  businessModel: "B2B",
  enabledModules: { leads: true, contacts: true, organizations: false, customerView: false },
});
const migratedConfigRepository = new BrowserWorkspaceConfigRepository(configStorage);
assert.equal(migratedConfigRepository.getSnapshot().modules.customers, true, "Retired Customer View visibility must not keep the mandatory Customers module hidden.");
assert.equal(migratedConfigRepository.getSnapshot().modules.organizations, true, "B2B workspace migration must restore the canonical Organizations module.");
const migratedStoredConfig = configStorage.get<{ enabledModules?: Record<string, unknown> }>("centrix_admin_system_config_v1");
assert.equal(migratedStoredConfig?.enabledModules?.customers, true, "Workspace module migration must persist Customers as enabled.");
assert.equal(migratedStoredConfig?.enabledModules?.organizations, true, "Workspace module migration must persist Organizations as enabled for B2B/Hybrid workspaces.");
assert.equal(Object.prototype.hasOwnProperty.call(migratedStoredConfig?.enabledModules ?? {}, "customerView"), false, "Persisted workspace module migration must remove the retired customerView key.");

const b2cStorage = new MemoryStorage();
b2cStorage.set("centrix_admin_system_config_v1", {
  workspaceName: "B2C Workspace",
  businessModel: "B2C",
  enabledModules: { leads: true, contacts: true, organizations: false, customers: true },
});
const b2cConfigRepository = new BrowserWorkspaceConfigRepository(b2cStorage);
assert.equal(b2cConfigRepository.getSnapshot().modules.organizations, false, "Intentional B2C organization hiding must remain supported.");

const targetFamilies = new Set<Capability>([
  CAPABILITIES.ORGANIZATIONS_READ,
  CAPABILITIES.ORGANIZATIONS_CREATE,
  CAPABILITIES.ORGANIZATIONS_UPDATE,
  CAPABILITIES.TASKS_READ,
  CAPABILITIES.TASKS_CREATE,
  CAPABILITIES.TASKS_UPDATE,
  CAPABILITIES.TASKS_ASSIGN,
  CAPABILITIES.TASKS_COMPLETE,
  CAPABILITIES.SHIPPING_READ,
  CAPABILITIES.SHIPPING_CREATE,
  CAPABILITIES.SHIPPING_RETRY,
  CAPABILITIES.SHIPPING_CANCEL,
  CAPABILITIES.SHIPPING_SYNC,
  CAPABILITIES.SHIPPING_MANAGE_PROVIDERS,
  CAPABILITIES.RETURNS_READ,
  CAPABILITIES.RETURNS_CREATE,
  CAPABILITIES.RETURNS_UPDATE,
  CAPABILITIES.RETURNS_APPROVE,
  CAPABILITIES.RETURNS_RESOLVE,
  CAPABILITIES.CUSTOMERS_VIEW,
  CAPABILITIES.CUSTOMERS_EDIT,
  CAPABILITIES.CUSTOMERS_ASSIGN,
  CAPABILITIES.CUSTOMERS_ARCHIVE,
  CAPABILITIES.INVOICES_READ,
  CAPABILITIES.RECEIVABLES_READ,
]);

const freshAdministratorRole = fresh.roles.find((role) => role.sourceTemplateId === "workspace-administrator");
const freshSalesManagerRole = fresh.roles.find((role) => role.sourceTemplateId === "sales-manager");
assert.ok(freshAdministratorRole, "Administrator template-derived role must be seeded.");
assert.ok(freshSalesManagerRole, "Sales Manager template-derived role must be seeded.");

const stale = {
  ...fresh,
  schemaVersion: CURRENT_ACCESS_CONTROL_SCHEMA_VERSION - 1,
  revision: 7,
  roles: [
    ...fresh.roles.map((role) => ({
      ...role,
      capabilities: role.capabilities.filter((capability) => !targetFamilies.has(capability)),
    })),
    {
      roleId: "role_custom_ws_default",
      workspaceId,
      name: "Custom restricted role",
      isActive: true,
      capabilities: [CAPABILITIES.CONTACTS_READ],
    },
  ],
  assignments: [
    ...fresh.assignments,
    { assignmentId: "ra_test_owner", workspaceId, membershipId: "membership_test_owner", roleId: freshAdministratorRole.roleId },
  ],
  dataScopes: fresh.dataScopes.filter((policy) => !["organizations", "tasks", "shipping", "returns", "invoices", "receivables"].includes(policy.resourceKey)),
};

const migrated = migrateStoredAccessControlSnapshot(stale, workspaceId);
assert.equal(migrated.schemaVersion, CURRENT_ACCESS_CONTROL_SCHEMA_VERSION, "Stored access snapshots must be schema-migrated.");
assert.equal(migrated.revision, 8, "Migration must advance the access-control revision once.");

const owner = migrated.roles.find((role) => role.sourceTemplateId === "workspace-administrator");
assert.ok(owner, "Administrator template-derived role must exist after migration.");
for (const capability of [CAPABILITIES.ORGANIZATIONS_READ, CAPABILITIES.TASKS_READ, CAPABILITIES.SHIPPING_READ, CAPABILITIES.RETURNS_READ, CAPABILITIES.CUSTOMERS_VIEW, CAPABILITIES.INVOICES_READ, CAPABILITIES.RECEIVABLES_READ]) {
  assert.ok(owner.capabilities.includes(capability), `Administrator role must regain ${capability} after schema migration.`);
}

const salesManager = migrated.roles.find((role) => role.sourceTemplateId === "sales-manager");
assert.ok(salesManager, "Sales Manager role must exist after migration.");
for (const capability of [CAPABILITIES.ORGANIZATIONS_READ, CAPABILITIES.TASKS_READ, CAPABILITIES.SHIPPING_READ, CAPABILITIES.RETURNS_READ, CAPABILITIES.CUSTOMERS_VIEW]) {
  assert.ok(salesManager.capabilities.includes(capability), `Sales Manager must receive the intended ${capability} capability.`);
}
for (const capability of [CAPABILITIES.CUSTOMERS_EDIT, CAPABILITIES.CUSTOMERS_ASSIGN, CAPABILITIES.CUSTOMERS_ARCHIVE]) {
  assert.equal(salesManager.capabilities.includes(capability), false, `Sales Manager must not receive unsupported ${capability} capability.`);
}

const customRole = migrated.roles.find((role) => role.roleId === "role_custom_ws_default");
assert.deepEqual(customRole?.capabilities, [CAPABILITIES.CONTACTS_READ], "Custom roles must not receive new Customer write capabilities implicitly.");

for (const resourceKey of ["organizations", "tasks", "shipping", "returns", "customers", "invoices", "receivables"]) {
  assert.ok(migrated.dataScopes.some((policy) => policy.roleId === owner.roleId && policy.resourceKey === resourceKey), `Administrator must receive a ${resourceKey} data scope migration.`);
}

const ownerAssignment = migrated.assignments.find((assignment) => assignment.assignmentId === "ra_test_owner");
assert.ok(ownerAssignment, "Owner assignment must exist.");
const access = evaluateEffectiveAccess({
  snapshot: migrated,
  member: { accountId: "acct_admin", memberId: "member_admin", membershipId: ownerAssignment.membershipId, teamIds: [] },
  memberDirectory: [],
});
assert.equal(access.canAccessModule("organizations"), true, "Organizations must be visible after migration.");
assert.equal(access.canAccessModule("tasks"), true, "Tasks must be visible after migration.");
assert.equal(access.canAccessModule("shipping"), true, "Shipping must be visible after migration.");
assert.equal(access.canAccessModule("returns"), true, "Returns must be visible after migration.");
assert.equal(access.canAccessModule("customers"), true, "Customers must be visible after migration.");
assert.equal(access.canAccessModule("invoices"), true, "Invoices must be visible after migration.");
assert.equal(access.canAccessModule("receivables"), true, "Receivables must be visible after migration.");

const appShell = fs.readFileSync(path.join(root, "src/app/shell/layout/AppShell.tsx"), "utf8");
assert.match(appShell, /customers: "customers"/, "AppShell route preservation must recognize the Customers module.");

const sidebar = fs.readFileSync(path.join(root, "src/app/shell/layout/Sidebar.tsx"), "utf8");
for (const label of ["TỔNG QUAN", "LÀM VIỆC", "QUAN HỆ KHÁCH HÀNG", "BÁN HÀNG", "SẢN PHẨM", "VẬN HÀNH ĐƠN HÀNG", "DỊCH VỤ", "PHÂN TÍCH"]) {
  assert.ok(sidebar.includes(`label("${label}"`), `Sidebar must include Vietnamese group ${label}.`);
}
for (const route of ['path("dashboard")', 'path("calendar")', 'path("notifications")', 'path("customers")', 'path("shipping")', 'path("returns")', 'path("tasks")', 'path("reports")']) {
  assert.ok(sidebar.includes(route), `Sidebar must include ${route}.`);
}

for (const item of [
  'path("dashboard"), "Dashboard"',
  'path("calendar"), label("Lịch làm việc", "Work Calendar")',
  'path("notifications"), label("Thông báo", "Notifications")',
  'path("leads"), label("Khách hàng tiềm năng", "Leads")',
  'path("contacts"), label("Người liên hệ", "Contacts")',
  'path("organizations"), label("Tổ chức", "Organizations")',
  'path("customers"), label("Hồ sơ khách hàng", "Customer profiles")',
  'path("deals"), label("Cơ hội", "Deals")',
  'path("quotes"), label("Báo giá", "Quotes")',
  'path("orders"), label("Đơn hàng", "Orders")',
  'path("products"), label("Sản phẩm", "Products")',
  'path("payments"), label("Thanh toán", "Payments")',
  'path("invoices"), label("Hóa đơn", "Invoices")',
  'path("receivables"), label("Công nợ", "Receivables")',
  'path("shipping"), label("Vận đơn", "Shipping")',
  'path("returns"), label("Đổi / Trả hàng", "Returns / Exchanges")',
  'path("support/cases"), label("Phiếu hỗ trợ", "Support Tickets")',
  'path("tasks"), label("Công việc", "Tasks")',
  'path("reports"), label("Báo cáo", "Reports")',
]) {
  assert.ok(sidebar.includes(item), `Sidebar must render locale-aware target item ${item}.`);
}

console.log("Sidebar navigation access migration: PASS");
console.log("- stale B2B workspace/access snapshots restore Organizations, Customers, Invoices and Receivables visibility for canonical system roles");
console.log("- custom roles remain untouched and do not gain Customer write permissions");
console.log("- CRM navigation exposes Dashboard under Overview and keeps Tasks, Calendar and Notifications focused under Work");
console.log("- CRM item labels are locale-aware instead of hardcoded English");
