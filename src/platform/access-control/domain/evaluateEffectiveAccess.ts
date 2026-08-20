import { capabilityForAction, readCapabilityForModule } from "./capabilityCatalog";
import type { AccessControlSnapshot, DataScope, EffectiveAccess, FieldAccess } from "./accessControl.types";

export interface AccessMemberDescriptor {
  accountId: string;
  memberId: string;
  membershipId: string;
  teamIds: string[];
}

export interface AccessEvaluationInput {
  snapshot: AccessControlSnapshot;
  member: AccessMemberDescriptor;
  memberDirectory: AccessMemberDescriptor[];
}

const scopeRank: Record<DataScope, number> = { CUSTOM: 0, OWN: 1, TEAM: 2, WORKSPACE: 3 };
const fieldRank: Record<FieldAccess, number> = { HIDDEN: 0, MASKED: 1, READ_ONLY: 2, READ_WRITE: 3 };

function recordWorkspaceId(record: unknown): string | undefined {
  if (!record || typeof record !== "object") return undefined;
  const value = record as Record<string, unknown>;
  return typeof value.workspaceId === "string" && value.workspaceId.length > 0 ? value.workspaceId : undefined;
}

function recordOwnerIds(record: unknown): string[] {
  if (!record || typeof record !== "object") return [];
  const value = record as Record<string, unknown>;
  return [value.ownerId, value.assigneeId, value.createdBy, value.assignedTo]
    .filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0);
}

function recordTeamIds(record: unknown): string[] {
  if (!record || typeof record !== "object") return [];
  const value = record as Record<string, unknown>;
  const direct = [value.teamId, value.assignedTeam]
    .filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0);
  const many = Array.isArray(value.teamIds)
    ? value.teamIds.filter((candidate): candidate is string => typeof candidate === "string")
    : [];
  return [...direct, ...many];
}

export function buildDeniedAccess(workspaceId: string): EffectiveAccess {
  return {
    workspaceId,
    membershipId: "",
    memberId: "",
    accountId: "",
    roleIds: new Set(),
    roleTemplateIds: new Set(),
    capabilities: new Set(),
    productSpaces: new Set(),
    can: () => false,
    canAccessModule: () => false,
    canPerform: () => false,
    getDataScope: () => "CUSTOM",
    canAccessRecord: () => false,
    getFieldAccess: () => "HIDDEN",
  };
}

export function evaluateEffectiveAccess({ snapshot, member, memberDirectory }: AccessEvaluationInput): EffectiveAccess {
  const assignments = snapshot.assignments.filter((assignment) => assignment.membershipId === member.membershipId);
  const roleIds = new Set(assignments.map((assignment) => assignment.roleId));
  const roles = snapshot.roles.filter((role) => roleIds.has(role.roleId) && role.isActive);
  const capabilities = new Set(roles.flatMap((role) => role.capabilities));
  const roleTemplateIds = new Set(roles.map((role) => role.sourceTemplateId).filter((value): value is string => Boolean(value)));
  const productSpaces = new Set<"crm" | "studio" | "people">();

  if ([...capabilities].some((capability) => !capability.startsWith("studio.") && !capability.startsWith("access.") && !capability.startsWith("audit."))) productSpaces.add("crm");
  if (capabilities.has("studio.read") || capabilities.has("studio.configure")) productSpaces.add("studio");
  if (capabilities.has("access.read") || capabilities.has("access.configure") || capabilities.has("audit.read")) productSpaces.add("people");

  const getDataScope = (resourceKey: string): DataScope => {
    const policies = snapshot.dataScopes.filter((policy) => roleIds.has(policy.roleId) && policy.resourceKey === resourceKey);
    if (policies.length === 0) return "CUSTOM";
    return [...policies].sort((a, b) => scopeRank[b.scope] - scopeRank[a.scope])[0].scope;
  };

  const canAccessRecord = (resourceKey: string, record: unknown): boolean => {
    const workspaceId = recordWorkspaceId(record);
    if (workspaceId && workspaceId !== snapshot.workspaceId) return false;
    const readCapability = readCapabilityForModule(resourceKey) || `${resourceKey}.read`;
    if (!capabilities.has(readCapability)) return false;

    const policies = snapshot.dataScopes.filter((policy) => roleIds.has(policy.roleId) && policy.resourceKey === resourceKey);
    if (policies.some((policy) => policy.scope === "WORKSPACE")) return true;

    const ownerIds = recordOwnerIds(record);
    if (policies.some((policy) => policy.scope === "OWN") && ownerIds.includes(member.memberId)) return true;

    if (policies.some((policy) => policy.scope === "TEAM")) {
      const directTeams = recordTeamIds(record);
      if (directTeams.some((teamId) => member.teamIds.includes(teamId))) return true;
      const ownerMembers = memberDirectory.filter((candidate) => ownerIds.includes(candidate.memberId));
      if (ownerMembers.some((candidate) => candidate.teamIds.some((teamId) => member.teamIds.includes(teamId)))) return true;
    }

    return policies.some((policy) => policy.scope === "CUSTOM"
      && (policy.allowedOwnerIds || []).some((ownerId) => ownerIds.includes(ownerId)));
  };

  const getFieldAccess = (resourceKey: string, fieldKey: string): FieldAccess => {
    const policies = snapshot.fieldSecurity.filter((policy) => roleIds.has(policy.roleId) && policy.resourceKey === resourceKey && policy.fieldKey === fieldKey);
    if (policies.length === 0) return "READ_WRITE";
    return [...policies].sort((a, b) => fieldRank[a.access] - fieldRank[b.access])[0].access;
  };

  return {
    workspaceId: snapshot.workspaceId,
    membershipId: member.membershipId,
    memberId: member.memberId,
    accountId: member.accountId,
    roleIds,
    roleTemplateIds,
    capabilities,
    productSpaces,
    can: (capability) => capabilities.has(capability),
    canAccessModule: (moduleKey) => {
      const capability = readCapabilityForModule(moduleKey);
      return capability ? capabilities.has(capability) : false;
    },
    canPerform: (moduleKey, action) => {
      const capability = capabilityForAction(moduleKey, action);
      return capability ? capabilities.has(capability) : false;
    },
    getDataScope,
    canAccessRecord,
    getFieldAccess,
  };
}
