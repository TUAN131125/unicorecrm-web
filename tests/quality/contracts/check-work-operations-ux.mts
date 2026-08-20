import { walkFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const read = (relative: string) => readPresentationComposition(path.join(root, relative), "utf8");

const listTsxFiles = (relativeDirectory: string): string[] => walkFiles(path.join(root, relativeDirectory), {
  include: (_filePath: string, entryName: string) => entryName.endsWith(".tsx"),
}).map((absolutePath: string) => path.relative(root, absolutePath));

const supportPresentationFiles = listTsxFiles("src/modules/support/presentation");
const supportTypographySource = supportPresentationFiles.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
assert.doesNotMatch(supportTypographySource, /font-black|font-extrabold|font-bold/, "Support presentation must keep a restrained typography hierarchy.");
assert.ok((supportTypographySource.match(/font-semibold/g) || []).length <= 5, "Support presentation must reserve semibold text for primary titles and statuses.");

const taskList = read("src/modules/tasks/presentation/pages/TaskListPage.tsx");
const taskDetail = read("src/modules/tasks/presentation/pages/TaskDetailPage.tsx");
const taskCreateModal = read("src/modules/tasks/presentation/components/TaskCreateModal.tsx");
const careList = read("src/modules/support/presentation/pages/SupportCaseListPage.tsx");
const careDetail = read("src/modules/support/presentation/pages/SupportCaseDetailPage.tsx");
const careForm = read("src/modules/support/presentation/pages/SupportCaseFormPage.tsx");
const myWorkPage = read("src/workspaces/crm/presentation/pages/MyWorkPage.tsx");
const calendar = read("src/workspaces/crm/presentation/pages/WorkCalendarPage.tsx");
const notificationsPage = read("src/workspaces/crm/presentation/pages/NotificationsPage.tsx");
const notificationModel = read("src/workspaces/crm/read-models/notifications/notificationReadModel.ts");
const notificationBell = read("src/app/shell/layout/NotificationBell.tsx");
const taskRuntime = read("src/modules/tasks/runtime/taskModuleRuntime.ts");
const careRuntime = read("src/modules/support/runtime/supportModuleRuntime.ts");
const workActivation = read("src/workflows/work-activation/index.ts");
const sidebar = read("src/app/shell/layout/Sidebar.tsx");
const leadDetail = read("src/modules/leads/presentation/pages/LeadDetailPage.tsx");
const contactRoute = read("src/modules/contacts/detail-route.tsx");
const contactDetail = read("src/modules/contacts/presentation/pages/ContactDetailPage.tsx");
const contactCareTab = read("src/modules/contacts/presentation/detail/tabs/ContactCareCasesTab.tsx");
const contactTaskModal = read("src/modules/contacts/presentation/detail/actions/ContactTaskModal.tsx");
const leadTaskModals = read("src/modules/leads/presentation/components/LeadDetailModals.tsx");
const customerDetail = read("src/modules/customers/presentation/detail/CustomerDetailTabContent.tsx");
const customerPage = read("src/modules/customers/presentation/pages/Customer360Page.tsx");
const customerHeader = read("src/modules/customers/presentation/detail/CustomerRecordHeader.tsx");
const customerInsight = read("src/modules/customers/presentation/detail/CustomerInsightPanel.tsx");
const taskCommands = read("src/modules/tasks/application/commands/taskCommands.ts");
const careRepositoryCommands = read("src/modules/support/application/commands/supportCaseRepositoryCommands.ts");
const dashboard = read("src/workspaces/crm/presentation/pages/DashboardPage.tsx");
const dashboardModel = read("src/workspaces/crm/read-models/dashboard/useDashboardReadModel.ts");

for (const [name, source] of Object.entries({ taskList, careList })) {
  assert.match(source, /OperationSavedViews/, `${name} must expose compact saved operational queues.`);
  assert.match(source, /OperationFilterPopover/, `${name} must provide a toolbar-anchored filter popover.`);
  assert.match(source, /displayMode/, `${name} must support table/card display modes.`);
  assert.doesNotMatch(source, /OperationMetricGrid/, `${name} must not restore oversized pseudo-KPI cards.`);
}

for (const [name, source] of Object.entries({ taskDetail, careDetail })) {
  assert.match(source, /OperationDetailTabs/, `${name} must use structured detail tabs.`);
  assert.match(source, /OperationLifecycleRail/, `${name} must show lifecycle from real record status.`);
  assert.doesNotMatch(source, /OperationInsightPanel|readinessScore|Sẵn sàng xử lý|Trung tâm điều phối/, `${name} must not use pseudo readiness/control-center UI.`);
}

assert.match(taskList, /TaskCreateModal/, "Task list creation must delegate to the canonical Task create form.");
assert.match(taskCreateModal, /createTaskCommand/, "The canonical Task create form must write through the typed Task command boundary.");
assert.match(taskList, /Của tôi/, "Tasks must expose Mine as a saved view.");
assert.match(taskList, /view=mine|searchParams/, "Tasks must accept the legacy My Work redirect view.");
assert.match(taskDetail, /rescheduleTaskCommand/, "Task detail must allow rescheduling canonical tasks.");
assert.match(taskDetail, /completeTaskCommand/, "Task detail must complete canonical tasks.");
assert.match(taskDetail, /reassignTaskCommand/, "Task detail must reassign canonical tasks instead of displaying a fake assignee action.");
assert.doesNotMatch(taskCreateModal + taskDetail, /(?:create|reschedule|complete|reassign)TaskSnapshot/, "Task presentation must not write through retired browser snapshots.");
assert.match(taskList, /variant="success" size="xs" className="text-white \[&_svg\]:stroke-white"/, "Task complete actions must use a white foreground on the semantic success background.");
assert.ok((taskList.match(/variant="danger" size="xs" className="text-white \[&_svg\]:stroke-white"/g) || []).length >= 2, "Task cancel and delete actions must use a white foreground on the semantic danger background.");
assert.doesNotMatch(taskDetail, /label:\s*vi\s*\?\s*["']Ngữ cảnh["']|label:\s*["']Context["']/, "Task detail must not expose a duplicated technical Context tab.");
assert.doesNotMatch(taskDetail, /font-black|font-extrabold/, "Task detail must keep a restrained typography hierarchy.");
assert.match(notificationsPage, /bg-violet-50\/35/ , "Unread notifications must use a soft surface rather than only heavy text.");
assert.match(notificationBell, /crm-scroll-y/ , "Notification popover must use the refined scrollbar surface.");
assert.match(notificationBell, /locale === "vi" \? "vi-VN" : "en-US"/, "Notification timestamps must follow the active locale.");

assert.match(myWorkPage, /Navigate/, "The retired My Work route must redirect instead of rendering another work source.");
assert.match(myWorkPage, /view=mine/, "The retired My Work route must redirect to the Tasks Mine view.");
assert.equal(fs.existsSync(path.join(root, "src/workspaces/crm/read-models/my-work")), false, "Retired My Work read-model code must be removed, not kept as a second work aggregate.");
assert.equal(fs.existsSync(path.join(root, "src/utils/myWorkSelectors.ts")), false, "Retired My Work selector facade must be removed.");

assert.match(calendar, /getTaskActivitySnapshot/, "Work Calendar must use canonical Tasks as its source.");
assert.match(calendar, /task\.assigneeId === currentMemberId/, "Work Calendar must show tasks assigned to the current member.");

assert.match(careList, /Phiếu hỗ trợ/, "Support list must use the approved support-ticket product term.");
assert.match(careDetail, /TaskCreateModal/, "Care detail must create a Task only through the canonical form.");
assert.match(careDetail, /recordRef:\s*\{\s*moduleKey:\s*[\"']support[\"']/, "Explicit Care tasks must point back to the Care Case.");
assert.doesNotMatch(careList + careDetail + careForm, /ensureSupportCaseWorkTask|ensureSupportFollowUpTask|SUPPORT_ACTIVE_WORK/, "Care Cases must not create mirror Tasks automatically.");
assert.doesNotMatch(careDetail, /Checklist|checklist|OperationInsightPanel|readiness/i, "Care detail must not expose hardcoded checklist or pseudo readiness UI.");
assert.doesNotMatch(careForm, /calculateSupportCaseSla|resolutionSteps\s*:|checklist\s*:/, "Care creation must not auto-generate SLA or checklist data.");
assert.doesNotMatch(workActivation, /ensureSupportCaseWorkTask|ensureSupportFollowUpTask|SUPPORT_ACTIVE_WORK/, "Work activation must not reintroduce automatic Care-to-Task mirroring.");

assert.doesNotMatch(taskRuntime, /task\.seed|TASK_SEED/, "Task runtime must not import demo seed data.");
assert.doesNotMatch(careRuntime, /supportCase\.mock|MOCK_SUPPORT_CASES/, "Care runtime must not import demo mock data.");
assert.equal(fs.existsSync(path.join(root, "src/modules/tasks/infrastructure/task.seed.ts")), false, "Task demo seed file must be removed.");
assert.equal(fs.existsSync(path.join(root, "src/modules/support/infrastructure/supportCase.mock.ts")), false, "Care demo mock file must be removed.");

assert.match(notificationModel, /return \[\]/, "CRM snapshots must not synthesize notifications.");
assert.match(notificationsPage, /useNotificationsReadModel/, "Notifications page must read persisted recipient notifications.");
assert.match(notificationBell, /useNotificationsReadModel/, "Notification bell must read the same persisted notification source.");
assert.doesNotMatch(notificationBell, /fixed inset-0 z-40/, "Notification popover must not install a full-screen pointer-intercepting backdrop.");
assert.match(notificationBell, /document\.addEventListener\("pointerdown", closeOnOutsidePointer, true\)/, "Notification popover must close through non-blocking outside-pointer detection.");
assert.match(notificationBell, /event\.key === "Escape"/, "Notification popover must close on Escape.");
assert.match(notificationBell, /\[location\.pathname, location\.search\]/, "Notification popover must close after navigation.");
for (const source of [notificationsPage, notificationBell, notificationModel]) {
  assert.doesNotMatch(source, /Welcome to CentrixCRM|Simulation Stream Initialized|VNPay payment issue|New Lead Assigned/, "Notifications must not contain demo or synthetic fallback messages.");
}

assert.doesNotMatch(sidebar, /label\("Việc của tôi"|label\("My Work"/, "Sidebar must not expose a duplicate My Work product function.");
assert.match(sidebar, /Phiếu hỗ trợ/, "Sidebar must use the approved support-ticket label.");

assert.match(leadTaskModals, /TaskCreateModal/, "Lead detail task creation must use the canonical Task form.");
assert.match(leadDetail, /getSupportCasesSnapshot/, "Lead detail must read Care Cases from the canonical Care repository.");
assert.match(leadDetail, /leadCareCases/, "Lead detail must render relationship-linked Care Cases rather than local mock cards.");
assert.match(contactRoute, /getTaskActivitySnapshot/, "Contact detail route must provide canonical task activity.");
assert.match(contactRoute, /getSupportCasesSnapshot/, "Contact detail route must subscribe to canonical Care Cases.");
assert.match(contactTaskModal, /TaskCreateModal/, "Contact detail task creation must use the canonical Task form.");
assert.match(contactDetail, /taskActivity\.tasks/, "Contact detail must render tasks from canonical task activity.");
assert.match(contactCareTab, /Phiếu hỗ trợ|Support Tickets/, "Contact detail must expose the shared Care Case records.");
assert.match(customerDetail, /model\.supportCases/, "Customer detail must render canonical Care Cases from the Customer 360 model.");
assert.match(customerDetail, /resolveWorkspaceMemberName/, "Customer detail must resolve Task/Care owners from the workspace member directory.");
assert.doesNotMatch(customerDetail, /Kế hoạch chăm sóc|Care plans|label: isVi \? "Hỗ trợ" : "Support"/, "Customer service workspace must be one Care surface, not duplicated Care Plan and Support tabs.");
assert.match(customerDetail, /label: relationshipWorkspaceLabel\("support", isVi\)[\s\S]*count: model\.supportCases\.length/, "Customer service tab count must come from canonical Care Cases.");
assert.doesNotMatch(customerPage, /createCustomerCareCardWithTask|careOpen|careDraft/, "Customer 360 must not keep a separate Care Plan creation flow.");
assert.doesNotMatch(customerHeader + customerInsight, /Tạo phiếu chăm sóc|Create care case/, "Customer actions must not duplicate Care with a separate Support action.");
assert.match(customerHeader + customerInsight, /Tạo phiếu hỗ trợ|Create support ticket/i, "Customer actions must create the unified Care Case.");
assert.match(careForm, /<Input[\s>]/, "Care form text fields must use the shared bordered Input control.");
assert.match(careForm, /<Textarea[\s>]/, "Care form description must use the shared bordered Textarea control.");
assert.match(careForm, /<Select[\s>]/, "Care form choice fields must use the shared bordered Select control.");
assert.doesNotMatch(careForm, /className="form-control"/, "Care form must not rely on unbordered page-local form-control styling.");

assert.match(taskCommands, /publishNotification/, "Task assignment events must publish persisted recipient notifications.");
assert.match(careRepositoryCommands, /publishNotification/, "Care assignment and customer-reply events must publish persisted recipient notifications.");

assert.match(dashboardModel, /getTaskActivitySnapshot/, "Dashboard must project work from canonical Tasks.");
assert.doesNotMatch(dashboard, /MOCK_USERS|taskDone1|slaFirstResponseTimeLeft/, "Dashboard work and care queues must not use fake users, tasks, or SLA countdowns.");
assert.equal(fs.existsSync(path.join(root, "src", "data.ts")), false, "The retired global data module must not return.");

for (const source of [taskList, taskDetail, careList, careDetail, calendar]) {
  assert.doesNotMatch(source, /0900000000|1000g|mock task only|local-only/i, "Work operation screens must not rely on fake hardcoded operational data.");
}

console.log("Work and care operations contracts PASS");
