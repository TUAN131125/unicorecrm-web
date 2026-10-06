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




const { useLeadDialogs } = await import('@/modules/leads/presentation/hooks/useLeadDialogs');
const { LeadManageTagsModal } = await import('@/modules/leads/presentation/components/LeadManageTagsModal');
const { getDirtyUnsavedWork } = await import('@/platform/unsaved-work');
const { LEAD_OPERATION, isLeadOperationAvailable } = await import('@/modules/leads/application/leadOperationAvailability');
console.log('DEMO availability', Object.fromEntries(Object.entries(LEAD_OPERATION).map(([key,value])=>[key,isLeadOperationAvailable(value)])));

let selected=['A']; let refresh=()=>{};
let dialogs: ReturnType<typeof useLeadDialogs> | undefined;
let release: (()=>void) | undefined; let calls=0; const targets:string[][]=[];
function Probe(){const [,rerender]=React.useReducer(x=>x+1,0);refresh=rerender;dialogs=useLeadDialogs(selected,()=>{},'vi'); return React.createElement(LeadManageTagsModal,{isOpen:dialogs.isManageTagsModalOpen,onClose:()=>dialogs?.setIsManageTagsModalOpen(false),selectedCount:dialogs.auxiliaryTargets.tags.length,onApply:async()=>{calls++;targets.push([...(dialogs?.auxiliaryTargets.tags??[])]);await new Promise<void>(resolve=>{release=resolve;});}});}
const { discardDirtyUnsavedWork, saveDirtyUnsavedWork } = await import('@/platform/unsaved-work');
const element=document.getElementById('root');assert.ok(element);const root=createRoot(element);
const settle=()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,40));});
await act(async()=>root.render(React.createElement(I18nProvider,null,React.createElement(Probe))));
assert.ok(dialogs);await act(async()=>dialogs?.setIsManageTagsModalOpen(true));
const input=document.querySelector('input');assert.ok(input);
await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value')?.set?.call(input,'A draft tag');input.dispatchEvent(new window.Event('input',{bubbles:true}));});
assert.equal(getDirtyUnsavedWork().length,1);
await act(async()=>{selected=['B'];refresh();});assert.equal(input.value,'A draft tag');assert.deepEqual(dialogs.auxiliaryTargets.tags,['A']);
const cancel=[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Hủy');assert.ok(cancel);
await act(async()=>cancel.click());
const keep=[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Tiếp tục chỉnh sửa');assert.ok(keep);await act(async()=>keep.click());assert.equal(input.value,'A draft tag');
const apply=[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Gắn nhãn');assert.ok(apply);
await act(async()=>{apply.click();apply.click();});assert.equal(calls,1);assert.deepEqual(targets,[['A']]);assert.equal(discardDirtyUnsavedWork(),false);assert.equal(await saveDirtyUnsavedWork(),false);assert.equal(input.value,'A draft tag');
await act(async()=>release?.());await settle();assert.equal(getDirtyUnsavedWork().length,0);
await act(async()=>dialogs?.setIsManageTagsModalOpen(true));assert.deepEqual(dialogs.auxiliaryTargets.tags,['B']);assert.equal(document.querySelector('input')?.value,'');
await act(async()=>dialogs?.handleOpenFollowUp('A'));assert.equal(dialogs.followUpLeadId,'A');
await act(async()=>{selected=['C'];refresh();});assert.equal(dialogs.followUpLeadId,'A');assert.deepEqual(dialogs.auxiliaryTargets.followUp,['B']);
await act(async()=>root.unmount());assert.deepEqual(browserErrors,[]);
console.log('Lead auxiliary real hook/component PASS: opening selection A, dirty registration, Keep editing, pending veto, duplicate confirm, A callback binding, clean B reopen, single FollowUp ID binding.');
