import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = repositoryRoot;
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath: string) => fs.existsSync(path.join(root, relativePath));

const topBar = source("src/app/shell/layout/TopBar.tsx");
for (const required of ["ProductSpaceNav", "Search", "NotificationBell", "LanguageSelector", "CircleHelp", "UserMenu"]) {
  assert.ok(topBar.includes(required), `TopBar must include ${required}`);
}
for (const forbidden of ["QuickCreate", "Breadcrumb", "Conversations", "AI Assistant", "AiAssistant", "<BookOpen"]) {
  assert.equal(topBar.includes(forbidden), false, `TopBar must not include ${forbidden}`);
}
assert.equal(topBar.includes('title="UnicoreCRM"'), false, "TopBar must not duplicate the UnicoreCRM identity shown in the Sidebar");
assert.ok(topBar.includes('id="topbar-help-button"'), "Help control must exist in the TopBar");
assert.ok(topBar.indexOf('id="topbar-help-button"') < topBar.indexOf("<UserMenu"), "User menu must sit immediately after the help control");
assert.match(topBar, /data-search-empty-state="permission-aware"/, "Global search must explain permission-scoped empty results");
assert.match(topBar, /access\.getDataScope\(moduleKey\)/, "Global search empty state must derive its scope label from effective access");
assert.doesNotMatch(topBar, /Không tìm thấy trang hoặc bản ghi phù hợp/, "Global search must not use an ambiguous generic record-empty message");

const userMenu = source("src/app/shell/layout/UserMenu.tsx");
assert.ok(userMenu.includes('id="topbar-user-menu"'), "Current-user control must live in the TopBar");

const sidebar = source("src/app/shell/layout/Sidebar.tsx");
assert.ok(sidebar.includes('id="unicore-sidebar"'), "Sidebar must use the Unicore identity boundary");
assert.ok(sidebar.includes(">UnicoreCRM</h1>"), "Sidebar header must be exactly UnicoreCRM");
assert.ok(sidebar.includes("Workspace memberships"), "Workspace switcher must remain directly below the Sidebar header");
assert.equal(sidebar.includes("SidebarAccountFooter"), false, "Account actions must not live in the Sidebar footer");
assert.equal(exists("src/app/shell/layout/SidebarAccountFooter.tsx"), false, "Obsolete Sidebar account footer source must remain removed");
for (const space of ["crm", "studio", "people"]) {
  assert.ok(sidebar.includes(`activeProductSpace === "${space}"`), `Sidebar must be contextual for ${space}`);
}

const appShell = source("src/app/shell/layout/AppShell.tsx");
assert.equal(appShell.includes("QuickCreate"), false, "AppShell must not wire Quick Create into the TopBar");
assert.ok(appShell.includes("currentUser={currentUser}"), "AppShell must wire the current user into the TopBar");
assert.ok(appShell.includes("data-router-pathname={location.pathname}"), "Main canvas must expose the committed router pathname for diagnostics");
assert.match(appShell, /hasDirtyUnsavedWork && \(\s*<UnsavedNavigationGuard/, "The navigation blocker must mount only while unsaved work exists");
assert.doesNotMatch(appShell, /useBlocker\(hasDirtyUnsavedWork\s*\?/, "The shell must not register a disabled blocker on every page");

console.log("Shell layout contracts: OK");
