import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import {
  archiveContact,
  saveContact,
  updateContact,
  updateManyContacts,
} from "@/modules/contacts/application/commands/contactRepositoryCommands";
import {
  appendActivityToContact,
  changeContactStatus,
  reassignContact,
} from "@/modules/contacts/application/commands/contactCommands";
import {
  getContactStatusCounts,
  queryContacts,
} from "@/modules/contacts/application/queries/contactQueries";
import type { Contact } from "@/modules/contacts";
import { InMemoryContactRepository } from "@/modules/contacts/infrastructure/InMemoryContactRepository";
import { CONTACT_MODULE_MANIFEST } from "@/modules/contacts/manifest";
import {
  createContactPresentationSnapshot,
  getDefaultContactVisibleColumnIds,
  isDuplicateContactViewName,
  normalizeContactPresentationSnapshot,
} from "@/modules/contacts/presentation/model/contactSavedViewPreferences";
import { ModuleRegistry } from "@/platform/module-registry/ModuleRegistry";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const seed: Contact[] = [
  createContact("contact-1", "Nguyen An", "active", "u1", "0901000001"),
  createContact("contact-2", "Tran Binh", "needs_follow_up", "u2", "0901000002"),
];

const listeners = new Map<string, Set<(payload: unknown) => void>>();
const repository = new InMemoryContactRepository(seed, {
  publish: (eventName, payload) => listeners.get(eventName)?.forEach((listener) => listener(payload)),
  subscribe: (eventName, listener) => {
    const bucket = listeners.get(eventName) ?? new Set();
    bucket.add(listener as (payload: unknown) => void);
    listeners.set(eventName, bucket);
    return () => bucket.delete(listener as (payload: unknown) => void);
  },
});

let observedCount = 0;
const unsubscribe = repository.subscribe((contacts) => { observedCount = contacts.length; });
saveContact(repository, createContact("contact-3", "Le Cuong", "active", "u1", "0901000003"));
assert.equal(repository.list().length, 3);
assert.equal(observedCount, 3);
unsubscribe();

updateContact(repository, "contact-2", (contact) => ({ ...contact, companyName: "Updated Co" }));
assert.equal(repository.getById("contact-2")?.companyName, "Updated Co");

const updatedMany = updateManyContacts(repository, ["contact-1", "contact-2"], (contact) => ({ ...contact, ownerId: "u9" }));
assert.equal(updatedMany, 2);
assert.equal(repository.getById("contact-1")?.ownerId, "u9");

changeContactStatus(repository, "contact-2", "in_consulting");
assert.equal(repository.getById("contact-2")?.status, "in_consulting");

appendActivityToContact(repository, "contact-2", {
  id: "activity-1",
  type: "note",
  title: "Follow up",
  description: "Called customer",
  createdAt: "2026-07-06T12:00:00.000Z",
  author: "Tester",
});
assert.equal(repository.getById("contact-2")?.activities?.[0]?.id, "activity-1");

reassignContact(repository, "contact-2", "u7");
assert.equal(repository.getById("contact-2")?.ownerId, "u7");

assert.equal(queryContacts(repository, { search: "updated co" }).length, 1);
assert.equal(queryContacts(repository, { search: "Nguyen" }).length, 1);
assert.equal(getContactStatusCounts(repository).all, 3);

archiveContact(repository, "contact-3", { reason: "Retention policy contract", actorId: "tester", actorName: "Tester", now: "2026-07-09T00:00:00.000Z" });
assert.equal(repository.list().length, 3, "Archiving a Contact must retain the record.");
assert.equal(repository.getById("contact-3")?.status, "archived");

const registry = new ModuleRegistry().register(CONTACT_MODULE_MANIFEST);
assert.equal(registry.get("contacts")?.routes.length, 2);

const defaultVisibleColumns = getDefaultContactVisibleColumnIds();
const currentColumnSnapshot = createContactPresentationSnapshot({
  visibleColumns: ["code", "decisionRole", "fullName", "workPhone"],
  columnWidths: { code: 111, workPhone: 144 },
  filters: { statusFilter: "active" },
  sortBy: "nameAsc",
  viewMode: "table",
});
assert.deepEqual(currentColumnSnapshot.orderedColumnIds, ["code", "decisionRole", "fullName", "workPhone"], "Saved view must snapshot the current visible column order.");
assert.deepEqual(currentColumnSnapshot.visibleColumnIds, ["code", "decisionRole", "fullName", "workPhone"], "Saved view must snapshot current field visibility.");
assert.equal(currentColumnSnapshot.columnWidths?.workPhone, 144, "Saved view should preserve current column widths when available.");
assert.equal(currentColumnSnapshot.filters?.statusFilter, "active", "Saved view should preserve filter state when provided.");
assert.equal(currentColumnSnapshot.sortBy, "nameAsc", "Saved view should preserve sort state when provided.");
assert.equal(currentColumnSnapshot.viewMode, "table", "Saved view should preserve list view mode when provided.");

const restoredSnapshot = normalizeContactPresentationSnapshot({
  visibleColumnIds: ["code", "missing-column", "fullName", "code", "workEmail"],
  orderedColumnIds: ["code", "missing-column", "fullName", "code", "workEmail"],
});
assert.deepEqual(restoredSnapshot.orderedColumnIds, ["code", "fullName", "workEmail"], "Applying a saved view must ignore stale/duplicate column ids without crashing.");
assert.deepEqual(defaultVisibleColumns, getDefaultContactVisibleColumnIds(), "Default Contact list column configuration must not be mutated by saved-view snapshots.");
assert.equal(isDuplicateContactViewName([{ key: "custom_1", labelKey: "Test", isShared: false }], " test "), true, "Duplicate saved view names must be rejected case-insensitively.");


const presentationRoot = path.resolve("src/modules/contacts/presentation");
for (const file of walkAllFiles(presentationRoot)) {
  if (!/\.(ts|tsx)$/.test(file)) continue;
  const source = readPresentationComposition(file, "utf8");
  assert.equal(/\blocalStorage\s*\./.test(source), false, file + " must use PreferenceStore instead of direct browser storage");
}

const contactRuntimeSource = readPresentationComposition("src/modules/contacts/runtime/contactModuleRuntime.ts", "utf8");
assert.match(contactRuntimeSource, /WorkspaceScopedStorageAdapter/, "Contact presentation preferences must be workspace-scoped.");
assert.match(contactRuntimeSource, /contacts/, "Contact preferences must stay scoped to the Contact list context.");

const contactViewSettingsSource = readPresentationComposition("src/modules/contacts/presentation/hooks/useContactListViewSettings.ts", "utf8");
assert.match(contactViewSettingsSource, /createContactCustomSavedView\(customViews, name, presentation\)/, "Custom saved views must store the submitted presentation snapshot through the model owner.");
assert.match(contactViewSettingsSource, /setActiveView\(result\.view\.key\)/, "Newly created saved views must become active immediately.");
assert.match(contactViewSettingsSource, /updateContactCustomSavedView/, "Custom saved views must support explicit in-place update instead of implicit overwrite.");
assert.match(contactViewSettingsSource, /setActiveView\("allContacts"\)/, "Deleting the active custom view must return to the default system view.");
assert.match(contactViewSettingsSource, /return applyDefaultPresentation\(\)/, "Deleting/resetting a view must restore the full default presentation configuration.");

const contactListPageSource = readPresentationComposition("src/modules/contacts/presentation/pages/ContactListPage.tsx", "utf8");
assert.equal(contactListPageSource.includes("window.prompt"), false, "Saved-view edit must use the shared modal, not window.prompt.");
assert.equal(contactListPageSource.includes("common.done"), false, "Saved-view modal must not render common.done as the primary action.");
assert.equal(contactListPageSource.includes("setTimeout(() => viewNameInputRef"), false, "Saved-view autofocus must not depend on a timer workaround.");
assert.match(contactListPageSource, /const snapshot = getCurrentViewSnapshot\(\);/, "Save action must snapshot current Contact list presentation state at explicit submit time.");
assert.match(contactListPageSource, /<Pencil size=\{14\}/, "Custom saved views must expose an icon edit action.");
assert.match(contactListPageSource, /<Trash2 size=\{14\}/, "Custom saved views must expose an icon delete action.");
assert.match(contactListPageSource, /ConfirmDialog/, "Deleting a saved view must use the shared confirmation dialog.");
assert.match(contactListPageSource, /const handleAddViewClick = \(\) => \{[\s\S]*?setSavedViewDialog\(\{ mode: "create" \}\);[\s\S]*?setIsViewDropdownOpen\(false\);[\s\S]*?\};/, "Clicking Add View must enter create mode and open the single page-owned saved-view dialog state.");
assert.match(contactListPageSource, /onAddViewClick=\{handleAddViewClick\}/, "Contact saved-view selector must receive the create-view click handler.");
assert.match(contactListPageSource, /<SavedViewNameModal[\s\S]*?isOpen=\{savedViewDialog !== null\}[\s\S]*?mode=\{savedViewDialog\?\.mode \?\? "create"\}[\s\S]*?name=\{viewName\}[\s\S]*?onSubmit=\{handleSubmitSavedView\}/, "Create/edit saved views must delegate to the canonical shared modal while preserving page-owned dialog state.");

const savedViewNameModalSource = readPresentationComposition("src/components/crm/SavedViewNameModal.tsx", "utf8");
assert.match(savedViewNameModalSource, /<Input[\s\S]*?autoFocus[\s\S]*?placeholder=\{vi \? "Nhập tên giao diện" : "Enter view name"\}/, "Canonical saved-view modal must render an autofocus shared input.");
assert.match(savedViewNameModalSource, /vi \? "Hủy" : "Cancel"/, "Canonical saved-view modal must render a cancel action.");
assert.match(savedViewNameModalSource, /vi \? "Lưu giao diện" : "Save view"/, "Canonical saved-view modal must render the Save View action.");

const contactSavedViewSelectorSource = readPresentationComposition("src/modules/contacts/presentation/list/ContactSavedViewSelector.tsx", "utf8");
assert.match(contactSavedViewSelectorSource, /<RowActionPortal/, "Saved View menu must use the canonical portal overlay.");
assert.match(contactSavedViewSelectorSource, /anchorEl=\{triggerRef\.current\}/, "Saved View menu must position from its trigger geometry.");
assert.equal(contactSavedViewSelectorSource.includes('className="fixed inset-0 z-[2999]"'), false, "Saved View must not maintain a competing local click-away layer.");
assert.match(contactSavedViewSelectorSource, /onClick=\{onAddViewClick\}/, "Add View button must call the parent create-view callback directly.");
assert.equal(contactSavedViewSelectorSource.includes("event.preventDefault()"), false, "Add View must not rely on event suppression as a hit-testing workaround.");
assert.equal(contactSavedViewSelectorSource.includes("event.stopPropagation()"), false, "Add View must not rely on propagation suppression as a hit-testing workaround.");

console.log("Contact module checks: OK");

function createContact(
  id: string,
  fullName: string,
  status: Contact["status"],
  ownerId: string,
  phone: string,
): Contact {
  return {
    id,
    name: fullName,
    fullName,
    status,
    ownerId,
    phone,
    mobilePhone: phone,
    createdAt: "2026-07-01T00:00:00.000Z",
    activities: [],
  };
}
