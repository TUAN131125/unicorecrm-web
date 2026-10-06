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



const { SavedViewNameModal } = await import('@/components/crm/SavedViewNameModal');
const { CustomerDocumentDeliveryModal } = await import('@/components/crm/commercial-documents/CustomerDocumentDeliveryModal');
const { getDirtyUnsavedWork, discardDirtyUnsavedWork, saveDirtyUnsavedWork } = await import('@/platform/unsaved-work');
const originalWorkspace = workspace.getWorkspaceContextSnapshot();
const otherWorkspace = workspace.listWorkspaceMemberships().find(item => item.status === 'active' && item.workspaceKey !== originalWorkspace.workspaceKey); assert(otherWorkspace);
let open = true;
let delivery = false;
let name = 'Opening view';
let target = 'A';
let initialRecipient = 'A recipient';
let fileName = 'A.pdf';
let hold = false;
let fail = false;
let refuse = false;
let release: (() => void) | undefined;
let submitCalls = 0;
const commands: { target: string; value: import('@/shared/domain/commercialDocumentDelivery').CustomerDocumentDeliveryValue }[] = [];
const host = document.getElementById('root'); assert(host);
const root = createRoot(host);
function renderNow() {
  const openingTarget = target;
  root.render(React.createElement(I18nProvider, null, delivery
    ? React.createElement(CustomerDocumentDeliveryModal, { isOpen: open, documentId: target, documentNumber: target, documentLabel: { vi: 'Tài liệu', en: 'Document' }, locale: 'en', idPrefix: 'proof', guidanceId: 'proof.delivery', initialRecipient, initialFileName: fileName,
      onClose() { open = false; renderNow(); }, async onConfirm(value) { commands.push({ target: openingTarget, value }); if (refuse) return false; if (hold) await new Promise<void>(resolve => { release = resolve; }); if (fail) throw new Error('unavailable'); return true; } })
    : React.createElement(SavedViewNameModal, { isOpen: open, mode: 'edit', targetId: target, name, formId: 'proof-name', onNameChange(value) { name = value; renderNow(); }, onClose() { open = false; renderNow(); }, async onSubmit() { submitCalls++; if (hold) await new Promise<void>(resolve => { release = resolve; }); if (fail) throw new Error('unavailable'); } })));
}
async function render() { await act(async () => { renderNow(); }); }
async function setValue(id: string, value: string) {
  const input = document.getElementById(id); assert(input);
  const proto = input instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(input, value); input.dispatchEvent(new window.Event('input', { bubbles: true })); });
}
async function submitName() { const form = document.getElementById('proof-name'); assert(form); await act(async () => { form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); }); }
await render();
await act(async () => { await workspace.switchWorkspaceContext(otherWorkspace.workspaceKey); });
assert.equal(open, false, 'clean saved view ends on workspace change');
await act(async () => { await workspace.switchWorkspaceContext(originalWorkspace.workspaceKey); });
open = true; await render();
assert.equal(getDirtyUnsavedWork().length, 0);
await setValue('proof-name-name', 'Changed view');
assert.equal(getDirtyUnsavedWork().length, 1);
assert.equal(await saveDirtyUnsavedWork(), false, 'event-only saved view global Save is SAFE_FAIL');
assert.equal(submitCalls, 0);
await act(async () => { await workspace.switchWorkspaceContext(otherWorkspace.workspaceKey); });
await submitName(); assert.equal(submitCalls, 0, 'opening workspace mismatch blocks direct name submit');
assert.equal(name, 'Changed view');
await act(async () => { await workspace.switchWorkspaceContext(originalWorkspace.workspaceKey); });
await setValue('proof-name-name', 'Opening view  ');
assert.equal(getDirtyUnsavedWork().length, 0, 'canonical trim revert');
await setValue('proof-name-name', 'Changed view');
hold = true; fail = true;
await submitName(); await submitName();
assert.equal(submitCalls, 1);
assert.equal(discardDirtyUnsavedWork(), false);
await act(async () => { release?.(); });
assert.equal(document.activeElement?.id, 'proof-name-name', 'server error summary points to name');
assert.equal(name, 'Changed view');
await act(async () => { assert.equal(discardDirtyUnsavedWork(), true); });
assert.equal(name, 'Opening view');
assert.equal(getDirtyUnsavedWork().length, 0);
delivery = true; open = true; hold = false; fail = false;
await render();
assert.equal(getDirtyUnsavedWork().length, 0);
await setValue('proof-delivery-note', 'A evidence');
assert.equal(getDirtyUnsavedWork().length, 1);
const staleDeliveryEntry = getDirtyUnsavedWork()[0]; assert(staleDeliveryEntry);
await act(async () => { await workspace.switchWorkspaceContext(otherWorkspace.workspaceKey); assert.equal(await saveDirtyUnsavedWork(), false); });
assert.equal(commands.length, 0, 'workspace mismatch cannot invoke delivery command');
await act(async () => { await workspace.switchWorkspaceContext(originalWorkspace.workspaceKey); });
initialRecipient = 'A refreshed recipient'; fileName = 'A refreshed.pdf'; await render();
assert.equal(document.querySelector<HTMLInputElement>('#proof-delivery-recipient')?.value, 'A recipient');
assert.equal(document.querySelector<HTMLTextAreaElement>('#proof-delivery-note')?.value, 'A evidence');
target = 'B'; await render();
await act(async () => { assert.equal(await saveDirtyUnsavedWork(), false); });
assert.equal(commands.length, 0, 'B context cannot execute A decision');
target = 'A'; await render();
hold = true; fail = true;
let saving: Promise<boolean> | undefined;
await act(async () => { saving = saveDirtyUnsavedWork(); });
await act(async () => { assert.equal(await saveDirtyUnsavedWork(), false); });
assert.equal(commands.length, 1);
assert.equal(commands[0]?.target, 'A');
assert.equal(commands[0]?.value.fileName, 'A.pdf', 'opening source filename retained');
assert.equal(discardDirtyUnsavedWork(), false);
await act(async () => { release?.(); assert.equal(await saving, false); });
assert.equal(document.querySelector<HTMLTextAreaElement>('#proof-delivery-note')?.value, 'A evidence');
assert(document.querySelector('[role=alert]'));
fail = false; hold = false; refuse = true;
await act(async () => { assert.equal(await saveDirtyUnsavedWork(), false); });
assert.equal(getDirtyUnsavedWork().length, 1);
refuse = false;
await act(async () => { assert.equal(await saveDirtyUnsavedWork(), true); });
assert.equal(getDirtyUnsavedWork().length, 0, 'confirmed persistence clears dirty');
await setValue('proof-delivery-recipient', '');
await act(async () => { assert.equal(await saveDirtyUnsavedWork(), false); });
assert.equal(document.activeElement?.id, 'proof-delivery-recipient', 'first invalid recipient focus');
await act(async () => { assert.equal(discardDirtyUnsavedWork(), true); });
assert.equal(open, false);
open = true; target = 'B'; initialRecipient = 'B recipient'; fileName = 'B.pdf'; await render();
assert.equal(document.querySelector<HTMLInputElement>('#proof-delivery-recipient')?.value, 'B recipient');
await act(async () => { assert.equal(await staleDeliveryEntry.save(), false, 'stale registry save cannot execute an ended cycle'); });
assert.equal(document.querySelector<HTMLTextAreaElement>('#proof-delivery-note')?.value, '');
assert.equal(getDirtyUnsavedWork().length, 0);
await act(async () => { await workspace.switchWorkspaceContext(otherWorkspace.workspaceKey); });
assert.equal(open, false, 'clean delivery ends on workspace change');
await act(async () => { await workspace.switchWorkspaceContext(originalWorkspace.workspaceKey); });
open = true; await render();
await setValue('proof-delivery-note', 'B pending evidence');
hold = true; fail = true;
await act(async () => { saving = saveDirtyUnsavedWork(); });
open = false; await render();
open = true; target = 'C'; initialRecipient = 'C recipient'; fileName = 'C.pdf'; await render();
assert.equal(discardDirtyUnsavedWork(), false, 'old pending command still vetoes discard after forced reopen');
await act(async () => { release?.(); assert.equal(await saving, false); });
assert.equal(document.querySelector<HTMLInputElement>('#proof-delivery-recipient')?.value, 'C recipient');
assert.equal(document.querySelector<HTMLTextAreaElement>('#proof-delivery-note')?.value, '');
assert.equal(document.querySelector('[role=alert]'), null, 'late B failure cannot leak into C cycle');
assert.equal(getDirtyUnsavedWork().length, 0);
await act(async () => { root.unmount(); });
assert.equal(getDirtyUnsavedWork().length, 0);
assert.deepEqual(browserErrors, []);
console.log('Shared delivery/name form parity PASS: real components/registry, canonical dirty/revert, saved-view SAFE_FAIL, sync duplicate/pending veto, normalized failure/name focus, delivery source/target snapshot, refresh retention, truthful save/refusal, invalid focus and clean reopen.');
