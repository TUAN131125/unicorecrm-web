import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = repositoryRoot;
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

const routes = read("src/app/router/workspaces/studioWorkspaceRoutes.tsx");
const registry = read("src/workspaces/studio/navigation/studioSectionRegistry.ts");
const openApi = read("docs/api/openapi.json");
const sidebar = read("src/app/shell/layout/Sidebar.tsx");

assert.ok(routes.includes("STUDIO_SECTIONS.map"));
assert.ok(routes.includes("StudioBusinessInformationView"));
assert.ok(routes.includes("StudioWebhooksApiView"));
assert.equal(routes.includes("StudioSectionPage"), false);
assert.equal(routes.includes("LegacyRedirect"), false);
assert.ok(sidebar.includes("STUDIO_SECTION_GROUPS"));
assert.ok(sidebar.includes("listStudioSectionsForGroup"));
for (const label of [
  "Thiết lập nhanh",
  "Thông tin doanh nghiệp", "Ngôn ngữ & khu vực", "Tính năng sử dụng",
  "Pipeline & trạng thái", "Loại sản phẩm", "Trường thông tin",
  "Thông tin thanh toán", "Thông tin hóa đơn", "Tích hợp", "Webhook & API",
]) assert.ok(registry.includes(label), `Studio must keep ${label}`);
for (const removed of ["Tổng quan thiết lập", "Quy trình bán hàng", "Thiết lập chăm sóc khách hàng", "Sản phẩm chủ lực"]) {
  assert.equal(registry.includes(removed), false, `Studio must not restore ${removed}`);
}
assert.ok(routes.includes("StudioPipelinesStatusesView"));
assert.ok(routes.includes("StudioInformationFieldsView"));
assert.ok(openApi.includes('"If-Match"'));
assert.ok(openApi.includes('"Idempotency-Key"'));
assert.ok(openApi.includes('"/studio/quick-setup"'));
assert.equal(fs.existsSync(path.join(root, "src/workspaces/studio/application/studioConfigurationGateway.ts")), false);
assert.equal(fs.existsSync(path.join(root, "src/workspaces/studio/control-plane")), false);
assert.equal(fs.existsSync(path.join(root, "src/workspaces/studio/operations")), false);

const peoplePage = read("src/workspaces/people-access/presentation/pages/UsersPermissionsPage.tsx");
for (const marker of ["runtime.commands.inviteMember", "runtime.commands.provisionMember", "runtime.commands.replaceMemberAccess", "runtime.commands.resendInvitation", "runtime.commands.revokeInvitation", "runtime.commands.createRole", "runtime.commands.replaceRole", "runtime.commands.archiveRole"]) {
  assert.ok(peoplePage.includes(marker), `People & Access must keep ${marker}`);
}

const membershipRuntime = read("src/platform/workspace-membership/runtime/workspaceMembershipRuntime.ts");
for (const marker of ["WorkspaceInvitationRecord", 'status: "PENDING"', "expiresAt", "membershipStatusOverrides", "membershipTeamOverrides", "createActiveWorkspaceMembership", "unicore_workspace_people_v1:"]) {
  assert.ok(membershipRuntime.includes(marker), `Membership runtime must keep ${marker}`);
}

console.log("Workspace governance contracts: PASS (legacy Studio removed; People & Access ownership preserved)");
