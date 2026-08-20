// @ts-nocheck -- Runtime-only jsdom contract test; jsdom 26 does not bundle TypeScript declarations.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  createContactCustomSavedView,
  createContactPresentationSnapshot,
  deleteContactCustomSavedView,
  getDefaultContactPresentationSnapshot,
  normalizeContactPresentationSnapshot,
  resolveContactPresentationSnapshot,
  updateContactCustomSavedView,
  type ContactSavedViewItem,
} from "../../../src/modules/contacts/presentation/model/contactSavedViewPreferences";

const currentColumns = ["code", "mobilePhone", "fullName", "workPhone"];
const savedSnapshot = createContactPresentationSnapshot({
  visibleColumns: currentColumns,
  columnWidths: { code: 120, mobilePhone: 160, removedColumn: 999 },
  filters: { statusFilter: "active" },
  sortBy: "fullName",
  viewMode: "table",
});
assert.deepEqual(savedSnapshot.visibleColumnIds, currentColumns, "Saved view must snapshot the live visible columns in their current order.");
assert.deepEqual(savedSnapshot.orderedColumnIds, currentColumns, "Saved view must preserve the live column order.");
assert.equal(savedSnapshot.columnWidths?.removedColumn, undefined, "Unknown column widths must not survive normalization.");

const defaultView: ContactSavedViewItem = {
  key: "allContacts",
  labelKey: "contactViews.allContacts",
  isShared: true,
};
const defaultBefore = structuredClone(getDefaultContactPresentationSnapshot());
const created = createContactCustomSavedView([defaultView], "  Test  ", savedSnapshot, new Date("2026-07-09T00:00:00.000Z"));
assert.equal(created.ok, true, "Creating a valid saved view must succeed.");
if (!created.ok) throw new Error("Expected saved view creation to succeed.");
assert.equal(created.view.labelKey, "Test", "Saved view names must be trimmed.");
assert.deepEqual(created.view.presentation.orderedColumnIds, currentColumns, "Create must persist the submitted current presentation snapshot.");
assert.deepEqual(getDefaultContactPresentationSnapshot(), defaultBefore, "Creating a custom view must not mutate the default presentation.");

const duplicate = createContactCustomSavedView(created.views, " test ", savedSnapshot, new Date("2026-07-09T00:00:01.000Z"));
assert.deepEqual(duplicate, { ok: false, error: "duplicate" }, "Duplicate saved view names must fail without overwriting an existing view.");
const empty = createContactCustomSavedView(created.views, "   ", savedSnapshot);
assert.deepEqual(empty, { ok: false, error: "empty" }, "Whitespace-only saved view names must fail validation.");

const resolvedSaved = resolveContactPresentationSnapshot(created.view.presentation);
assert.deepEqual(resolvedSaved.orderedColumnIds, currentColumns, "Selecting a saved view must restore the saved column order.");
assert.deepEqual(resolvedSaved.visibleColumnIds, currentColumns, "Selecting a saved view must restore saved field visibility.");

const editedColumns = ["fullName", "workEmail", "code"];
const editedSnapshot = createContactPresentationSnapshot({
  visibleColumns: editedColumns,
  filters: { ownerFilter: "user_1" },
  sortBy: "recentlyUpdated",
  viewMode: "card",
});
const edited = updateContactCustomSavedView(
  created.views,
  created.view.key,
  "Test Updated",
  editedSnapshot,
  new Date("2026-07-09T00:05:00.000Z"),
);
assert.equal(edited.ok, true, "Editing an existing custom view must succeed.");
if (!edited.ok) throw new Error("Expected saved view update to succeed.");
assert.equal(edited.view.key, created.view.key, "Edit must preserve saved view identity.");
assert.equal(edited.views.filter((view) => !view.isShared).length, 1, "Edit must update in place instead of creating a duplicate view.");
assert.deepEqual(edited.view.presentation.orderedColumnIds, editedColumns, "Edit must snapshot the current presentation at explicit update time.");
assert.deepEqual(getDefaultContactPresentationSnapshot(), defaultBefore, "Editing a custom view must not mutate the default presentation.");

const staleSchema = normalizeContactPresentationSnapshot({
  visibleColumnIds: ["code", "removedColumn", "code", "workPhone"],
  orderedColumnIds: ["removedColumn", "workPhone", "code", "workPhone"],
  columnWidths: { code: 135, removedColumn: 999 },
});
assert.deepEqual(staleSchema.visibleColumnIds, ["workPhone", "code"], "Unknown and duplicate column IDs must be discarded safely.");
assert.deepEqual(staleSchema.orderedColumnIds, ["workPhone", "code"], "Normalized saved views must keep a duplicate-free valid order.");
assert.deepEqual(staleSchema.columnWidths, { code: 135 }, "Unknown width entries must be discarded safely.");

const deleted = deleteContactCustomSavedView(edited.views, edited.view.key);
assert.equal(deleted.deleted, true, "Deleting a custom view must delete exactly that view.");
assert.equal(deleted.views.some((view) => view.key === edited.view.key), false, "Deleted saved view must not remain in state.");
assert.equal(deleted.views.some((view) => view.key === "allContacts"), true, "Deleting a custom view must preserve the system/default view.");
assert.deepEqual(getDefaultContactPresentationSnapshot(), defaultBefore, "Deleting a custom view must not mutate the default presentation.");
const protectedDefault = deleteContactCustomSavedView(deleted.views, "allContacts");
assert.equal(protectedDefault.deleted, false, "System/default views must not be deletable.");

const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
  url: "http://localhost/contacts",
  pretendToBeVisual: true,
});
const { window } = dom;
Object.defineProperties(globalThis, {
  window: { value: window, configurable: true },
  document: { value: window.document, configurable: true },
  navigator: { value: window.navigator, configurable: true },
  localStorage: { value: window.localStorage, configurable: true },
  HTMLElement: { value: window.HTMLElement, configurable: true },
  Element: { value: window.Element, configurable: true },
  Node: { value: window.Node, configurable: true },
  Event: { value: window.Event, configurable: true },
  MouseEvent: { value: window.MouseEvent, configurable: true },
  KeyboardEvent: { value: window.KeyboardEvent, configurable: true },
  MutationObserver: { value: window.MutationObserver, configurable: true },
  getComputedStyle: { value: window.getComputedStyle.bind(window), configurable: true },
  requestAnimationFrame: { value: window.requestAnimationFrame.bind(window), configurable: true },
  cancelAnimationFrame: { value: window.cancelAnimationFrame.bind(window), configurable: true },
  IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true },
});
Object.defineProperty(window.HTMLElement.prototype, "attachEvent", { value: () => undefined, configurable: true });
Object.defineProperty(window.HTMLElement.prototype, "detachEvent", { value: () => undefined, configurable: true });
Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", { value: () => undefined, configurable: true });
window.localStorage.setItem("centrix_locale", "vi");

const { DevelopmentAuthAdapter } = await import("../../../src/platform/identity-auth/infrastructure/DevelopmentAuthAdapter");
const auth = new DevelopmentAuthAdapter();
const signIn = auth.signIn({
  email: "admin@unicorecrm.local",
  password: "admin123",
  deviceLabel: "contact saved view contract test",
});
assert.equal(signIn.ok, true, "Administrative demo sign-in must create an AAL1 session.");
if (!signIn.ok) throw new Error("Expected development admin sign-in success.");
window.localStorage.setItem("unicore_auth_session_v2", JSON.stringify(signIn.value));

const { initializeApplicationComposition } = await import("../../../src/app/composition");
await initializeApplicationComposition({ mode: "demo" });

const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { MemoryRouter } = await import("react-router-dom");
const { I18nProvider } = await import("../../../src/i18n/index");
const { ContactListPage } = await import("../../../src/modules/contacts/presentation/pages/ContactListPage");

const rootElement = window.document.getElementById("root");
assert.ok(rootElement, "UI test root must exist.");
const root = createRoot(rootElement);
const renderPage = async () => {
  await act(async () => {
    root.render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(
          I18nProvider,
          null,
          React.createElement(ContactListPage, {
            customers: [],
            setCustomers: () => undefined,
            deals: [],
            setDeals: () => undefined,
          }),
        ),
      ),
    );
  });
};
const flush = async (delay = 0) => {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, delay));
  });
};
const click = async (element: Element) => {
  await act(async () => {
    element.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await flush();
};
const findButton = (text: string): HTMLButtonElement | undefined =>
  [...window.document.querySelectorAll("button")].find((button) => button.textContent?.includes(text)) as HTMLButtonElement | undefined;
const setInputValue = async (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  assert.ok(setter, "Input value setter must exist.");
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
  await flush();
};

await renderPage();
assert.equal(window.document.querySelector('[aria-label^="Sửa giao diện "]'), null, "Edit icon must be hidden for the default view.");
assert.equal(window.document.querySelector('[aria-label^="Xóa giao diện "]'), null, "Delete icon must be hidden for the default view.");

const trigger = window.document.getElementById("contact-view-dropdown-trigger");
assert.ok(trigger, "Contact list toolbar must render the saved view selector trigger.");
await click(trigger);
const addViewButton = findButton("Thêm giao diện");
assert.ok(addViewButton, "Saved view selector must render the Thêm giao diện action.");
const dropdownLayer = addViewButton.closest(".z-\\[3000\\]");
assert.ok(dropdownLayer, "Saved view menu must use the shared dropdown overlay layer so the add action remains clickable.");
await click(addViewButton);

let dialog = window.document.querySelector('[role="dialog"]');
assert.ok(dialog, "Clicking Thêm giao diện must open the create modal.");
assert.match(dialog.textContent || "", /Tạo giao diện mới/, "Create modal must use the expected title.");
assert.match(dialog.textContent || "", /Lưu cấu hình hiển thị hiện tại để sử dụng lại\./, "Create modal must explain the saved presentation snapshot.");
assert.ok(findButton("Hủy"), "Create modal must render Hủy.");
assert.ok(findButton("Lưu giao diện"), "Create modal must render Lưu giao diện.");
let nameInput = window.document.querySelector('input[placeholder="Nhập tên giao diện"]') as HTMLInputElement | null;
assert.ok(nameInput, "Create modal must render the saved view name input.");
assert.equal(window.document.activeElement, nameInput, "Saved view name input must autofocus when the modal opens.");

await click(findButton("Hủy")!);
await flush(220);
assert.equal(window.document.querySelector('[role="dialog"]'), null, "Hủy must close the create modal.");
await click(trigger);
await click(findButton("Thêm giao diện")!);
assert.ok(window.document.querySelector('[role="dialog"]'), "The create modal must reopen after it has been closed once.");

await act(async () => {
  window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
});
await flush(220);
assert.equal(window.document.querySelector('[role="dialog"]'), null, "Escape must close the saved view modal through the shared Modal contract.");

await click(trigger);
await click(findButton("Thêm giao diện")!);
nameInput = window.document.querySelector('input[placeholder="Nhập tên giao diện"]') as HTMLInputElement | null;
assert.ok(nameInput, "Saved view input must exist after reopening.");
await setInputValue(nameInput, "Test");
await click(findButton("Lưu giao diện")!);
await flush(600);
assert.equal(window.document.querySelector('[role="dialog"]'), null, "Successful create must close the modal.");
const refreshedTrigger = window.document.getElementById("contact-view-dropdown-trigger");
assert.match(refreshedTrigger?.textContent || "", /Test/, "The newly created saved view must become active immediately.");
assert.ok(window.document.querySelector('[aria-label="Sửa giao diện Test"]'), "Edit icon must appear immediately after a custom view becomes active.");
assert.ok(window.document.querySelector('[aria-label="Xóa giao diện Test"]'), "Delete icon must appear immediately after a custom view becomes active.");

const persistedSavedViewEntry = Object.keys(window.localStorage)
  .map((key) => window.localStorage.getItem(key))
  .find((value) => value?.includes('"labelKey":"Test"'));
assert.ok(persistedSavedViewEntry, "Saved view must persist through the existing workspace-scoped Contact preference boundary.");

await click(window.document.querySelector('[aria-label="Sửa giao diện Test"]')!);
dialog = window.document.querySelector('[role="dialog"]');
assert.ok(dialog, "Edit icon must open the edit modal.");
assert.match(dialog.textContent || "", /Sửa giao diện/, "Edit modal must use edit copy.");
nameInput = window.document.querySelector('input[placeholder="Nhập tên giao diện"]') as HTMLInputElement | null;
assert.equal(nameInput?.value, "Test", "Edit modal must load the current saved view name.");
await setInputValue(nameInput!, "Test Updated");
await click(findButton("Lưu thay đổi")!);
await flush(220);
assert.match(trigger.textContent || "", /Test Updated/, "Edit must rename the same active view.");
assert.ok(window.document.querySelector('[aria-label="Sửa giao diện Test Updated"]'), "Edit icon aria-label must follow the updated custom view name.");

await act(async () => root.unmount());
const remountRoot = createRoot(rootElement);
await act(async () => {
  remountRoot.render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        I18nProvider,
        null,
        React.createElement(ContactListPage, {
          customers: [],
          setCustomers: () => undefined,
          deals: [],
          setDeals: () => undefined,
        }),
      ),
    ),
  );
});
await flush();
const remountTrigger = window.document.getElementById("contact-view-dropdown-trigger");
assert.ok(remountTrigger, "Saved view selector must render after reinitialization.");
await click(remountTrigger);
assert.ok(findButton("Test Updated"), "Persisted saved view must remain available after reinitialization in the same workspace/list scope.");
await click(findButton("Test Updated")!);
assert.ok(window.document.querySelector('[aria-label="Xóa giao diện Test Updated"]'), "Selecting a persisted custom view must expose its delete icon.");
await click(window.document.querySelector('[aria-label="Xóa giao diện Test Updated"]')!);
assert.ok(window.document.querySelector('[role="dialog"]'), "Delete must use the shared confirmation dialog.");
await click(findButton("Xóa giao diện")!);
await flush(220);
assert.match(remountTrigger.textContent || "", /Tất cả liên hệ|allContacts/, "Deleting the active custom view must return to the default view.");
assert.equal(window.document.querySelector('[aria-label^="Sửa giao diện "]'), null, "Edit icon must disappear after returning to the default view.");
assert.equal(window.document.querySelector('[aria-label^="Xóa giao diện "]'), null, "Delete icon must disappear after returning to the default view.");

await act(async () => remountRoot.unmount());
dom.window.close();
await new Promise<void>((resolve) => setImmediate(resolve));
console.log("Contact saved view contracts: PASS");
