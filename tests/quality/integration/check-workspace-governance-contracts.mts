import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { STUDIO_SECTIONS, listStudioSectionsForGroup } from "../../../src/workspaces/studio/navigation/studioSectionRegistry";
import { canonicalizeLegacyPath, ROUTE_KEYS } from "../../../src/platform/navigation";
import { ALL_CAPABILITIES } from "../../../src/platform/access-control/domain/capabilityCatalog";

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
  "Thông tin thanh toán", "Thông tin hóa đơn", "Ứng dụng & dịch vụ", "Webhook gửi đi",
  "Tổng quan kết nối", "Nhận dữ liệu", "Truy cập API",
]) assert.ok(registry.includes(label), `Studio must keep ${label}`);
// This allowlist records the approved IA, independently of the production registry.
const approvedRoutes = [
  ["quick-setup", "settings/quick-setup", "studio.read"],
  ["business-information", "settings/business-information", "studio.read"],
  ["locale-region", "settings/locale-region", "studio.read"],
  ["feature-usage", "settings/feature-usage", "studio.read"],
  ["pipelines-statuses", "settings/pipelines-statuses", "studio.read"],
  ["product-types", "settings/product-types", "studio.read"],
  ["information-fields", "settings/information-fields", "studio.read"],
  ["payment-information", "settings/payment-information", "studio.read"],
  ["invoice-information", "settings/invoice-information", "studio.read"],
  ["ai", "settings/ai", "ai.configuration.read"],
  ["communication-channels", "settings/communications/channels", "communications.channels.manage"],
  ["integrations", "settings/integrations", "studio.read"],
  ["webhooks-api", "settings/webhooks-api", "studio.read"],
  ["connections-overview", "settings/connections", "studio.read"],
  ["connections-inbound", "settings/connections/inbound", "studio.read"],
  ["api-access", "settings/connections/api-access", "studio.read"],
] as const;
assert.deepEqual(
  STUDIO_SECTIONS.map(section => [section.id, section.routePath, section.requiredCapability]).sort(),
  approvedRoutes.map(row => [...row]).sort(),
  "Only the approved Studio routes and permissions may be exposed",
);
assert.equal(Object.keys(ROUTE_KEYS).length, 86, "IA admits exactly three additional route keys");
// The adopted protected inventory in AGENTS.md is 146; this remains an exact
// ratchet, not a permission grant or a dynamically expanded observed allowlist.
assert.equal(ALL_CAPABILITIES.length, 146, "Capabilities must match the adopted protected repository inventory");
assert.ok(routes.includes("PermissionRouteGuard capability={section.requiredCapability}"), "Every section must retain its permission guard");
const connections = listStudioSectionsForGroup("connections");
assert.deepEqual(connections.map(section => [section.id, section.labelVi, section.labelEn]), [
  ["connections-overview", "Tổng quan kết nối", "Overview"],
  ["integrations", "Ứng dụng & dịch vụ", "Apps & Services"],
  ["connections-inbound", "Nhận dữ liệu", "Inbound Sources"],
  ["webhooks-api", "Webhook gửi đi", "Outbound Webhooks"],
  ["api-access", "Truy cập API", "Developer API"],
]);
assert.equal(STUDIO_SECTIONS.find(section => section.id === "ai")?.groupId, "ai");
assert.equal(STUDIO_SECTIONS.find(section => section.id === "communication-channels")?.groupId, "communications");
// The first 13 entries are existing deep links, including the two renamed destinations.
for (const [, routePath] of approvedRoutes.slice(0, 13)) {
  for (const workspaceKey of ["compatibility-a", "compatibility-b"]) {
    assert.equal(canonicalizeLegacyPath(workspaceKey, `/${routePath}?source=legacy`), `/w/${workspaceKey}/studio/${routePath}?source=legacy`, `Legacy link ${routePath} must retain Workspace scope and query`);
  }
}
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
