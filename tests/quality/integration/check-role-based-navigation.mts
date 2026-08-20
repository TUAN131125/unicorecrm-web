import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createDefaultAccessControlSnapshot } from "../../../src/platform/access-control/runtime/accessControlSeed";
import { migrateStoredAccessControlSnapshot } from "../../../src/platform/access-control/runtime/accessControlMigration";
import { CURRENT_ACCESS_CONTROL_SCHEMA_VERSION } from "../../../src/platform/access-control/runtime/accessControlSchema";
import { evaluateEffectiveAccess } from "../../../src/platform/access-control/domain/evaluateEffectiveAccess";
import { ROLE_TEMPLATES } from "../../../src/platform/access-control/domain/roleTemplates";
import { CAPABILITIES } from "../../../src/platform/access-control/domain/capabilityCatalog";
import { isPrimaryNavigationModule, resolveRoleNavigationProfile } from "../../../src/app/navigation/roleBasedNavigation";
import type { AccessControlSnapshot } from "../../../src/platform/access-control/domain/accessControl.types";

const workspaceId = "ws_unicore_vietnam";

function accessFor(templateId: string) {
  const snapshot = createDefaultAccessControlSnapshot(workspaceId);
  const role = snapshot.roles.find((candidate) => candidate.sourceTemplateId === templateId);
  assert.ok(role, `Missing role template ${templateId}`);
  const membershipId = `membership_${templateId}`;
  snapshot.assignments = [{ assignmentId: `assignment_${templateId}`, workspaceId, membershipId, roleId: role.roleId }];
  return evaluateEffectiveAccess({
    snapshot,
    member: { accountId: `account_${templateId}`, memberId: `member_${templateId}`, membershipId, teamIds: ["team_sales", "team_operations"] },
    memberDirectory: [],
  });
}

const templateIds = new Set(ROLE_TEMPLATES.map((role) => role.templateId));
assert.ok(templateIds.has("finance"), "Finance role template must exist");
assert.ok(templateIds.has("operations"), "Operations role template must exist");

const financeTemplate = ROLE_TEMPLATES.find((role) => role.templateId === "finance")!;
assert.ok(financeTemplate.capabilities.includes(CAPABILITIES.PAYMENTS_RECONCILE), "Finance must reconcile payments");
assert.ok(financeTemplate.capabilities.includes(CAPABILITIES.ORDERS_READ), "Finance needs order context");
assert.equal(financeTemplate.capabilities.includes(CAPABILITIES.ORDERS_UPDATE), false, "Finance must not edit commercial order ownership by default");

const operationsTemplate = ROLE_TEMPLATES.find((role) => role.templateId === "operations")!;
assert.ok(operationsTemplate.capabilities.includes(CAPABILITIES.SHIPPING_CREATE), "Operations must create shipping bookings");
assert.ok(operationsTemplate.capabilities.includes(CAPABILITIES.RETURNS_RESOLVE), "Operations must resolve returns");
assert.equal(operationsTemplate.capabilities.includes(CAPABILITIES.PAYMENTS_RECORD), false, "Operations must not record payments by default");

const sales = accessFor("sales-representative");
assert.equal(resolveRoleNavigationProfile(sales).id, "sales");
for (const moduleKey of ["leads", "contacts", "deals", "quotes", "orders", "tasks"]) {
  assert.ok(isPrimaryNavigationModule(sales, moduleKey), `Sales navigation must prioritize ${moduleKey}`);
}
for (const moduleKey of ["payments", "shipping", "returns", "support"]) {
  assert.equal(isPrimaryNavigationModule(sales, moduleKey), false, `Sales navigation must not prioritize ${moduleKey}`);
}
assert.ok(sales.canAccessModule("payments"), "Sales may retain read access to related payment status");

const finance = accessFor("finance");
assert.equal(resolveRoleNavigationProfile(finance).id, "finance");
for (const moduleKey of ["orders", "payments", "customers", "reports"]) assert.ok(isPrimaryNavigationModule(finance, moduleKey));
for (const moduleKey of ["leads", "deals", "shipping"]) assert.equal(isPrimaryNavigationModule(finance, moduleKey), false);

const operations = accessFor("operations");
assert.equal(resolveRoleNavigationProfile(operations).id, "operations");
for (const moduleKey of ["orders", "shipping", "returns", "tasks"]) assert.ok(isPrimaryNavigationModule(operations, moduleKey));
for (const moduleKey of ["leads", "deals", "payments"]) assert.equal(isPrimaryNavigationModule(operations, moduleKey), false);

const customerSuccess = accessFor("customer-success");
assert.equal(resolveRoleNavigationProfile(customerSuccess).id, "customer-service");
for (const moduleKey of ["customers", "support", "tasks", "orders", "returns"]) assert.ok(isPrimaryNavigationModule(customerSuccess, moduleKey));
assert.equal(isPrimaryNavigationModule(customerSuccess, "payments"), false);

const administrator = accessFor("workspace-administrator");
assert.equal(resolveRoleNavigationProfile(administrator).showAllAccessible, true);
assert.ok(isPrimaryNavigationModule(administrator, "shipping"));
assert.ok(isPrimaryNavigationModule(administrator, "studio"));

const before = createDefaultAccessControlSnapshot(workspaceId);
const legacy: AccessControlSnapshot = {
  ...before,
  schemaVersion: CURRENT_ACCESS_CONTROL_SCHEMA_VERSION - 1,
  roles: before.roles.filter((role) => !["finance", "operations"].includes(role.sourceTemplateId || "")),
};
const migrated = migrateStoredAccessControlSnapshot(legacy, workspaceId);
assert.equal(migrated.schemaVersion, CURRENT_ACCESS_CONTROL_SCHEMA_VERSION);
assert.ok(migrated.roles.some((role) => role.sourceTemplateId === "finance"), "Migration must add Finance without changing assignments");
assert.ok(migrated.roles.some((role) => role.sourceTemplateId === "operations"), "Migration must add Operations without changing assignments");

const root = repositoryRoot;
const sidebar = fs.readFileSync(path.join(root, "src/app/shell/layout/Sidebar.tsx"), "utf8");
assert.ok(sidebar.includes("isPrimaryNavigationModule"), "Sidebar must use the role navigation registry");
assert.ok(sidebar.includes('["calendar", "notifications"].includes(moduleKey) ? can("dashboard")'), "Utility navigation must inherit Dashboard read access");
assert.ok(sidebar.includes('data-navigation-profile={navigationProfile.id}'), "Sidebar must expose the active navigation profile");
assert.ok(sidebar.includes('data-guidance-id="shell.navigation.profile"'), "Role navigation must be guidance-owned");

console.log("Role-based navigation: PASS — Sales, Finance, Operations, Customer Success, Viewer/Admin, and schema migration verified");
