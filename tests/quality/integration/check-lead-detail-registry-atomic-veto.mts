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






const { useLeadDetailDialogs }=await import('@/modules/leads/presentation/hooks/useLeadDetailDialogs');
const { registerUnsavedWork, discardDirtyUnsavedWork }=await import('@/platform/unsaved-work');
type Lead=import('@/modules/leads').Lead;
const A:Lead={id:'detail-atomic-A',name:'A',title:'',companyName:'Company',phone:'0901234567',email:'a@example.test',source:'WEB',score:0,ownerId:'u1',leadWorkState:'NEW',interestedProducts:[],activities:[],activitiesAuthority:'NOT_INCLUDED',resourceVersion:3,createdAt:'2026-07-01T00:00:00Z'};
let model:ReturnType<typeof useLeadDetailDialogs>|undefined;let siblingDiscards=0;
const unregister=registerUnsavedWork({id:'earlier-sibling',title:'Sibling',isDirty:true,save:async()=>false,discard:()=>{siblingDiscards++;}});
function Probe(){model=useLeadDetailDialogs(A,A.id);return React.createElement('p',null,model.showEditModal?'open':'closed');}
const element=document.getElementById('root');assert.ok(element);const root=createRoot(element);await act(async()=>root.render(React.createElement(I18nProvider,null,React.createElement(Probe))));assert.ok(model);
await act(async()=>model?.setShowEditModal(true));await act(async()=>{model?.setEditDirty(true);model?.setEditSubmitting(true);});
assert.equal(discardDirtyUnsavedWork(),false,'Pending Lead detail must veto before any sibling discards');assert.equal(siblingDiscards,0);assert.equal(document.querySelector('p')?.textContent,'open');
await act(async()=>{model?.setEditSubmitting(false);});await act(async()=>{assert.equal(discardDirtyUnsavedWork(),true);});assert.equal(siblingDiscards,1);assert.equal(document.querySelector('p')?.textContent,'closed');
unregister();await act(async()=>root.unmount());assert.deepEqual(browserErrors,[]);console.log('Lead detail registry atomic PASS: pending edit veto discards zero captured entries; settled discard closes bound edit and discards sibling once.');