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






const { LeadDuplicateReviewModal } = await import('@/modules/leads/presentation/components/LeadDuplicateReviewModal');
const { getDirtyUnsavedWork, discardDirtyUnsavedWork } = await import('@/platform/unsaved-work');
type Lead = import('@/modules/leads').Lead;
const A: Lead = {id:'duplicate-A',name:'A',title:'',companyName:'Company',phone:'0901234567',email:'a@example.test',source:'WEB',score:0,ownerId:'u1',leadWorkState:'NEW',interestedProducts:[],activities:[],activitiesAuthority:'NOT_INCLUDED',resourceVersion:3,createdAt:'2026-07-01T00:00:00Z'};
const B: Lead = {...A,id:'duplicate-B',name:'B'};
let target=A; let open=true; let refresh=()=>{}; let calls=0; let release: (()=>void)|undefined; let fail=true;
const captured: string[][]=[];
function Probe(){const [,rerender]=React.useReducer(x=>x+1,0); refresh=rerender; const bound=target.id; return React.createElement(LeadDuplicateReviewModal,{isOpen:open,lead:target,candidates:[B],onClose:()=>{open=false;refresh();},onMerge:async(survivor,duplicates)=>{calls++;captured.push([bound,survivor,...duplicates]);await new Promise<void>(resolve=>{release=resolve;});if(fail)throw new Error('SIMULATED_FAILURE');},onConfirmDistinct:async()=>{throw new Error('Unexpected distinct');}});}
const element=document.getElementById('root');assert.ok(element);const root=createRoot(element);
await act(async()=>root.render(React.createElement(I18nProvider,null,React.createElement(Probe))));
async function settle(){await act(async()=>{await new Promise(resolve=>setTimeout(resolve,40));});}
const input=document.querySelector('textarea');assert.ok(input);
await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value')?.set?.call(input,'Opening A evidence');input.dispatchEvent(new window.Event('input',{bubbles:true}));});await settle();
assert.equal(getDirtyUnsavedWork().length,1);
await act(async()=>{target={...B,id:'target-C'};refresh();});assert.equal(document.querySelector('textarea')?.value,'Opening A evidence');
const merge=[...document.querySelectorAll('button')].find(b=>/Gộp có kiểm soát|Merge safely/.test(b.textContent??''));assert.ok(merge);
await act(async()=>{merge.click();merge.click();});assert.equal(calls,1);assert.deepEqual(captured[0],['duplicate-A','duplicate-A','duplicate-B']);assert.equal(discardDirtyUnsavedWork(),false);assert.equal(open,true);
await act(async()=>release?.());await settle();assert.equal(open,true);assert.equal(document.querySelector('textarea')?.value,'Opening A evidence');assert.ok(document.querySelector('[role="alert"]'));
fail=false;await act(async()=>merge.click());assert.equal(calls,2);await act(async()=>release?.());await settle();assert.equal(open,false);assert.equal(getDirtyUnsavedWork().length,0);
await act(async()=>{open=true;refresh();});assert.equal(document.querySelector('textarea')?.value,'');
await act(async()=>root.unmount());assert.deepEqual(browserErrors,[]);
console.log('Duplicate review PASS: actual component preserves opening target/callback and draft across refresh/switch, synchronous duplicate guard, pending atomic veto, normalized failure/retry, success cleanup and fresh reopen.');