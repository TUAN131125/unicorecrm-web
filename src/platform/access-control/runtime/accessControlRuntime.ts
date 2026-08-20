import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { recordOperationalAudit } from "@/platform/operational-audit";
import { BrowserStorageAdapter } from "@/platform/persistence";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { getCurrentMembershipForWorkspaceId, listAllDevelopmentMemberships } from "@/platform/workspace-membership";
import type {
  AccessControlSnapshot,
  Capability,
  DataScope,
  EffectiveAccess,
  FieldAccess,
  RoleDefinition,
} from "../domain/accessControl.types";
import { ALL_CAPABILITIES, CAPABILITIES } from "../domain/capabilityCatalog";
import { ROLE_TEMPLATES, getRoleTemplate } from "../domain/roleTemplates";
import { buildDeniedAccess, evaluateEffectiveAccess } from "../domain/evaluateEffectiveAccess";
import { getAuthoritativeEffectiveAccess, isAccessGovernanceRuntimeConfigured } from "../application/accessGovernanceBinding";
import { projectRecordWithAccess } from "../domain/projectRecordWithAccess";
import { createDefaultAccessControlSnapshot } from "./accessControlSeed";
import { migrateStoredAccessControlSnapshot } from "./accessControlMigration";

const VALID_CAPABILITIES = new Set<Capability>(ALL_CAPABILITIES);
type AccessListener = (snapshot: AccessControlSnapshot) => void;
interface AccessAuditEvent {
  action: string;
  recordId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}
interface AccessAuditOptions {
  skipAudit?: boolean;
}
const storage = new BrowserStorageAdapter();
const listeners = new Set<AccessListener>();
const keyFor = (workspaceId: string) => `unicore_access_control_v1:${workspaceId}`;

function cloneSnapshot(snapshot: AccessControlSnapshot): AccessControlSnapshot {
  return {
    ...snapshot,
    roles: snapshot.roles.map((role) => ({ ...role, capabilities: [...role.capabilities] })),
    assignments: snapshot.assignments.map((assignment) => ({ ...assignment })),
    dataScopes: snapshot.dataScopes.map((policy) => ({ ...policy, allowedOwnerIds: policy.allowedOwnerIds ? [...policy.allowedOwnerIds] : undefined })),
    fieldSecurity: snapshot.fieldSecurity.map((policy) => ({ ...policy })),
  };
}

export function assertAccessConfigurationAllowed(workspaceId: string): void {
  if (typeof window === "undefined" || getAuthSessionSnapshot() === null) return;
  if (!resolveEffectiveAccess(workspaceId).can(CAPABILITIES.ACCESS_CONFIGURE)) {
    throw new Error(`Access denied: missing capability ${CAPABILITIES.ACCESS_CONFIGURE}.`);
  }
}

function normalizeCapabilities(capabilities: Capability[]): Capability[] {
  const unknown = capabilities.filter((capability) => !VALID_CAPABILITIES.has(capability));
  if (unknown.length > 0) throw new Error(`Unknown capabilities: ${unknown.join(", ")}`);
  return [...new Set(capabilities)];
}

function requireRole(snapshot: AccessControlSnapshot, roleId: string): RoleDefinition {
  const role = snapshot.roles.find((candidate) => candidate.roleId === roleId);
  if (!role) throw new Error("Role was not found in the active workspace.");
  return role;
}

function roleAssignmentsForMembership(snapshot: AccessControlSnapshot, membershipId: string) {
  return snapshot.assignments.filter((assignment) => assignment.membershipId === membershipId);
}

function assertRoleCanBeRemoved(snapshot: AccessControlSnapshot, roleId: string): void {
  const affectedMembershipIds = [...new Set(snapshot.assignments
    .filter((assignment) => assignment.roleId === roleId)
    .map((assignment) => assignment.membershipId))];
  const orphanedMembershipIds = affectedMembershipIds.filter((membershipId) =>
    roleAssignmentsForMembership(snapshot, membershipId).every((assignment) => assignment.roleId === roleId));
  if (orphanedMembershipIds.length > 0) {
    throw new Error("Reassign members before deleting their only role.");
  }
}

function assertRoleCanBeDeactivated(snapshot: AccessControlSnapshot, roleId: string): void {
  if (snapshot.assignments.some((assignment) => assignment.roleId === roleId)) {
    throw new Error("Reassign members before deactivating a role that is still in use.");
  }
}

function activeMembershipIds(workspaceId: string, snapshot: AccessControlSnapshot): Set<string> {
  const active = listAllDevelopmentMemberships()
    .filter((membership) => membership.workspaceId === workspaceId && membership.status === "active")
    .map((membership) => membership.membershipId)
    .filter((membershipId): membershipId is string => Boolean(membershipId));
  return new Set(active.length > 0 ? active : snapshot.assignments.map((assignment) => assignment.membershipId));
}

function assertAdministratorInvariant(snapshot: AccessControlSnapshot): void {
  const activeMemberships = activeMembershipIds(snapshot.workspaceId, snapshot);
  const administrativeRoleIds = new Set(snapshot.roles
    .filter((role) => role.isActive && role.capabilities.includes(CAPABILITIES.ACCESS_CONFIGURE))
    .map((role) => role.roleId));
  const hasAdministrator = snapshot.assignments.some((assignment) =>
    activeMemberships.has(assignment.membershipId) && administrativeRoleIds.has(assignment.roleId));
  if (!hasAdministrator) {
    throw new Error("At least one active workspace member must retain access.configure.");
  }
}

function persistSnapshot(next: AccessControlSnapshot, before: AccessControlSnapshot, event: AccessAuditEvent): AccessControlSnapshot {
  assertAdministratorInvariant(next);
  const snapshot = cloneSnapshot({ ...next, revision: before.revision + 1 });
  storage.set(keyFor(snapshot.workspaceId), snapshot);
  listeners.forEach((listener) => listener(cloneSnapshot(snapshot)));
  const session = getAuthSessionSnapshot();
  recordOperationalAudit({
    workspaceId: snapshot.workspaceId,
    moduleKey: "access-control",
    recordId: event.recordId,
    action: event.action,
    actorId: session?.principal.accountId ?? "system",
    actorName: session?.principal.displayName,
    ...(event.before !== undefined ? { before: event.before } : {}),
    ...(event.after !== undefined ? { after: event.after } : {}),
    ...(event.reason ? { reason: event.reason } : {}),
  });
  return snapshot;
}

export function getAccessControlSnapshot(workspaceId = getWorkspaceContextSnapshot().workspaceId): AccessControlSnapshot {
  const stored = storage.get<AccessControlSnapshot>(keyFor(workspaceId));
  if (stored && stored.workspaceId === workspaceId) {
    const migrated = migrateStoredAccessControlSnapshot(stored, workspaceId);
    if (migrated !== stored) storage.set(keyFor(workspaceId), migrated);
    return cloneSnapshot(migrated);
  }
  const seeded = createDefaultAccessControlSnapshot(workspaceId);
  storage.set(keyFor(workspaceId), seeded);
  return cloneSnapshot(seeded);
}

export function replaceAccessControlSnapshot(next: AccessControlSnapshot): void {
  assertAccessConfigurationAllowed(next.workspaceId);
  const before = getAccessControlSnapshot(next.workspaceId);
  persistSnapshot(next, before, {
    action: "AccessConfigurationReplaced",
    recordId: next.workspaceId,
    before: { revision: before.revision },
    after: { revision: before.revision + 1 },
  });
}

export function createRoleDefinition(
  input: Pick<RoleDefinition, "name" | "description" | "capabilities"> & { sourceTemplateId?: string },
  workspaceId = getWorkspaceContextSnapshot().workspaceId,
): RoleDefinition {
  assertAccessConfigurationAllowed(workspaceId);
  const before = getAccessControlSnapshot(workspaceId);
  const snapshot = cloneSnapshot(before);
  const name = input.name.trim();
  if (!name) throw new Error("Role name is required.");
  if (snapshot.roles.some((role) => role.name.toLowerCase() === name.toLowerCase())) throw new Error("A role with this name already exists.");
  if (input.sourceTemplateId && !getRoleTemplate(input.sourceTemplateId)) throw new Error("Role template was not found.");
  const role: RoleDefinition = {
    roleId: `role_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    workspaceId,
    name,
    description: input.description?.trim(),
    sourceTemplateId: input.sourceTemplateId,
    isActive: true,
    capabilities: normalizeCapabilities(input.capabilities),
  };
  snapshot.roles.push(role);
  persistSnapshot(snapshot, before, {
    action: "RoleCreated",
    recordId: role.roleId,
    after: { roleId: role.roleId, name: role.name, capabilities: role.capabilities },
  });
  return { ...role, capabilities: [...role.capabilities] };
}

export function createRoleFromTemplate(
  templateId: string,
  input: { name?: string; description?: string } = {},
  workspaceId = getWorkspaceContextSnapshot().workspaceId,
): RoleDefinition {
  const template = getRoleTemplate(templateId);
  if (!template) throw new Error("Role template was not found.");
  return createRoleDefinition({
    name: input.name?.trim() || template.name,
    description: input.description?.trim() || template.description,
    capabilities: [...template.capabilities],
    sourceTemplateId: template.templateId,
  }, workspaceId);
}

export function duplicateRoleDefinition(
  sourceRoleId: string,
  name: string,
  workspaceId = getWorkspaceContextSnapshot().workspaceId,
): RoleDefinition {
  assertAccessConfigurationAllowed(workspaceId);
  const before = getAccessControlSnapshot(workspaceId);
  const snapshot = cloneSnapshot(before);
  const source = requireRole(snapshot, sourceRoleId);
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error("Role name is required.");
  if (snapshot.roles.some((role) => role.name.toLowerCase() === normalizedName.toLowerCase())) throw new Error("A role with this name already exists.");
  const role: RoleDefinition = {
    ...source,
    roleId: `role_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: normalizedName,
    sourceTemplateId: source.sourceTemplateId,
    capabilities: [...source.capabilities],
  };
  snapshot.roles.push(role);
  snapshot.dataScopes.push(...snapshot.dataScopes.filter((policy) => policy.roleId === sourceRoleId).map((policy) => ({
    ...policy,
    policyId: `scope_${role.roleId}_${policy.resourceKey}_${Date.now()}`,
    roleId: role.roleId,
    allowedOwnerIds: policy.allowedOwnerIds ? [...policy.allowedOwnerIds] : undefined,
  })));
  snapshot.fieldSecurity.push(...snapshot.fieldSecurity.filter((policy) => policy.roleId === sourceRoleId).map((policy) => ({
    ...policy,
    policyId: `field_${role.roleId}_${policy.resourceKey}_${policy.fieldKey}_${Date.now()}`,
    roleId: role.roleId,
  })));
  persistSnapshot(snapshot, before, {
    action: "RoleDuplicated",
    recordId: role.roleId,
    before: { sourceRoleId: source.roleId, sourceRoleName: source.name },
    after: { roleId: role.roleId, name: role.name, capabilities: role.capabilities },
  });
  return { ...role, capabilities: [...role.capabilities] };
}

export function deleteRoleDefinition(roleId: string, workspaceId = getWorkspaceContextSnapshot().workspaceId): void {
  assertAccessConfigurationAllowed(workspaceId);
  const before = getAccessControlSnapshot(workspaceId);
  const snapshot = cloneSnapshot(before);
  const removedRole = requireRole(snapshot, roleId);
  assertRoleCanBeRemoved(snapshot, roleId);
  snapshot.roles = snapshot.roles.filter((role) => role.roleId !== roleId);
  snapshot.assignments = snapshot.assignments.filter((assignment) => assignment.roleId !== roleId);
  snapshot.dataScopes = snapshot.dataScopes.filter((policy) => policy.roleId !== roleId);
  snapshot.fieldSecurity = snapshot.fieldSecurity.filter((policy) => policy.roleId !== roleId);
  persistSnapshot(snapshot, before, {
    action: "RoleDeleted",
    recordId: roleId,
    before: { roleId, name: removedRole.name, capabilities: removedRole.capabilities },
  });
}

export function updateRoleCapabilities(roleId: string, capabilities: Capability[], workspaceId = getWorkspaceContextSnapshot().workspaceId): void {
  assertAccessConfigurationAllowed(workspaceId);
  const before = getAccessControlSnapshot(workspaceId);
  const snapshot = cloneSnapshot(before);
  const currentRole = requireRole(snapshot, roleId);
  const nextCapabilities = normalizeCapabilities(capabilities);
  snapshot.roles = snapshot.roles.map((role) => role.roleId === roleId ? { ...role, capabilities: nextCapabilities } : role);
  persistSnapshot(snapshot, before, {
    action: "RolePermissionsChanged",
    recordId: roleId,
    before: { roleId, roleName: currentRole.name, capabilities: currentRole.capabilities },
    after: { roleId, roleName: currentRole.name, capabilities: nextCapabilities },
  });
}

export function updateRoleDefinition(roleId: string, patch: Partial<Pick<RoleDefinition, "name" | "description" | "isActive">>, workspaceId = getWorkspaceContextSnapshot().workspaceId): void {
  assertAccessConfigurationAllowed(workspaceId);
  const before = getAccessControlSnapshot(workspaceId);
  const snapshot = cloneSnapshot(before);
  requireRole(snapshot, roleId);
  const name = patch.name?.trim();
  if (patch.name !== undefined && !name) throw new Error("Role name is required.");
  if (name && snapshot.roles.some((role) => role.roleId !== roleId && role.name.toLowerCase() === name.toLowerCase())) throw new Error("A role with this name already exists.");
  const currentRole = requireRole(snapshot, roleId);
  if (patch.isActive === false && currentRole.isActive) assertRoleCanBeDeactivated(snapshot, roleId);
  const nextRole = {
    ...currentRole,
    ...patch,
    name: name ?? currentRole.name,
    description: patch.description !== undefined ? patch.description.trim() : currentRole.description,
  };
  snapshot.roles = snapshot.roles.map((role) => role.roleId === roleId ? {
    ...role,
    ...patch,
    name: name ?? role.name,
    description: patch.description !== undefined ? patch.description.trim() : role.description,
  } : role);
  persistSnapshot(snapshot, before, {
    action: "RoleUpdated",
    recordId: roleId,
    before: { roleId, name: currentRole.name, description: currentRole.description, isActive: currentRole.isActive },
    after: { roleId, name: nextRole.name, description: nextRole.description, isActive: nextRole.isActive },
  });
}

export function updateDataScope(
  roleId: string,
  resourceKey: string,
  scope: DataScope,
  workspaceId = getWorkspaceContextSnapshot().workspaceId,
  allowedOwnerIds?: string[],
): void {
  assertAccessConfigurationAllowed(workspaceId);
  const before = getAccessControlSnapshot(workspaceId);
  const snapshot = cloneSnapshot(before);
  requireRole(snapshot, roleId);
  const normalizedOwnerIds = [...new Set((allowedOwnerIds ?? []).filter(Boolean))];
  if (scope === "CUSTOM" && normalizedOwnerIds.length === 0) throw new Error("CUSTOM scope requires at least one allowed owner.");
  const existing = snapshot.dataScopes.find((policy) => policy.roleId === roleId && policy.resourceKey === resourceKey);
  const previousPolicy = existing ? { ...existing, allowedOwnerIds: existing.allowedOwnerIds ? [...existing.allowedOwnerIds] : undefined } : undefined;
  if (existing) {
    existing.scope = scope;
    existing.allowedOwnerIds = scope === "CUSTOM" ? normalizedOwnerIds : undefined;
  } else {
    snapshot.dataScopes.push({
      policyId: `scope_${roleId}_${resourceKey}_${Date.now()}`,
      workspaceId,
      roleId,
      resourceKey,
      scope,
      allowedOwnerIds: scope === "CUSTOM" ? normalizedOwnerIds : undefined,
    });
  }
  const nextPolicy = snapshot.dataScopes.find((policy) => policy.roleId === roleId && policy.resourceKey === resourceKey);
  persistSnapshot(snapshot, before, {
    action: "RoleDataScopeChanged",
    recordId: roleId,
    before: previousPolicy,
    after: nextPolicy,
  });
}

export function updateFieldSecurity(roleId: string, resourceKey: string, fieldKey: string, access: FieldAccess, workspaceId = getWorkspaceContextSnapshot().workspaceId): void {
  assertAccessConfigurationAllowed(workspaceId);
  const before = getAccessControlSnapshot(workspaceId);
  const snapshot = cloneSnapshot(before);
  requireRole(snapshot, roleId);
  const existing = snapshot.fieldSecurity.find((policy) => policy.roleId === roleId && policy.resourceKey === resourceKey && policy.fieldKey === fieldKey);
  const previousPolicy = existing ? { ...existing } : undefined;
  if (existing) existing.access = access;
  else snapshot.fieldSecurity.push({ policyId: `field_${roleId}_${resourceKey}_${fieldKey}_${Date.now()}`, workspaceId, roleId, resourceKey, fieldKey, access });
  const nextPolicy = snapshot.fieldSecurity.find((policy) => policy.roleId === roleId && policy.resourceKey === resourceKey && policy.fieldKey === fieldKey);
  persistSnapshot(snapshot, before, {
    action: "RoleFieldAccessChanged",
    recordId: roleId,
    before: previousPolicy,
    after: nextPolicy,
  });
}

export function addRoleAssignment(membershipId: string, roleId: string, workspaceId = getWorkspaceContextSnapshot().workspaceId): void {
  assertAccessConfigurationAllowed(workspaceId);
  const before = getAccessControlSnapshot(workspaceId);
  const snapshot = cloneSnapshot(before);
  const role = requireRole(snapshot, roleId);
  if (!role.isActive) throw new Error("Inactive roles cannot be assigned.");
  const previousRoleIds = roleAssignmentsForMembership(snapshot, membershipId).map((assignment) => assignment.roleId);
  if (!snapshot.assignments.some((assignment) => assignment.membershipId === membershipId && assignment.roleId === roleId)) {
    snapshot.assignments.push({ assignmentId: `ra_${membershipId}_${roleId}_${Date.now()}`, workspaceId, membershipId, roleId });
  }
  persistSnapshot(snapshot, before, {
    action: "MemberRolesChanged",
    recordId: membershipId,
    before: { membershipId, roleIds: previousRoleIds },
    after: { membershipId, roleIds: roleAssignmentsForMembership(snapshot, membershipId).map((assignment) => assignment.roleId) },
  });
}

export function removeRoleAssignment(membershipId: string, roleId: string, workspaceId = getWorkspaceContextSnapshot().workspaceId): void {
  assertAccessConfigurationAllowed(workspaceId);
  const before = getAccessControlSnapshot(workspaceId);
  const snapshot = cloneSnapshot(before);
  const assignments = roleAssignmentsForMembership(snapshot, membershipId);
  const previousRoleIds = assignments.map((assignment) => assignment.roleId);
  if (assignments.some((assignment) => assignment.roleId === roleId) && assignments.length <= 1) {
    throw new Error("A workspace member must retain at least one role.");
  }
  snapshot.assignments = snapshot.assignments.filter((assignment) => !(assignment.membershipId === membershipId && assignment.roleId === roleId));
  persistSnapshot(snapshot, before, {
    action: "MemberRolesChanged",
    recordId: membershipId,
    before: { membershipId, roleIds: previousRoleIds },
    after: { membershipId, roleIds: roleAssignmentsForMembership(snapshot, membershipId).map((assignment) => assignment.roleId) },
  });
}

export function replaceRoleAssignments(
  membershipId: string,
  roleIds: string[],
  workspaceId = getWorkspaceContextSnapshot().workspaceId,
  auditOptions: AccessAuditOptions = {},
): void {
  assertAccessConfigurationAllowed(workspaceId);
  const before = getAccessControlSnapshot(workspaceId);
  const snapshot = cloneSnapshot(before);
  const previousRoleIds = roleAssignmentsForMembership(snapshot, membershipId).map((assignment) => assignment.roleId);
  const normalizedRoleIds = [...new Set(roleIds)];
  if (normalizedRoleIds.length === 0) throw new Error("A workspace member must have at least one role.");
  for (const roleId of normalizedRoleIds) {
    const role = requireRole(snapshot, roleId);
    if (!role.isActive) throw new Error(`Inactive role cannot be assigned: ${role.name}.`);
  }
  snapshot.assignments = snapshot.assignments.filter((assignment) => assignment.membershipId !== membershipId);
  snapshot.assignments.push(...normalizedRoleIds.map((roleId, index) => ({
    assignmentId: `ra_${membershipId}_${roleId}_${Date.now()}_${index}`,
    workspaceId,
    membershipId,
    roleId,
  })));
  if (auditOptions.skipAudit) {
    assertAdministratorInvariant(snapshot);
    const persisted = cloneSnapshot({ ...snapshot, revision: before.revision + 1 });
    storage.set(keyFor(persisted.workspaceId), persisted);
    listeners.forEach((listener) => listener(cloneSnapshot(persisted)));
  } else {
    persistSnapshot(snapshot, before, {
      action: "MemberRolesChanged",
      recordId: membershipId,
      before: { membershipId, roleIds: previousRoleIds },
      after: { membershipId, roleIds: normalizedRoleIds },
    });
  }
}

/** Compatibility helper for callers that intentionally want exactly one role. */
export function assignRoleToMembership(membershipId: string, roleId: string, workspaceId = getWorkspaceContextSnapshot().workspaceId): void {
  replaceRoleAssignments(membershipId, [roleId], workspaceId);
}

export function assertMembershipStatusChangeAllowed(
  membershipId: string,
  nextStatus: "active" | "suspended",
  workspaceId = getWorkspaceContextSnapshot().workspaceId,
): void {
  assertAccessConfigurationAllowed(workspaceId);
  if (nextStatus === "active") return;
  const snapshot = getAccessControlSnapshot(workspaceId);
  const remainingActiveMemberships = activeMembershipIds(workspaceId, snapshot);
  remainingActiveMemberships.delete(membershipId);
  const administrativeRoleIds = new Set(snapshot.roles
    .filter((role) => role.isActive && role.capabilities.includes(CAPABILITIES.ACCESS_CONFIGURE))
    .map((role) => role.roleId));
  const hasAnotherAdministrator = snapshot.assignments.some((assignment) =>
    remainingActiveMemberships.has(assignment.membershipId) && administrativeRoleIds.has(assignment.roleId));
  if (!hasAnotherAdministrator) {
    throw new Error("At least one other active workspace member must retain access.configure before this member can be suspended.");
  }
}

export function subscribeToAccessControl(listener: AccessListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resolveEffectiveAccess(workspaceId = getWorkspaceContextSnapshot().workspaceId): EffectiveAccess {
  const authoritative = getAuthoritativeEffectiveAccess(workspaceId);
  if (authoritative) return authoritative;
  if (isAccessGovernanceRuntimeConfigured()) return buildDeniedAccess(workspaceId);
  return resolveLocalEffectiveAccess(workspaceId);
}

/** Evaluates the local development snapshot while the demo governance adapter bootstraps. */
export function resolveLocalEffectiveAccess(workspaceId = getWorkspaceContextSnapshot().workspaceId): EffectiveAccess {
  const session = getAuthSessionSnapshot();
  const membership = getCurrentMembershipForWorkspaceId(workspaceId);
  if (!session || !membership || membership.status !== "active" || !membership.membershipId || !membership.memberId || !membership.accountId) {
    return buildDeniedAccess(workspaceId);
  }
  return evaluateEffectiveAccess({
    snapshot: getAccessControlSnapshot(workspaceId),
    member: {
      accountId: membership.accountId,
      memberId: membership.memberId,
      membershipId: membership.membershipId,
      teamIds: membership.teamIds || [],
    },
    memberDirectory: listAllDevelopmentMemberships()
      .filter((candidate) => candidate.workspaceId === workspaceId && candidate.membershipId && candidate.memberId && candidate.accountId)
      .map((candidate) => ({
        accountId: candidate.accountId!,
        memberId: candidate.memberId!,
        membershipId: candidate.membershipId!,
        teamIds: candidate.teamIds || [],
      })),
  });
}
export function can(capability: Capability): boolean { return resolveEffectiveAccess().can(capability); }
export function canAccessModule(moduleKey: string): boolean { return resolveEffectiveAccess().canAccessModule(moduleKey); }
export function canPerform(moduleKey: string, action: string): boolean { return resolveEffectiveAccess().canPerform(moduleKey, action); }
export function getDataScope(resourceKey: string): DataScope { return resolveEffectiveAccess().getDataScope(resourceKey); }
export function canAccessRecord(resourceKey: string, record: unknown): boolean { return resolveEffectiveAccess().canAccessRecord(resourceKey, record); }
export function getFieldAccess(resourceKey: string, fieldKey: string): FieldAccess { return resolveEffectiveAccess().getFieldAccess(resourceKey, fieldKey); }
export function projectAuthorizedRecord<T extends Record<string, unknown>>(resourceKey: string, record: T): T | null {
  return projectRecordWithAccess(resolveEffectiveAccess(), resourceKey, record);
}
export { ROLE_TEMPLATES };
