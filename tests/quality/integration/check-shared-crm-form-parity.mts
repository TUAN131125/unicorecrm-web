import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost", pretendToBeVisual: true });
const { window } = dom;
const browserErrors: unknown[] = [];
window.addEventListener("error", event => browserErrors.push(event.error));
Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", { value() {}, configurable: true });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "SVGElement", "Element", "Node", "Event", "CustomEvent", "EventTarget", "MutationObserver"] as const) {
  Object.defineProperty(globalThis, key, { value: key === "window" ? window : window[key], configurable: true });
}
Object.defineProperties(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true },
  getComputedStyle: { value: window.getComputedStyle.bind(window), configurable: true },
  requestAnimationFrame: { value: window.requestAnimationFrame.bind(window), configurable: true },
  cancelAnimationFrame: { value: window.cancelAnimationFrame.bind(window), configurable: true },
  ResizeObserver: { value: class { observe() {} unobserve() {} disconnect() {} }, configurable: true },
});
Object.defineProperty(window, "matchMedia", { value: () => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) });
const { signIn } = await import("@/platform/identity-auth");
assert.equal(signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok, true);
const { initializeApplicationComposition } = await import("@/app/composition");
await initializeApplicationComposition({ mode: "demo" });
const workspace = await import("@/platform/workspace-context");
const { loadAccessGovernance } = await import("@/platform/access-control");
await loadAccessGovernance(workspace.getWorkspaceContextSnapshot().workspaceId);
const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { Routes, Route } = await import("react-router-dom");
const { I18nProvider } = await import("@/i18n");
const { PlatformStateProvider } = await import("@/app/providers");
const { GuidanceProvider } = await import("@/guidance/presentation/GuidanceProvider");



const { RecordAttachmentsTab } = await import('@/components/crm/detail-archetype/RecordAttachmentsTab');
const { RelationshipQuickActionModal } = await import('@/components/crm/relationship-panel/RelationshipQuickActionModal');
const { getDirtyUnsavedWork, discardDirtyUnsavedWork, saveDirtyUnsavedWork } = await import('@/platform/unsaved-work');
const originalWorkspace = workspace.getWorkspaceContextSnapshot();
const otherWorkspace = workspace.listWorkspaceMemberships().find(item => item.status === 'active' && item.workspaceKey !== originalWorkspace.workspaceKey); assert(otherWorkspace);
let target = 'A';
let quick = false;
let release: (() => void) | undefined;
let refuse = false;
let fail = false;
const uploads: { target: string; description?: string }[] = [];
let quickCalls = 0;
const rootNode = document.getElementById('root');
assert(rootNode);
const root = createRoot(rootNode);
async function render() {
  const openingTarget = target;
  await act(async () => { root.render(React.createElement(I18nProvider, null,
    quick ? React.createElement(RelationshipQuickActionModal, { children: null, isOpen: true, onClose() {}, title: 'Quick', formId: 'quick-form', submitLabel: 'Save', cancelLabel: 'Cancel', async onSubmit() { quickCalls++; await new Promise<void>(resolve => { release = resolve; }); } }, React.createElement('input', { required: true, defaultValue: 'valid' }))
    : React.createElement(RecordAttachmentsTab, { idPrefix: 'test', recordId: target, attachments: [], async onUploadAttachment(data) { uploads.push({ target: openingTarget, description: data.description }); if (refuse) return false; await new Promise<void>(resolve => { release = resolve; }); if (fail) throw new Error('unavailable'); } })));
  });
}
async function choose() {
  const input = document.querySelector<HTMLInputElement>('input[type=file]'); assert(input);
  Object.defineProperty(input, 'files', { value: [new window.File(['data'], 'proof.pdf', { type: 'application/pdf' })], configurable: true });
  await act(async () => { input.dispatchEvent(new window.Event('change', { bubbles: true })); });
}
async function submit(id = 'test-attachment-upload-form') {
  const form = document.getElementById(id); assert(form);
  await act(async () => { form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); });
}
await render(); await choose();
assert.equal(getDirtyUnsavedWork().length, 1, 'selected file is meaningful unsaved work');
await act(async () => { await workspace.switchWorkspaceContext(otherWorkspace.workspaceKey); assert.equal(await saveDirtyUnsavedWork(), false); });
assert.equal(uploads.length, 0, 'workspace mismatch cannot invoke upload');
await act(async () => { await workspace.switchWorkspaceContext(originalWorkspace.workspaceKey); });
const area = document.querySelector('textarea'); assert(area);
await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set?.call(area, 'A description'); area.dispatchEvent(new window.Event('input', { bubbles: true })); });
target = 'B'; await render();
await act(async () => { assert.equal(await saveDirtyUnsavedWork(), false); });
assert.equal(uploads.length, 0, 'context B cannot apply A draft into a mutable local attachment collection');
assert.equal(document.querySelector('textarea')?.value, 'A description');
target = 'A'; await render();
await submit(); await submit();
assert.equal(uploads.length, 1, 'synchronous duplicate guard');
assert.deepEqual(uploads[0], { target: 'A', description: 'A description' }, 'opening callback retains aggregate A');
assert.equal(discardDirtyUnsavedWork(), false, 'pending veto');
assert(document.getElementById('test-attachment-upload-form'));
fail = true;
await act(async () => { release?.(); });
assert(document.querySelector('[role=alert]'), 'normalized failure visible');
assert.equal(getDirtyUnsavedWork().length, 1, 'failed upload retains draft');
assert.equal(document.querySelector('textarea')?.value, 'A description');
await act(async () => { assert.equal(discardDirtyUnsavedWork(), true); });
assert.equal(getDirtyUnsavedWork().length, 0);
target = 'B'; await render();
fail = false; refuse = true; await choose();
await act(async () => { assert.equal(await saveDirtyUnsavedWork(), false, 'explicit refusal is never successful save'); });
assert(document.getElementById('test-attachment-upload-form'));
refuse = false;
let saving: Promise<boolean> | undefined;
await act(async () => { saving = saveDirtyUnsavedWork(); });
await act(async () => { release?.(); assert.equal(await saving, true); });
assert.equal(uploads.at(-1)?.target, 'B', 'fresh cycle owns B');
assert.equal(getDirtyUnsavedWork().length, 0);
quick = true; await render();
await submit('quick-form'); await submit('quick-form');
assert.equal(quickCalls, 1, 'unguarded quick forms also block duplicate async submission');
assert([...document.querySelectorAll('button')].filter(button => button.textContent === 'Cancel').every(button => button.disabled));
await act(async () => { release?.(); });
await act(async () => { root.unmount(); });
assert.equal(getDirtyUnsavedWork().length, 0);
assert.deepEqual(browserErrors, []);
console.log('Shared CRM form parity PASS: actual attachment component/registry target snapshot, dirty file, async duplicate/pending veto, normalized failure retention, truthful save/refusal, fresh reopen; actual quick form duplicate guard without local guard.');
