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






const { useLeadAuxiliaryLifecycle }=await import('@/modules/leads/presentation/hooks/useLeadAuxiliaryLifecycle');
const { getDirtyUnsavedWork }=await import('@/platform/unsaved-work');
let open=true;let dirty=true;let target='A';let resets=0;let closes=0;let refresh=()=>{};
let lifecycle: ReturnType<typeof useLeadAuxiliaryLifecycle> | undefined;
function Probe(){const [,rerender]=React.useReducer(x=>x+1,0);refresh=rerender;lifecycle=useLeadAuxiliaryLifecycle(open,'cycle-proof',dirty,()=>{resets++;dirty=false;},()=>{closes++;open=false;refresh();},false,target);return React.createElement('p',null,lifecycle.pending?'pending':'ready');}
const element=document.getElementById('root');assert.ok(element);const root=createRoot(element);
await act(async()=>root.render(React.createElement(I18nProvider,null,React.createElement(Probe))));
assert.ok(lifecycle);const old=lifecycle;const oldEntry=getDirtyUnsavedWork()[0];assert.ok(oldEntry);
await act(async()=>{open=false;refresh();});assert.equal(oldEntry.canDiscard?.(),false);oldEntry.discard();assert.equal(resets,0);assert.equal(closes,0);assert.equal(old.isCurrent(),false);let calls=0;assert.equal(await old.run(()=>{calls++;}),false);assert.equal(calls,0);
await act(async()=>{open=true;refresh();});assert.ok(lifecycle);let release:(()=>void)|undefined;let completion:Promise<boolean>|undefined;
await act(async()=>{completion=lifecycle?.run(async()=>{await new Promise<void>(resolve=>{release=resolve;});return true;});});assert.ok(completion);assert.equal(document.querySelector('p')?.textContent,'pending');
await act(async()=>{open=false;refresh();});await act(async()=>{open=true;refresh();});assert.ok(lifecycle);assert.equal(await lifecycle.run(()=>{calls++;}),false);assert.equal(calls,0);
await act(async()=>release?.());assert.equal(await completion,false);assert.equal(document.querySelector('p')?.textContent,'ready');
await act(async()=>{dirty=true;target='B';refresh();});assert.equal(open,true);assert.equal(closes,0);
await act(async()=>{dirty=false;refresh();});assert.equal(open,false);assert.equal(closes,1);
await act(async()=>{open=true;refresh();});assert.ok(lifecycle);await act(async()=>{assert.equal(await lifecycle?.run(()=>{calls++;}),true);});assert.equal(calls,1);
await act(async()=>{dirty=true;refresh();});const freshEntry=getDirtyUnsavedWork()[0];assert.ok(freshEntry);const beforeReset=resets;
await act(async()=>{freshEntry.discard();assert.equal(freshEntry.canDiscard?.(),false);freshEntry.discard();});assert.equal(resets,beforeReset+1);
await act(async()=>root.unmount());assert.deepEqual(browserErrors,[]);
console.log('Auxiliary closed-cycle PASS: stale closed entry/run inert before reopen, closed pending completion false, old pending latch recovered without retargeting, dirty target switch retained, clean target switch closed, fresh cycle submits.');
