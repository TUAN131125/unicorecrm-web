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






const { RelationshipQuickActionModal }=await import('@/components/crm/relationship-panel/RelationshipQuickActionModal');
const { ColumnSettingsDrawer }=await import('@/components/crm/ColumnSettingsDrawer');
const { ProductPickerModal }=await import('@/modules/products/presentation/components/ProductPickerModal');
let mode:'quick'|'columns'|'picker'='quick';let open=true;let small=false;let dirty=false;let refresh=()=>{};let closes=0;let submits=0;let release:(()=>void)|undefined;let visible=['name'];let saved:string[]=[];
function close(){closes++;open=false;refresh();}
function Probe(){const [,rerender]=React.useReducer(x=>x+1,0);refresh=rerender;
if(mode==='columns')return React.createElement(ColumnSettingsDrawer,{isOpen:open,onClose:close,allFields:['name','email'],visibleColumns:visible,onSave:columns=>{saved=columns;},onResetDefault:()=>{},translationPrefix:'proof',getFieldLabel:key=>key});
if(mode==='picker')return React.createElement(ProductPickerModal,{id:'proof-picker',isOpen:open,onClose:close,onApply:()=>{},products:[],initialSelected:[]});
return React.createElement(RelationshipQuickActionModal,{children:React.createElement('input',{readOnly:true,value:'opening'}),size:small?'sm':'md',guardChanges:true,dirty,isOpen:open,onClose:close,title:'Proof quick action',formId:'popup-proof',submitLabel:'Save proof',cancelLabel:'Cancel proof',onSubmit:async()=>{submits++;await new Promise<void>(resolve=>{release=resolve;});}});}
const element=document.getElementById('root');assert.ok(element);const root=createRoot(element);
async function render(){await act(async()=>root.render(React.createElement(I18nProvider,null,React.createElement(Probe))));await settle();}
async function settle(){await act(async()=>{await new Promise(resolve=>setTimeout(resolve,100));});}
await render();assert.equal(document.querySelector('[data-dialog-size]')?.getAttribute('data-dialog-size'),'md');
await act(async()=>{small=true;refresh();});assert.equal(document.querySelector('[data-dialog-size]')?.getAttribute('data-dialog-size'),'sm');
await act(async()=>{dirty=true;refresh();});await act(async()=>window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(open,true);assert.equal(document.querySelectorAll('[role="dialog"]').length,2);
const keep=[...document.querySelectorAll('button')].find(b=>/Tiếp tục chỉnh sửa|Keep editing/.test(b.textContent??''));assert.ok(keep);await act(async()=>keep.click());
const form=document.getElementById('popup-proof');assert.ok(form);await act(async()=>{form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));});assert.equal(submits,1);
await act(async()=>window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(open,true);assert.equal(document.querySelectorAll('[role="dialog"]').length,1);await act(async()=>release?.());
await act(async()=>{dirty=false;open=false;refresh();});await settle();mode='columns';open=true;await render();
const checks=[...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];assert.equal(checks.length,2);await act(async()=>checks[1]?.click());
await act(async()=>{visible=['name'];refresh();});const save=[...document.querySelectorAll('button')].find(b=>/Save changes|Lưu/.test(b.textContent??''));assert.ok(save);await act(async()=>save.click());assert.deepEqual(saved,['name','email']);
await settle();await act(async()=>{open=true;refresh();});await settle();assert.ok(document.querySelector('[role="dialog"][aria-modal="true"]'));await act(async()=>window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(open,false);
await settle();mode='picker';open=true;await render();const search=document.querySelector<HTMLInputElement>('input');assert.ok(search);await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value')?.set?.call(search,'my draft search');search.dispatchEvent(new window.Event('input',{bubbles:true}));});await act(async()=>refresh());assert.equal(document.querySelector<HTMLInputElement>('input')?.value,'my draft search');
await act(async()=>{open=false;refresh();});await settle();await act(async()=>{open=true;refresh();});await settle();assert.equal(document.querySelector<HTMLInputElement>('input')?.value,'');
await act(async()=>root.unmount());assert.deepEqual(browserErrors,[]);console.log('Popup/picker PASS: canonical md/sm runtime widths, dirty Escape/keep, pending Escape and duplicate guard, column refresh retention/apply/Escape, picker refresh retention and fresh search on reopen.');