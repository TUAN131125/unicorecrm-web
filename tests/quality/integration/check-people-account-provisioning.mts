import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true });
Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true });
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
Object.defineProperty(globalThis, "localStorage", { value: dom.window.localStorage, configurable: true });

const auth = await import("@/platform/identity-auth");
const access = await import("@/platform/access-control");
const membership = await import("@/platform/workspace-membership");
const commands = await import("@/workspaces/people-access/application/peopleAccessCommands");
const operationalAudit = await import("@/platform/operational-audit");

const adminSignIn = auth.signIn({ email: "admin@unicorecrm.local", password: "admin123", deviceLabel: "provisioning contract" });
assert.equal(adminSignIn.ok, true, "Administrative demo sign-in must create an AAL1 session");

const workspaceId = "ws1";
const snapshot = access.getAccessControlSnapshot(workspaceId);
const employeeRole = snapshot.roles.find((role) => role.isActive && role.capabilities.includes("leads.read"));
assert.ok(employeeRole, "A usable employee role must exist");

const result = commands.provisionWorkspaceEmployeeAccount({
  workspaceId,
  displayName: "Provisioned Employee",
  email: "provisioned.employee@example.com",
  roleIds: [employeeRole.roleId],
  teamIds: ["team_sales"],
  provisionedByAccountId: "acct_admin",
});

assert.ok(result.account.accountId.startsWith("acct_provisioned_"));
assert.ok(result.account.memberId.startsWith("member_provisioned_"));
assert.ok(result.temporaryPassword.length >= 10);
assert.equal(result.membership.status, "active");
assert.equal(result.membership.source, "direct_provisioning");
assert.deepEqual(result.membership.teamIds, ["team_sales"]);

const directoryMembership = membership.listWorkspaceMembershipDirectory(workspaceId)
  .find((candidate) => candidate.accountId === result.account.accountId);
assert.ok(directoryMembership?.membershipId, "Direct account must create an active workspace membership");
const assignedRoleIds = access.getAccessControlSnapshot(workspaceId).assignments
  .filter((assignment) => assignment.membershipId === directoryMembership.membershipId)
  .map((assignment) => assignment.roleId);
assert.deepEqual(assignedRoleIds, [employeeRole.roleId], "Provisioning must assign the selected role atomically");
const activity = operationalAudit.getOperationalAuditSnapshot("access-control", directoryMembership.membershipId);
assert.ok(activity.some((entry) => entry.action === "WorkspaceMemberAdded"), "Provisioning must append a member-added activity entry");
assert.ok(localStorage.getItem(`unicore_operational_activity_v1:${workspaceId}`), "People activity must persist per workspace");

const permissionProbe = "tasks.read" as const;
const originalCapabilities = [...employeeRole.capabilities];
const nextCapabilities = originalCapabilities.includes(permissionProbe)
  ? originalCapabilities.filter((capability) => capability !== permissionProbe)
  : [...originalCapabilities, permissionProbe];
access.updateRoleCapabilities(employeeRole.roleId, nextCapabilities, workspaceId);
const roleActivity = operationalAudit.getOperationalAuditSnapshot("access-control", employeeRole.roleId);
assert.ok(roleActivity.some((entry) => entry.action === "RolePermissionsChanged"), "Granting or revoking a role permission must append an activity entry");
access.updateRoleCapabilities(employeeRole.roleId, originalCapabilities, workspaceId);

const listedAccount = auth.listDevelopmentAccounts().find((account) => account.accountId === result.account.accountId);
assert.equal(listedAccount?.email, result.account.email, "Provisioned identity must appear in the account directory");

auth.signOut();
const employeeSignIn = auth.signIn({ email: result.account.email, password: result.temporaryPassword, deviceLabel: "employee contract" });
assert.equal(employeeSignIn.ok, true, "Provisioned employee must be able to sign in immediately");
if (!employeeSignIn.ok) throw new Error("Expected provisioned employee sign-in success");
assert.equal(employeeSignIn.value.principal.accountId, result.account.accountId);
assert.equal(membership.listWorkspaceMembershipsForAccount(result.account.accountId).some((item) => item.workspaceId === workspaceId && item.status === "active"), true);
assert.equal(access.resolveEffectiveAccess(workspaceId).roleIds.has(employeeRole.roleId), true, "Provisioned employee must receive effective access from the selected role");

console.log("People account provisioning contracts: PASS");
