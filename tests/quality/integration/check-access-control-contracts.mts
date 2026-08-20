import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  evaluateEffectiveAccess,
  projectRecordWithAccess,
  capabilityForAction,
  type AccessControlSnapshot,
  type AccessMemberDescriptor,
} from "@/platform/access-control";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const source = (relativePath: string) => readPresentationComposition(path.join(root, relativePath), "utf8");

const members: AccessMemberDescriptor[] = [
  { accountId: "acct_alpha", memberId: "member_alpha", membershipId: "membership_alpha", teamIds: ["team_red"] },
  { accountId: "acct_teammate", memberId: "member_teammate", membershipId: "membership_teammate", teamIds: ["team_red"] },
  { accountId: "acct_other", memberId: "member_other", membershipId: "membership_other", teamIds: ["team_blue"] },
];

function snapshot(scope: "OWN" | "TEAM" | "WORKSPACE" | "CUSTOM"): AccessControlSnapshot {
  return {
    workspaceId: "ws_authz",
    roles: [{
      roleId: "role_alpha_random_identifier",
      workspaceId: "ws_authz",
      name: "Arbitrary Human Label",
      description: "The name intentionally has no authorization meaning.",
      isActive: true,
      capabilities: ["leads.read", "leads.update", "studio.read"],
    }],
    assignments: [{
      assignmentId: "assignment_alpha",
      workspaceId: "ws_authz",
      membershipId: "membership_alpha",
      roleId: "role_alpha_random_identifier",
    }],
    dataScopes: [{
      policyId: `scope_${scope.toLowerCase()}`,
      workspaceId: "ws_authz",
      roleId: "role_alpha_random_identifier",
      resourceKey: "leads",
      scope,
      allowedOwnerIds: scope === "CUSTOM" ? ["member_other"] : undefined,
    }],
    fieldSecurity: [
      { policyId: "field_phone", workspaceId: "ws_authz", roleId: "role_alpha_random_identifier", resourceKey: "leads", fieldKey: "phone", access: "MASKED" },
      { policyId: "field_private", workspaceId: "ws_authz", roleId: "role_alpha_random_identifier", resourceKey: "leads", fieldKey: "privateNote", access: "HIDDEN" },
      { policyId: "field_value", workspaceId: "ws_authz", roleId: "role_alpha_random_identifier", resourceKey: "leads", fieldKey: "estimatedValue", access: "READ_ONLY" },
    ],
    revision: 1,
  };
}

const ownAccess = evaluateEffectiveAccess({ snapshot: snapshot("OWN"), member: members[0], memberDirectory: members });
assert.equal(ownAccess.can("leads.update"), true, "Capabilities must come from assigned role contracts, not role names");
assert.equal(ownAccess.canAccessModule("leads"), true);
assert.equal(ownAccess.canPerform("leads", "update"), true);
assert.equal(capabilityForAction("orders", "confirm"), "orders.confirm", "Order confirmation must resolve through the canonical action-capability map");
assert.equal(ownAccess.productSpaces.has("crm"), true);
assert.equal(ownAccess.productSpaces.has("studio"), true);
assert.equal(ownAccess.canAccessRecord("leads", { ownerId: "member_alpha" }), true);
assert.equal(ownAccess.canAccessRecord("leads", { ownerId: "member_other" }), false, "OWN scope must deny records owned by another member");

const teamAccess = evaluateEffectiveAccess({ snapshot: snapshot("TEAM"), member: members[0], memberDirectory: members });
assert.equal(teamAccess.canAccessRecord("leads", { ownerId: "member_teammate" }), true, "TEAM scope must allow teammate-owned records");
assert.equal(teamAccess.canAccessRecord("leads", { ownerId: "member_other" }), false, "TEAM scope must deny records outside the member's teams");
assert.equal(teamAccess.canAccessRecord("leads", { teamId: "team_red" }), true, "TEAM scope must support records directly assigned to a team");

const workspaceAccess = evaluateEffectiveAccess({ snapshot: snapshot("WORKSPACE"), member: members[0], memberDirectory: members });
assert.equal(workspaceAccess.canAccessRecord("leads", { ownerId: "member_other" }), true, "WORKSPACE scope must allow workspace records");

const customAccess = evaluateEffectiveAccess({ snapshot: snapshot("CUSTOM"), member: members[0], memberDirectory: members });
assert.equal(customAccess.canAccessRecord("leads", { ownerId: "member_other" }), true, "CUSTOM scope must honor declared allowed owners");
assert.equal(customAccess.canAccessRecord("leads", { ownerId: "member_teammate" }), false);

const projected = projectRecordWithAccess(workspaceAccess, "leads", {
  id: "lead_secure",
  ownerId: "member_other",
  phone: "+84 900 000 000",
  privateNote: "sensitive",
  estimatedValue: 120000,
  name: "Visible lead",
});
assert.ok(projected);
assert.equal(projected?.phone, "••••••", "MASKED field must be transformed before presentation");
assert.equal("privateNote" in (projected || {}), false, "HIDDEN field must be removed before presentation");
assert.equal(projected?.estimatedValue, 120000, "READ_ONLY affects mutation permission, not read visibility");

const deniedProjection = projectRecordWithAccess(ownAccess, "leads", { id: "other", ownerId: "member_other" });
assert.equal(deniedProjection, null, "Record authorization must run before field projection");

// Active runtime must use the canonical access-control pipeline.
const activeFiles = [
  "src/app/authorization/useEffectiveShellAccess.ts",
  "src/app/providers/PlatformStateProvider.tsx",
  "src/app/router/guards/CanonicalProductSpaceGuard.tsx",
  "src/app/shell/layout/AppShell.tsx",
  "src/components/PermissionRouteGuard.tsx",
  "src/modules/orders/presentation/pages/OrderListPage.tsx",
  "src/modules/products/presentation/hooks/useProductListController.ts",
  "src/modules/support/presentation/pages/SupportCaseListPage.tsx",
  "src/workspaces/crm/presentation/pages/ReportsPage.tsx",
  "src/workspaces/people-access/presentation/pages/UsersPermissionsPage.tsx",
];
for (const file of activeFiles) {
  const text = source(file);
  for (const forbidden of ["legacyCapabilityAdapter", "permissionResolver", "@/platform/authorization"]) {
    assert.equal(text.includes(forbidden), false, `${file} must not import legacy authorization source ${forbidden}`);
  }
}

const shellAccess = source("src/app/authorization/useEffectiveShellAccess.ts");
assert.ok(shellAccess.includes("useEffectiveAccess"));
const permissionGuard = source("src/components/PermissionRouteGuard.tsx");
assert.ok(permissionGuard.includes("useEffectiveAccess"));
const peopleAccessPage = source("src/workspaces/people-access/presentation/pages/UsersPermissionsPage.tsx");
assert.ok(peopleAccessPage.includes("useAccessGovernance"), "People & Access must consume the authoritative governance boundary");
assert.equal(peopleAccessPage.includes("listAllDevelopmentMemberships"), false, "Active People & Access UI must not consume development seed APIs directly");
for (const contract of ["runtime.commands.replaceMemberAccess", "runtime.commands.provisionMember", "runtime.commands.inviteMember", "runtime.commands.replaceRole"]) {
  assert.ok(peopleAccessPage.includes(contract), `People & Access must manage canonical ${contract} contract`);
}

const repositoryProxy = source("src/platform/workspace-scope/createWorkspaceScopedRepository.ts");
assert.ok(repositoryProxy.includes("projectAuthorizedRecord"), "Workspace repository reads must project record/data-scope/field authorization");
assert.ok(repositoryProxy.includes("shouldEnforceRuntimeAuthorization"), "Authorization projection must be attached to runtime reads");

// Compatibility debt is allowed only in explicit legacy boundaries that are not active imports.
const legacyImports = walkAllFiles(path.join(root, "src"))
  .filter((file) => /\.(ts|tsx)$/.test(file))
  .filter((file) => {
    const text = readPresentationComposition(file, "utf8");
    return /from\s+["'][^"']*(?:permissionResolver|platform\/authorization|legacyCapabilityAdapter)[^"']*["']/.test(text);
  })
  .map((file) => path.relative(root, file).replaceAll("\\", "/"));
assert.deepEqual(legacyImports, [], "Legacy authorization imports must be fully removed from the repository");
for (const retiredPath of [
  "src/utils/permissionResolver.ts",
  "src/types/adminPermissions.ts",
  "src/platform/authorization",
  "src/workspaces/people-access/presentation/components/users-permissions",
]) assert.equal(fs.existsSync(path.join(root, retiredPath)), false, `${retiredPath} must remain removed`);

assert.equal(fs.existsSync(path.join(root, "src", "types.ts")), false, "The retired global runtime type barrel must not return");

for (const file of activeFiles) {
  const text = source(file);
  for (const forbiddenRole of ["owner_admin", "sales_manager", "sales_rep", "cs_manager", "cs_rep"]) {
    assert.equal(text.includes(`\"${forbiddenRole}\"`), false, `${file} must not authorize by role name ${forbiddenRole}`);
  }
}



// Product-space access derives from capabilities rather than role names.
const productSpaceMember: AccessMemberDescriptor = {
  accountId: "account-product-space",
  memberId: "member-product-space",
  membershipId: "membership-product-space",
  teamIds: [],
};
const productSpaceSnapshot = (roleId: string, capabilities: string[]): AccessControlSnapshot => ({
  workspaceId: "ws-product-space",
  roles: [{ roleId, workspaceId: "ws-product-space", name: roleId, isActive: true, capabilities }],
  assignments: [{ assignmentId: `assignment-${roleId}`, workspaceId: "ws-product-space", membershipId: productSpaceMember.membershipId, roleId }],
  dataScopes: [],
  fieldSecurity: [],
  revision: 1,
});
const crmOnly = evaluateEffectiveAccess({ snapshot: productSpaceSnapshot("crm-only", ["leads.read"]), member: productSpaceMember, memberDirectory: [productSpaceMember] });
assert.deepEqual([...crmOnly.productSpaces], ["crm"]);
assert.equal(crmOnly.canAccessModule("leads"), true);
const studioOnly = evaluateEffectiveAccess({ snapshot: productSpaceSnapshot("studio-only", ["studio.read"]), member: productSpaceMember, memberDirectory: [productSpaceMember] });
assert.deepEqual([...studioOnly.productSpaces], ["studio"]);
assert.equal(studioOnly.canAccessModule("systemConfiguration"), true);
const peopleOnly = evaluateEffectiveAccess({ snapshot: productSpaceSnapshot("people-only", ["access.read"]), member: productSpaceMember, memberDirectory: [productSpaceMember] });
assert.deepEqual([...peopleOnly.productSpaces], ["people"]);
assert.equal(peopleOnly.canAccessModule("usersPermissions"), true);
const roleNameTrap = evaluateEffectiveAccess({ snapshot: productSpaceSnapshot("owner_admin", []), member: productSpaceMember, memberDirectory: [productSpaceMember] });
assert.equal(roleNameTrap.productSpaces.size, 0, "Role names must not grant product-space access by themselves");

const multiRoleSnapshot: AccessControlSnapshot = {
  workspaceId: "ws-multi-role",
  roles: [
    { roleId: "role-allow", workspaceId: "ws-multi-role", name: "Allow", isActive: true, capabilities: ["leads.read"] },
    { roleId: "role-restrict", workspaceId: "ws-multi-role", name: "Restrict", isActive: true, capabilities: ["leads.read"] },
  ],
  assignments: [
    { assignmentId: "assignment-allow", workspaceId: "ws-multi-role", membershipId: productSpaceMember.membershipId, roleId: "role-allow" },
    { assignmentId: "assignment-restrict", workspaceId: "ws-multi-role", membershipId: productSpaceMember.membershipId, roleId: "role-restrict" },
  ],
  dataScopes: [
    { policyId: "scope-own", workspaceId: "ws-multi-role", roleId: "role-allow", resourceKey: "leads", scope: "OWN" },
    { policyId: "scope-team", workspaceId: "ws-multi-role", roleId: "role-restrict", resourceKey: "leads", scope: "TEAM" },
  ],
  fieldSecurity: [
    { policyId: "field-write", workspaceId: "ws-multi-role", roleId: "role-allow", resourceKey: "leads", fieldKey: "phone", access: "READ_WRITE" },
    { policyId: "field-mask", workspaceId: "ws-multi-role", roleId: "role-restrict", resourceKey: "leads", fieldKey: "phone", access: "MASKED" },
  ],
  revision: 1,
};
const multiRoleAccess = evaluateEffectiveAccess({ snapshot: multiRoleSnapshot, member: productSpaceMember, memberDirectory: [productSpaceMember] });
assert.equal(multiRoleAccess.roleIds.size, 2, "A member may receive multiple role assignments");
assert.equal(multiRoleAccess.getFieldAccess("leads", "phone"), "MASKED", "The most restrictive field policy must win across roles");

// Write boundaries enforce runtime command authorization.
const commandGuard = source("src/platform/access-control/runtime/runtimeCommandAuthorization.ts");
for (const contract of ["assertRuntimeCapability", "assertRuntimeRecordAccess", "assertRuntimeCommandAccess"]) {
  assert.ok(commandGuard.includes(`function ${contract}`), `Runtime command authorization must expose ${contract}`);
}
const guardedCommandFiles = [
  "src/modules/leads/application/commands/leadRepositoryCommands.ts",
  "src/modules/leads/application/commands/leadCommands.ts",
  "src/modules/contacts/application/commands/contactRepositoryCommands.ts",
  "src/modules/deals/application/commands/dealCommands.ts",
  "src/modules/quotes/application/commands/quoteCommands.ts",
  "src/modules/orders/application/commands/orderCommands.ts",
  "src/modules/tasks/application/commands/taskCommands.ts",
  "src/modules/payments/application/commands/paymentCommands.ts",
  "src/modules/shipping/application/commands/shippingCommands.ts",
  "src/modules/returns/application/commands/returnCommands.ts",
  "src/modules/products/application/commands/productCatalogCommands.ts",
  "src/modules/support/application/commands/supportCaseRepositoryCommands.ts",
];
for (const file of guardedCommandFiles) {
  const text = source(file);
  assert.ok(/assertRuntime(?:CommandAccess|Capability)/.test(text), `${file} must enforce authorization at the command boundary`);
}

const accessRuntime = source("src/platform/access-control/runtime/accessControlRuntime.ts");
for (const marker of [
  "assertAccessConfigurationAllowed",
  "assertAdministratorInvariant",
  "assertRoleCanBeRemoved",
  "assertRoleCanBeDeactivated",
  "A workspace member must retain at least one role",
  "assertMembershipStatusChangeAllowed",
]) {
  assert.ok(accessRuntime.includes(marker), `Access-control runtime must protect ${marker}`);
}
const peopleCommands = source("src/workspaces/people-access/application/peopleAccessCommands.ts");
for (const marker of [
  "assertAccessConfigurationAllowed",
  "assertMembershipStatusChangeAllowed",
  "inviteWorkspaceMemberWithRole",
  "provisionWorkspaceEmployeeAccount",
  "updateWorkspaceMemberAccessCommand",
  "replaceRoleAssignments",
  "revokeWorkspaceInvitation",
]) {
  assert.ok(peopleCommands.includes(marker), `People & Access commands must keep ${marker}`);
}
const roleTemplates = source("src/platform/access-control/domain/roleTemplates.ts");
assert.ok(roleTemplates.includes("ROLE_TEMPLATES"), "Suggested roles must be modeled as templates");
assert.equal(roleTemplates.includes("isSystem"), false, "Role templates must not be immutable system roles");

console.log("Access-control and People & Access contracts: OK");
