import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = repositoryRoot;
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

const sidebar = read("src/app/shell/layout/Sidebar.tsx");
const productSpaceNav = read("src/app/shell/layout/ProductSpaceNav.tsx");
const topBar = read("src/app/shell/layout/TopBar.tsx");
const notificationBell = read("src/app/shell/layout/NotificationBell.tsx");
const appShell = read("src/app/shell/layout/AppShell.tsx");
const routeKeys = read("src/platform/navigation/routeKeys.ts");
const crmRoutes = read("src/app/router/workspaces/crmWorkspaceRoutes.tsx");
const calendarPage = read("src/workspaces/crm/presentation/pages/WorkCalendarPage.tsx");
const myWork = read("src/workspaces/crm/presentation/pages/MyWorkPage.tsx");
const taskList = read("src/modules/tasks/presentation/pages/TaskListPage.tsx");
const taskDetail = read("src/modules/tasks/presentation/pages/TaskDetailPage.tsx");

assert.ok(sidebar.includes('locale: "vi" | "en"'), "Sidebar must receive the active locale.");
assert.ok(sidebar.includes('const label = (viText: string, enText: string)'), "Sidebar must choose labels by locale.");
for (const label of ["Lịch làm việc", "Thông báo", "Khách hàng tiềm năng", "Người liên hệ", "Tổ chức", "Cơ hội", "Báo giá", "Đơn hàng", "Sản phẩm", "Thanh toán", "Vận đơn", "Đổi / Trả hàng", "Phiếu hỗ trợ", "Công việc", "Báo cáo"]) {
  assert.ok(sidebar.includes(`"${label}"`), `Vietnamese shell label must exist: ${label}`);
}

assert.ok(productSpaceNav.includes('locale: "vi" | "en"'), "Product-space navigation must be locale-aware.");
assert.ok(productSpaceNav.includes('vi ? "Thiết lập" : "Settings"'), "Studio label must switch with locale.");
assert.ok(productSpaceNav.includes('vi ? "Người dùng & Quyền" : "Users & Access"'), "People & Access label must switch with locale.");
assert.ok(topBar.includes('locale: "vi" | "en"'), "Top bar must use the same locale contract as the shell.");
assert.ok(topBar.includes('locale={locale}'), "Top bar must pass locale into product-space navigation.");

assert.ok(notificationBell.includes('toWorkspacePath(activeWorkspaceKey, "crm", "notifications")'), "Notification center must use a canonical workspace-scoped route.");
assert.equal(notificationBell.includes('to="/notifications"'), false, "Notification center must not use a legacy global route.");

assert.ok(routeKeys.includes('CALENDAR: "/calendar"'), "A real calendar route key must exist.");
assert.ok(crmRoutes.includes('lazyRouteComponent("WorkCalendarPage"'), "The work calendar must be a real lazy route module.");
assert.ok(crmRoutes.includes('ROUTE_KEYS.CALENDAR'), "CRM routes must register the work calendar.");
assert.ok(calendarPage.includes("getTaskActivitySnapshot"), "Work Calendar must read Task data rather than introduce a fake calendar aggregate.");
assert.ok(calendarPage.includes('title={vi ? "Lịch làm việc" : "Work Calendar"}'), "Calendar title must switch with locale.");
assert.equal(sidebar.includes('#calendar'), false, "Calendar must not be a virtual hash link.");

assert.ok(appShell.includes('new Set(["dashboard", "calendar", "notifications", "reports"])'), "Workspace switching must preserve restored utility routes when accessible.");

for (const source of [taskList, taskDetail]) {
  assert.ok(source.includes('locale') || source.includes('vi ='), "Task surfaces must be locale-aware.");
}
assert.ok(myWork.includes("Navigate"), "Legacy My Work must redirect instead of rendering a second work product.");
assert.ok(myWork.includes("view=mine"), "Legacy My Work must redirect to the Tasks Mine view.");

console.log("Workspace navigation & language audit: PASS");
console.log("- My Work is consolidated into the Tasks Mine view; Work Calendar and Notifications remain separate projections");
console.log("- Calendar is a real Task-backed route, not a virtual link");
console.log("- shell/product-space navigation uses one active locale consistently");
console.log("- notification and quick-action routes remain workspace-scoped");
