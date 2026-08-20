export type Capability = string;
export type DataScope = "OWN" | "TEAM" | "WORKSPACE" | "CUSTOM";
export type FieldAccess = "READ_WRITE" | "READ_ONLY" | "MASKED" | "HIDDEN";

export interface RoleTemplate {
  templateId: string;
  name: string;
  description: string;
  capabilities: Capability[];
  defaultScope: Exclude<DataScope, "CUSTOM">;
}

export interface RoleDefinition {
  roleId: string;
  workspaceId: string;
  name: string;
  description?: string;
  sourceTemplateId?: string;
  isActive: boolean;
  capabilities: Capability[];
  /** Authoritative resource version in connected mode. */
  version?: number;
}

export interface RoleAssignment {
  assignmentId: string;
  workspaceId: string;
  membershipId: string;
  roleId: string;
}

export interface DataScopePolicy {
  policyId: string;
  workspaceId: string;
  roleId: string;
  resourceKey: string;
  scope: DataScope;
  allowedOwnerIds?: string[];
}

export interface FieldSecurityPolicy {
  policyId: string;
  workspaceId: string;
  roleId: string;
  resourceKey: string;
  fieldKey: string;
  access: FieldAccess;
}

export interface AccessControlSnapshot {
  workspaceId: string;
  schemaVersion?: number;
  roles: RoleDefinition[];
  assignments: RoleAssignment[];
  dataScopes: DataScopePolicy[];
  fieldSecurity: FieldSecurityPolicy[];
  revision: number;
}

export interface EffectiveAccess {
  workspaceId: string;
  membershipId: string;
  memberId: string;
  accountId: string;
  roleIds: ReadonlySet<string>;
  roleTemplateIds: ReadonlySet<string>;
  capabilities: ReadonlySet<Capability>;
  productSpaces: ReadonlySet<"crm" | "studio" | "people">;
  can: (capability: Capability) => boolean;
  canAccessModule: (moduleKey: string) => boolean;
  canPerform: (moduleKey: string, action: string) => boolean;
  getDataScope: (resourceKey: string) => DataScope;
  canAccessRecord: (resourceKey: string, record: unknown) => boolean;
  getFieldAccess: (resourceKey: string, fieldKey: string) => FieldAccess;
}
