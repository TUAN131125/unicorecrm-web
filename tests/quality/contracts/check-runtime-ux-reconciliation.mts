import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

const actionDropdown = read("src/components/crm/ActionDropdown.tsx");
assert.match(actionDropdown, /<RowActionPortal/u, "Page-header actions must use the canonical floating portal.");
assert.doesNotMatch(actionDropdown, /createPortal/u, "ActionDropdown must not maintain a competing portal implementation.");

for (const path of [
  "src/modules/leads/presentation/components/LeadDetailMoreMenu.tsx",
  "src/modules/leads/presentation/components/LeadSavedViewSelector.tsx",
  "src/modules/contacts/presentation/list/ContactSavedViewSelector.tsx",
]) {
  assert.match(read(path), /<RowActionPortal/u, `${path} must render through the canonical floating portal.`);
}

const queryNotice = read("src/shared/operations/AuthoritativeQueryNotice.tsx");
assert.match(queryNotice, /formatApplicationError/u, "Query failures must retain their classified user-facing message.");
assert.match(queryNotice, /return null/u, "Healthy query state must render no status banner.");
assert.doesNotMatch(queryNotice, /Dữ liệu authoritative từ backend|Dữ liệu backend cập nhật lúc|Authoritative backend data|Backend data updated at/u);

const taskIdentity = [
  read("src/modules/tasks/presentation/pages/TaskListPage.tsx"),
  read("src/modules/tasks/presentation/pages/TaskDetailPage.tsx"),
  read("src/modules/tasks/presentation/components/TaskCreateModal.tsx"),
].join("\n");
assert.doesNotMatch(taskIdentity, /access\.accountId|"current-user"/u, "Task business identity must not fall back to AccountId or a fake member.");

const connectedContacts = read("src/modules/contacts/infrastructure/http/createContactConnectedApiRuntime.ts");
assert.match(connectedContacts, /declareUnavailableBusinessOperation\(CONTACT_CREATE_OPERATION\)/u);
assert.match(connectedContacts, /declareUnavailableBusinessOperation\(CONTACT_UPDATE_OPERATION\)/u);
const contactList = read("src/modules/contacts/presentation/views/ContactListView.tsx");
assert.match(contactList, /hidden: !canCreateContact/u, "Unavailable Contact create/import actions must not render.");
assert.match(contactList, /canUpdateContact && <ListBulkActionBar/u, "Unavailable Contact writes must not expose bulk actions.");

console.log("Connected runtime UX reconciliation: PASS");
