export type * from "./domain/accessControl.types";
export { CAPABILITIES, ALL_CAPABILITIES, readCapabilityForModule, capabilityForAction } from "./domain/capabilityCatalog";
export { evaluateEffectiveAccess, buildDeniedAccess } from "./domain/evaluateEffectiveAccess";
export { ROLE_TEMPLATES, getRoleTemplate } from "./domain/roleTemplates";
export { projectRecordWithAccess } from "./domain/projectRecordWithAccess";
export type { AccessEvaluationInput, AccessMemberDescriptor } from "./domain/evaluateEffectiveAccess";
export {
  assertAccessConfigurationAllowed,
  assertMembershipStatusChangeAllowed,
  getAccessControlSnapshot,
  replaceAccessControlSnapshot,
  createRoleDefinition,
  createRoleFromTemplate,
  duplicateRoleDefinition,
  deleteRoleDefinition,
  updateRoleCapabilities,
  updateRoleDefinition,
  updateDataScope,
  updateFieldSecurity,
  assignRoleToMembership,
  addRoleAssignment,
  removeRoleAssignment,
  replaceRoleAssignments,
  subscribeToAccessControl,
  resolveEffectiveAccess,
  can,
  canAccessModule,
  canPerform,
  getDataScope,
  canAccessRecord,
  getFieldAccess,
  projectAuthorizedRecord,
} from "./runtime/accessControlRuntime";
export { useEffectiveAccess } from "./react/useEffectiveAccess";
export { assertRuntimeCapability, assertRuntimeRecordAccess, assertRuntimeCommandAccess, assertRuntimeWorkspaceAccess } from "./runtime/runtimeCommandAuthorization";
export type * from "./application/effectiveRecordAccess";
export {
  configureEffectiveRecordAccessAuthority,
  getEffectiveRecordAccessAuthority,
  resetEffectiveRecordAccessAuthority,
  isEffectiveRecordAccessAuthorityConfigured,
} from "./application/effectiveRecordAccessBinding";
export { HttpEffectiveRecordAccessAuthority } from "./infrastructure/HttpEffectiveRecordAccessAuthority";
export { useEffectiveRecordAccess } from "./react/useEffectiveRecordAccess";
export type { UseEffectiveRecordAccessInput } from "./react/useEffectiveRecordAccess";
export { EffectiveRecordAccessBoundary, useEffectiveRecordAccessDecision } from "./react/EffectiveRecordAccessBoundary";
export { EFFECTIVE_RECORD_ACCESS_PROFILES } from "./domain/effectiveRecordAccessCatalog";
export type { EffectiveRecordAccessProfile } from "./domain/effectiveRecordAccessCatalog";
export { EffectiveFieldAccessScope } from "./react/EffectiveFieldAccessScope";
export type { EffectiveFieldAccessScopeProps } from "./react/EffectiveFieldAccessScope";
export type * from "./domain/accessGovernance.types";
export type { AccessGovernanceGateway } from "./application/AccessGovernanceGateway";
export {
  configureAccessGovernanceRuntime,
  resetAccessGovernanceRuntime,
  isAccessGovernanceRuntimeConfigured,
  getAccessGovernanceRuntimeBinding,
} from "./application/accessGovernanceBinding";
export { AccessGovernanceHttpAdapter } from "./infrastructure/AccessGovernanceHttpAdapter";
export {
  configureDefaultAccessGovernanceRuntime,
  resetDefaultAccessGovernanceRuntime,
  getAccessGovernanceRuntime,
  getAccessGovernanceState,
  loadAccessGovernance,
  refreshAccessGovernance,
  applyAccessGovernanceMutation,
  clearAccessGovernance,
  createAccessCommandId,
} from "./runtime/accessGovernanceRuntime";
export { useAccessGovernance } from "./react/useAccessGovernance";
