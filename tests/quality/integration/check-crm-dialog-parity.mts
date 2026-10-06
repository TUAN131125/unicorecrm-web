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






const { ConfirmDialog }=await import('@/shared/components/ui');
const { MutationConflictDialog }=await import('@/shared/operations/MutationConflictDialog');
let target='A';let open=true;let refresh=()=>{};let calls=0;let closes=0;let release:(()=>void)|undefined;let fail=true;let mode:'confirm'|'conflict'|'editable'='confirm';const captured:string[]=[];
let draftReason='';let savedReason='';
function Probe(){const [,rerender]=React.useReducer(x=>x+1,0);refresh=rerender;const bound=target;
if(mode==='editable'){const reason=draftReason;return React.createElement(ConfirmDialog,{editable:true,isOpen:open,onClose:()=>{},title:'Reason proof',message:React.createElement('textarea',{id:'reason-proof',value:reason,onChange:()=>{}}),confirmText:'Save reason',onConfirm:async()=>{savedReason=reason;}});}
if(mode==='conflict')return React.createElement(MutationConflictDialog,{isOpen:open,onClose:()=>{closes++;open=false;refresh();},onReloadLatest:async()=>{calls++;await new Promise<void>(resolve=>{release=resolve;});throw new Error('PROOF_RECOVERY_ERROR');}});
return React.createElement(ConfirmDialog,{isOpen:open,onClose:()=>{closes++;open=false;refresh();},title:`Archive ${bound}`,message:`Opening target ${bound}`,confirmText:'Archive proof',cancelText:'Keep proof',variant:'danger',onConfirm:async isCurrent=>{calls++;captured.push(bound);await new Promise<void>(resolve=>{release=resolve;});if(fail)throw new Error('PRIVATE_SERVER_DIAGNOSTIC');if(isCurrent()){open=false;closes++;refresh();}}});}
const element=document.getElementById('root');assert.ok(element);const root=createRoot(element);
async function render(){await act(async()=>root.render(React.createElement(I18nProvider,null,React.createElement(Probe))));}
function button(text:string){const b=[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()===text);assert.ok(b,text);return b;}
await render();await act(async()=>{target='B';refresh();});assert.ok(document.body.textContent?.includes('Opening target A'));assert.ok(!document.body.textContent?.includes('Opening target B'));
const confirm=button('Archive proof');await act(async()=>{confirm.click();confirm.click();});assert.equal(calls,1);assert.deepEqual(captured,['A']);assert.equal(button('Keep proof').disabled,true);
await act(async()=>window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(open,true);assert.equal(closes,0);
await act(async()=>release?.());assert.ok(document.querySelector('[role="alert"]'));assert.ok(!document.body.textContent?.includes('PRIVATE_SERVER_DIAGNOSTIC'));assert.equal(open,true);
fail=false;await act(async()=>confirm.click());assert.equal(calls,2);await act(async()=>{open=false;refresh();});await act(async()=>{open=true;refresh();});await act(async()=>release?.());assert.equal(open,true);assert.equal(closes,0);assert.ok(document.body.textContent?.includes('Opening target B'));
await act(async()=>button('Archive proof').click());assert.equal(captured[2],'B');await act(async()=>release?.());assert.equal(open,false);assert.equal(closes,1);
mode='editable';open=true;await render();draftReason='Current validated reason';await act(async()=>refresh());assert.equal(document.querySelector<HTMLTextAreaElement>('#reason-proof')?.value,draftReason);await act(async()=>button('Save reason').click());assert.equal(savedReason,draftReason,'editable target-bound adapter receives the current draft');
mode='conflict';open=true;await render();const reload=[...document.querySelectorAll('button')].find(b=>/Tải phiên bản mới nhất|Load latest version/.test(b.textContent??''));assert.ok(reload);const before=calls;await act(async()=>{reload.click();reload.click();});assert.equal(calls,before+1);await act(async()=>window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(open,true);await act(async()=>release?.());assert.ok(document.querySelector('[role="alert"]'));assert.equal(open,true);
await act(async()=>root.unmount());assert.deepEqual(browserErrors,[]);console.log('Dialog parity PASS: opening callback/context identity, confirm once, pending cancel/Escape, normalized failure/retry, stale cycle refusal, fresh reopen; conflict reload once/pending/failure.');