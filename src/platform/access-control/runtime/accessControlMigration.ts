import { CAPABILITIES, SERVER_ADMITTED_WORKSPACE_CAPABILITIES } from "../domain/capabilityCatalog";
import { getRoleTemplate } from "../domain/roleTemplates";
import type { AccessControlSnapshot, Capability, DataScopePolicy, RoleDefinition } from "../domain/accessControl.types";
import { createDefaultAccessControlSnapshot } from "./accessControlSeed";
import { CURRENT_ACCESS_CONTROL_SCHEMA_VERSION } from "./accessControlSchema";

const LEGACY_CUSTOMER_CAPABILITY_MAP: Record<string, Capability> = {
  "customer_view.read": CAPABILITIES.CUSTOMERS_VIEW,
  "customer_view.export": CAPABILITIES.CUSTOMERS_VIEW,
};

const RESOURCE_KEYS = ["leads", "contacts", "organizations", "tasks", "customers", "deals", "quotes", "orders", "products", "support", "payments", "invoices", "receivables", "shipping", "returns"];

function inferTemplateId(role: RoleDefinition): string | undefined {
  if (role.sourceTemplateId) return role.sourceTemplateId;
  const seededRoleId = role.roleId.toLowerCase();
  return ["workspace-administrator", "sales-manager", "sales-representative", "finance", "operations", "customer-success", "support", "viewer"]
    .find((templateId) => seededRoleId.startsWith(`role_${templateId.replaceAll("-", "_")}_`));
}

type StoredRoleDefinition = RoleDefinition & { isSystem?: boolean };

function migrateRole(role: StoredRoleDefinition): RoleDefinition {
  const sourceTemplateId = inferTemplateId(role);
  const template = sourceTemplateId ? getRoleTemplate(sourceTemplateId) : undefined;
  const migratedCapabilities = role.capabilities.map((capability) => LEGACY_CUSTOMER_CAPABILITY_MAP[capability] ?? capability);
  const capabilities = sourceTemplateId === "workspace-administrator"
    ? [...SERVER_ADMITTED_WORKSPACE_CAPABILITIES]
    : [...new Set([...(template?.capabilities ?? []), ...migratedCapabilities])];
  const { isSystem: _legacyIsSystem, ...canonicalRole } = role;
  return {
    ...canonicalRole,
    sourceTemplateId,
    isActive: true,
    capabilities,
  };
}

function migrateDataScopes(stored: AccessControlSnapshot, roles: RoleDefinition[]): DataScopePolicy[] {
  const migrated = stored.dataScopes.map((policy) => policy.resourceKey === "customer_view"
    ? { ...policy, resourceKey: "customers" }
    : { ...policy, allowedOwnerIds: policy.allowedOwnerIds ? [...policy.allowedOwnerIds] : undefined });
  const existing = new Set(migrated.map((policy) => `${policy.roleId}:${policy.resourceKey}`));

  for (const role of roles) {
    const template = role.sourceTemplateId ? getRoleTemplate(role.sourceTemplateId) : undefined;
    for (const resourceKey of RESOURCE_KEYS) {
      const key = `${role.roleId}:${resourceKey}`;
      if (existing.has(key)) continue;
      migrated.push({
        policyId: `scope_${role.roleId}_${resourceKey}`,
        workspaceId: stored.workspaceId,
        roleId: role.roleId,
        resourceKey,
        scope: template?.defaultScope ?? "OWN",
      });
      existing.add(key);
    }
  }
  return migrated;
}

export function migrateStoredAccessControlSnapshot(stored: AccessControlSnapshot, workspaceId: string): AccessControlSnapshot {
  if (stored.workspaceId !== workspaceId) return stored;
  if ((stored.schemaVersion ?? 1) >= CURRENT_ACCESS_CONTROL_SCHEMA_VERSION) return stored;

  const defaults = createDefaultAccessControlSnapshot(workspaceId);
  const roles = (stored.roles as StoredRoleDefinition[]).map(migrateRole);
  const existingTemplateIds = new Set(roles.map((role) => role.sourceTemplateId).filter(Boolean));
  for (const defaultRole of defaults.roles) {
    if (!defaultRole.sourceTemplateId || existingTemplateIds.has(defaultRole.sourceTemplateId)) continue;
    roles.push({ ...defaultRole, capabilities: [...defaultRole.capabilities] });
    existingTemplateIds.add(defaultRole.sourceTemplateId);
  }
  let administratorRole = roles.find((role) => role.sourceTemplateId === "workspace-administrator");
  if (!administratorRole) {
    const seededAdministrator = defaults.roles.find((role) => role.sourceTemplateId === "workspace-administrator");
    if (seededAdministrator) {
      administratorRole = { ...seededAdministrator, capabilities: [...SERVER_ADMITTED_WORKSPACE_CAPABILITIES] };
      roles.push(administratorRole);
    }
  }

  const assignments = stored.assignments.map((assignment) => ({ ...assignment }));
  const adminMembershipId = `m_admin_${workspaceId}`;
  if (administratorRole && !assignments.some((assignment) => assignment.membershipId === adminMembershipId && assignment.roleId === administratorRole?.roleId)) {
    assignments.push({
      assignmentId: `ra_admin_${workspaceId}_${Date.now()}`,
      workspaceId,
      membershipId: adminMembershipId,
      roleId: administratorRole.roleId,
    });
  }

  return {
    ...stored,
    roles,
    assignments,
    dataScopes: migrateDataScopes(stored, roles),
    fieldSecurity: stored.fieldSecurity.map((policy) => ({ ...policy })),
    schemaVersion: CURRENT_ACCESS_CONTROL_SCHEMA_VERSION,
    revision: stored.revision + 1,
  };
}
