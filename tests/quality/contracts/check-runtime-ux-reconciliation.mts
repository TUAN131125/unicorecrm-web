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
assert.match(connectedContacts, /commands: new ContactHttpCommandAdapter\(api\)/u, "Connected Contact Create must use the authoritative command adapter.");
const contactCommandAdapter = read("src/modules/contacts/infrastructure/http/ContactHttpCommandAdapter.ts");
assert.match(contactCommandAdapter, /api\.createContact/u, "The connected Contact command boundary must retain admitted Create.");
assert.match(contactCommandAdapter, /api\.updateContact/u, "The connected Contact command boundary must expose admitted Update.");
assert.match(contactCommandAdapter, /api\.archiveContact/u, "The connected Contact command boundary must expose admitted Archive.");
assert.match(contactCommandAdapter, /options\(input\.expectedVersion\)/u, "Contact Archive must send the authoritative resource version.");
const contactPublicApi = read("src/modules/contacts/public/contacts.ts");
assert.match(contactPublicApi, /isContactOperationReady\(CONTACT_CREATE_OPERATION\)[\s\S]*Boolean\(getContactApiRuntime\(\)\.commands\)/u, "Contact Create availability must require both canonical admission and runtime support.");
assert.match(contactPublicApi, /isContactOperationReady\(CONTACT_UPDATE_OPERATION\)/u, "Contact Update availability must remain independently authority-gated.");
assert.match(contactPublicApi, /!isContactOperationReady\(CONTACT_ARCHIVE_OPERATION\)/u, "Contact Archive availability must remain independently authority-gated.");
const contactOpenApi = JSON.parse(read("docs/api/openapi.json")) as { paths: Record<string, Record<string, { operationId?: string; "x-contract-status"?: string }>> };
const contactStatuses = new Map<string, string>();
for (const pathItem of Object.values(contactOpenApi.paths)) {
  for (const operation of Object.values(pathItem)) {
    if (operation.operationId) contactStatuses.set(operation.operationId, operation["x-contract-status"] ?? "PRODUCTION_CONTRACT_READY");
  }
}
assert.equal(contactStatuses.get("createContact"), "PRODUCTION_CONTRACT_READY");
assert.equal(contactStatuses.get("updateContact"), "PRODUCTION_CONTRACT_READY");
assert.equal(contactStatuses.get("archiveContact"), "PRODUCTION_CONTRACT_READY");
const contactDetailController = read("src/modules/contacts/presentation/hooks/useContactDetailController.tsx");
const contactListController = read("src/modules/contacts/presentation/hooks/useContactListController.tsx");
assert.doesNotMatch(`${contactDetailController}\n${contactListController}`, /restoreContactCommand/u, "C4 must not expose blocked Contact Restore.");
assert.match(contactDetailController, /access\.canPerform\("contacts", "delete"\)/u, "Contact Archive authorization must require contacts.delete.");
const contactList = read("src/modules/contacts/presentation/views/ContactListView.tsx");
assert.match(contactList, /hidden: !canCreateContact/u, "Unavailable Contact create/import actions must not render.");
assert.match(contactList, /canUpdateContact && <ContactBulkChangeOwnerModal/u, "Unavailable Contact update must not expose its bulk owner mutation.");
const contactDetailPage = read("src/modules/contacts/presentation/pages/ContactDetailPage.tsx");
assert.match(contactDetailPage, /getContactDetailResource\(contactId/u, "Contact Detail must load the authoritative detail operation instead of relying on list cache.");
assert.match(contactDetailPage, /failure\?\.category === "AUTHORIZATION"/u, "Contact Detail must distinguish access denial from not-found.");
assert.match(contactDetailPage, /failure\?\.category === "NOT_FOUND"/u, "Contact Detail must expose deterministic not-found state.");
assert.match(contactDetailPage, /detailQuery\.refresh\(\)/u, "Retryable Contact Detail failures must expose refresh.");
const contactCollectionHook = read("src/modules/contacts/presentation/hooks/useContacts.ts");
assert.match(contactCollectionHook, /query\.error\?\.category === "AUTHORIZATION"[\s\S]*replaceContacts\(\[\]\)/u, "A denied connected list read must not expose stale cached Contacts as successful data.");
const contactReadAdapter = read("src/modules/contacts/infrastructure/http/ContactHttpApiAdapter.ts");
assert.match(contactReadAdapter, /listContacts<ContactList>\(\{\}, signal\)/u, "Contact list must serialize only the currently admitted empty query contract.");
assert.doesNotMatch(contactReadAdapter, /search:|sort:|cursor:|limit:/u, "Contact list must not simulate unsupported authoritative query semantics.");

console.log("Connected runtime UX reconciliation: PASS");
