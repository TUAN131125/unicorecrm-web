import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createDefaultAccessControlSnapshot } from "../../../src/platform/access-control/runtime/accessControlSeed";
import { evaluateEffectiveAccess } from "../../../src/platform/access-control/domain/evaluateEffectiveAccess";
import { canWriteModule } from "../../../src/platform/access-control/domain/moduleAccessPolicy";

const workspaceId = "ws_unicore_vietnam";
function accessFor(templateId: string) {
  const snapshot = createDefaultAccessControlSnapshot(workspaceId);
  const role = snapshot.roles.find((candidate) => candidate.sourceTemplateId === templateId);
  assert.ok(role);
  const membershipId = `membership_${templateId}`;
  snapshot.assignments = [{ assignmentId: `assignment_${templateId}`, workspaceId, membershipId, roleId: role.roleId }];
  return evaluateEffectiveAccess({ snapshot, member: { accountId: "account", memberId: "member", membershipId, teamIds: ["team"] }, memberDirectory: [] });
}

const finance = accessFor("finance");
assert.ok(finance.canAccessModule("orders"));
assert.equal(canWriteModule(finance, "orders"), false, "Finance sees order context read-only");
assert.equal(canWriteModule(finance, "payments"), true, "Finance owns payment actions");
assert.ok(finance.canAccessModule("shipping"));
assert.equal(canWriteModule(finance, "shipping"), false, "Finance sees shipping status read-only");

const operations = accessFor("operations");
assert.equal(canWriteModule(operations, "shipping"), true);
assert.equal(canWriteModule(operations, "returns"), true);
assert.equal(canWriteModule(operations, "payments"), false, "Operations sees payment status read-only");

const customerSuccess = accessFor("customer-success");
assert.equal(canWriteModule(customerSuccess, "support"), true);
assert.equal(canWriteModule(customerSuccess, "orders"), false);
assert.equal(canWriteModule(customerSuccess, "payments"), false);
assert.equal(canWriteModule(customerSuccess, "shipping"), false);

const root = repositoryRoot;
const guard = fs.readFileSync(path.join(root, "src/components/PermissionRouteGuard.tsx"), "utf8");
assert.ok(guard.includes("ReadOnlyAccessBanner"), "Read-only routes must explain the access mode");
assert.ok(guard.includes('data-access-mode="read-only"'), "Read-only mode must be testable and accessible to guidance");
const banner = fs.readFileSync(path.join(root, "src/components/access/ReadOnlyAccessBanner.tsx"), "utf8");
assert.ok(banner.includes('data-guidance-id="access.read-only.notice"'));
assert.ok(banner.includes("chịu trách nhiệm") && banner.includes("owns update actions"));

const routes = fs.readFileSync(path.join(root, "src/app/router/workspaces/crmWorkspaceRoutes.tsx"), "utf8");
for (const capability of ["QUOTES_CREATE", "QUOTES_UPDATE", "ORDERS_CREATE", "ORDERS_UPDATE", "SHIPPING_CREATE", "RETURNS_CREATE", "SUPPORT_CREATE", "SUPPORT_UPDATE"]) {
  assert.ok(routes.includes(`CAPABILITIES.${capability}`), `Direct write route must require ${capability}`);
}
assert.ok(routes.includes("moduleActionRoute"), "Write routes must not rely on read permission alone");

console.log("Read-only cross-domain access: PASS — route guards, ownership banners, and Finance/Operations/Customer Success modes verified");
