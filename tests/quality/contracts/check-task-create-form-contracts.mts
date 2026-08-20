import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = repositoryRoot;
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

const canonicalPath = "src/modules/tasks/presentation/components/TaskCreateModal.tsx";
const canonical = read(canonicalPath);

for (const requiredToken of [
  "TaskCreateModal",
  "canonical-task-create-form",
  "createTaskCommand",
  "assigneeId",
  "dueAt",
  "priority",
  "description",
  "recordRef",
  "relationshipRef",
]) {
  assert.ok(canonical.includes(requiredToken), `${canonicalPath} must retain ${requiredToken}.`);
}

for (const forbiddenToken of [
  'value="MEDIUM"',
  "task status",
  "Trạng thái công việc",
  "reminder",
  "Nhắc nhở",
]) {
  assert.ok(!canonical.includes(forbiddenToken), `${canonicalPath} must not reintroduce unsupported create fields: ${forbiddenToken}.`);
}

const callers = [
  "src/modules/tasks/presentation/pages/TaskListPage.tsx",
  "src/modules/leads/presentation/components/LeadDetailModals.tsx",
  "src/modules/contacts/presentation/detail/actions/ContactTaskModal.tsx",
  "src/modules/customers/presentation/pages/Customer360Page.tsx",
  "src/modules/organizations/presentation/pages/OrganizationAccountDetailPage.tsx",
  "src/modules/support/presentation/pages/SupportCaseDetailPage.tsx",
];

for (const caller of callers) {
  const source = read(caller);
  assert.ok(source.includes("TaskCreateModal"), `${caller} must use the canonical TaskCreateModal.`);
}

const duplicateFormTokens = [
  "taskDraft",
  "taskForm",
  "taskTitle",
  "taskDescription",
  "taskDueAt",
  "taskPriority",
  "taskAssigneeId",
  "contact-task-form",
  "lead-quick-task-form",
  "customer-task-form",
  "organization-task-form",
];

for (const caller of callers) {
  const source = read(caller);
  for (const token of duplicateFormTokens) {
    assert.ok(!source.includes(token), `${caller} must not own duplicate Task create state or markup: ${token}.`);
  }
}

const taskPresentationFiles = fs.readdirSync(path.join(root, "src/modules/tasks/presentation/pages"))
  .filter((name) => name.endsWith(".tsx"))
  .map((name) => `src/modules/tasks/presentation/pages/${name}`);

for (const file of taskPresentationFiles) {
  const source = read(file);
  assert.ok(!source.includes("createTaskSnapshot("), `${file} must delegate manual Task creation to TaskCreateModal.`);
}
assert.ok(!canonical.includes("createTaskSnapshot("), `${canonicalPath} must not write through the retired browser snapshot boundary.`);

console.log(`Task create form contracts PASS: 1 canonical form, ${callers.length} standardized callers, zero duplicate create-state tokens.`);
