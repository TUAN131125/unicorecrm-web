import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = repositoryRoot;
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

const page = read("src/workspaces/people-access/presentation/pages/UsersPermissionsPage.tsx");
for (const marker of [
  "Mời qua email",
  "Cấp tài khoản",
  "ProvisionAccountModal",
  "InviteMemberModal",
  "MemberAccessModal",
  "useAccessGovernance",
  "runtime.commands.provisionMember",
  "runtime.commands.rotateManagedMemberPassword",
  "runtime.commands.replaceMemberAccess",
]) assert.ok(page.includes(marker), `People & Access page must keep ${marker}`);
for (const retiredCredentialToken of ["IssuedCredentialsModal", "temporaryPassword", "initialPassword"]) {
  assert.equal(page.includes(retiredCredentialToken), false, `People & Access page must not expose browser-owned credentials: ${retiredCredentialToken}`);
}
assert.equal(page.includes("MemberRoleAssignments"), false, "Member roles must be managed in the dedicated access modal rather than an inline details dropdown");

assert.ok(page.includes('data-people-access-surface="canonical"'), "People & Access must expose the canonical scoped visual hierarchy");
const peoplePresentationSources = fs.readdirSync(path.join(root, "src/workspaces/people-access/presentation"), { recursive: true })
  .filter((entry): entry is string => typeof entry === "string" && entry.endsWith(".tsx"))
  .map((entry) => read(path.join("src/workspaces/people-access/presentation", entry)))
  .join("\n");
assert.equal(/font-(?:black|extrabold)/.test(peoplePresentationSources), false, "People & Access presentation must not restore 800/900 font weights across dense permission surfaces");
assert.equal(peoplePresentationSources.includes("text-slate-850"), false, "People & Access must not use unsupported Tailwind color tokens that silently inherit a faint foreground");
const sharedCss = read("src/index.css");
for (const marker of ['[data-people-access-surface="canonical"]', '--crm-config-text', '[class~="text-slate-500"]']) {
  assert.ok(sharedCss.includes(marker), `People & Access contrast hierarchy must keep ${marker}`);
}

const directory = read("src/workspaces/people-access/presentation/components/MemberDirectoryView.tsx");
for (const marker of ["Tài khoản cấp trực tiếp", "Quản lý quyền", "Cấp lại mật khẩu", "MemberDirectoryFilter", "AccountSource"]) {
  assert.ok(directory.includes(marker), `Member directory must keep ${marker}`);
}
assert.equal(directory.includes("<details"), false, "Member directory must not depend on native details popovers for critical access editing");

const onboarding = read("src/workspaces/people-access/presentation/components/MemberOnboardingModals.tsx");
for (const marker of ["RoleChecklist", "Có thể chọn nhiều", "Người nhận hoàn tất kích hoạt qua hướng dẫn bảo mật", "Activation instructions are sent through the configured secure channel"]) {
  assert.ok(onboarding.includes(marker), `Member onboarding must keep ${marker}`);
}
assert.doesNotMatch(onboarding, /IssuedCredentialsModal|temporaryPassword|initialPassword|Mật khẩu khởi tạo|Sao chép thông tin/, "Member onboarding must not render or collect account credentials outside the production contract");

const roles = read("src/workspaces/people-access/presentation/components/access-control/RoleManagementView.tsx");
for (const marker of ["CAPABILITY_GROUP_LABELS", "capabilityPresentation", "Cấp cả nhóm", "Phạm vi bản ghi được phép xem", "Bảo mật trường"]) {
  assert.ok(roles.includes(marker), `Role editor must keep ${marker}`);
}

const activityPage = read("src/workspaces/people-access/presentation/pages/AuditLogsPage.tsx");
const activityLog = read("src/workspaces/people-access/presentation/components/PeopleActivityLog.tsx");
assert.ok(activityPage.includes("Nhật ký hoạt động") && activityPage.includes("PeopleActivityLog"), "People & Access must expose an activity log rather than an audit/recovery console");
assert.doesNotMatch(activityPage, /Demo Mode|Sao lưu và khôi phục|AAL2|Chuỗi cục bộ/, "The activity page must not expose retired demo, backup, or assurance diagnostics");
for (const marker of ["MemberInvitationCreated", "WorkspaceMemberAdded", "MemberAccessChanged", "RolePermissionsChanged", "Tất cả thay đổi", "Xuất CSV"]) {
  assert.ok(activityLog.includes(marker), `Activity log must keep ${marker}`);
}

const commandSource = read("src/workspaces/people-access/application/peopleAccessCommands.ts");
for (const marker of ["provisionUserAccount", "createActiveWorkspaceMembership", "replaceRoleAssignments", "removeProvisionedUserAccount", "rotateProvisionedUserPassword"]) {
  assert.ok(commandSource.includes(marker), `People command boundary must keep ${marker}`);
}

const identityAdapter = read("src/platform/identity-auth/infrastructure/DevelopmentAuthAdapter.ts");
for (const marker of ["PROVISIONED_ACCOUNTS_KEY", "provisionDevelopmentAccount", "generateTemporaryPassword", "rotateProvisionedDevelopmentAccountPassword"]) {
  assert.ok(identityAdapter.includes(marker), `Development identity adapter must keep ${marker}`);
}

assert.equal(fs.existsSync(path.join(root, "src/workspaces/people-access/presentation/components/access-control/MemberRoleAssignments.tsx")), false, "Retired inline role assignment component must remain removed");

console.log("People & Access UX contracts: PASS");
