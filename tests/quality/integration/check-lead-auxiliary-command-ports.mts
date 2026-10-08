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





const { configureLeadApplication, getLeadApplicationServices } = await import('@/modules/leads/application/composition/leadApplicationServices');
const leads=await import('@/modules/leads');
const { ApplicationError }=await import('@/shared/domain');
const { useLeadOwnerAssign }=await import('@/modules/leads/presentation/hooks/useLeadOwnerAssign');
const { LeadConsentPanel }=await import('@/modules/leads/presentation/components/LeadConsentPanel');
const { LeadImportDialog }=await import('@/modules/leads/presentation/components/LeadImportDialog');
const { useLeadAuxiliaryLifecycle }=await import('@/modules/leads/presentation/hooks/useLeadAuxiliaryLifecycle');
const { getDirtyUnsavedWork, discardDirtyUnsavedWork, saveDirtyUnsavedWork }=await import('@/platform/unsaved-work');
type Lead=import('@/modules/leads').Lead;
const A:Lead={id:'aux-A',name:'A',title:'',companyName:'Company',phone:'0901234567',email:'a@example.test',source:'WEB',score:0,ownerId:'u1',leadWorkState:'NEW',interestedProducts:[],activities:[],activitiesAuthority:'NOT_INCLUDED',resourceVersion:3,createdAt:'2026-07-01T00:00:00Z'};
leads.saveLeadSnapshot(A);
const captures:Array<{kind:string;id?:string;version?:number;workspace:string;owner?:string}>=[];
let consentRelease: (()=>void) | undefined;
const services=getLeadApplicationServices();
const refused=()=>new ApplicationError({code:'PROOF_PORT_FAILURE',category:'VALIDATION',message:'Port proof retains draft',userMessage:'Port proof retains draft',retryable:false});
configureLeadApplication({...services,api:{...services.api,commands:{...services.api.commands,
 async assignLeadOwner(id,input,options){captures.push({kind:'owner',id,version:options.expectedVersion,workspace:workspace.getWorkspaceContextSnapshot().workspaceId});throw refused();},
 async recordLeadConsent(id,input,options){captures.push({kind:'consent',id,version:options.expectedVersion,workspace:workspace.getWorkspaceContextSnapshot().workspaceId});await new Promise<void>(resolve=>{consentRelease=resolve;});throw refused();},
 async importLeadBatch(input){captures.push({kind:'import',workspace:workspace.getWorkspaceContextSnapshot().workspaceId,owner:input.items[0]?.ownerId});throw refused();}
}}});
let mode:'owner'|'consent'|'import'|'scope'='owner';let refresh=()=>{};let open=true;let dirty=true;let called=0;
function Probe(){const [,rerender]=React.useReducer(x=>x+1,0);refresh=rerender;return React.createElement(React.Fragment,null,mode==='owner'?React.createElement(Owner):mode==='consent'?React.createElement(LeadConsentPanel,{lead:A,actorId:'u1',onRecord:async input=>(await leads.recordLeadConsentViaApi(A.id,input)).lead}):mode==='import'?React.createElement(LeadImportDialog,{isOpen:open,onClose:()=>{open=false;refresh();},onImported:()=>{},defaultOwnerId:'u1',actorName:'Admin'}):React.createElement(Scope));}
function Owner(){const command=useLeadOwnerAssign(A);return React.createElement('button',{onClick:()=>{void command.submit('u2','Opening A reason');}},'Owner proof');}
function Scope(){const lifecycle=useLeadAuxiliaryLifecycle(open,'scope-proof',dirty,()=>{dirty=false;},()=>{open=false;refresh();});return React.createElement('button',{onClick:()=>{void lifecycle.run(()=>{called++;});}},'Scope proof');}
const element=document.getElementById('root');assert.ok(element);const root=createRoot(element);
async function render(){await act(async()=>root.render(React.createElement(I18nProvider,null,React.createElement(Probe))));await settle();}
async function settle(){await act(async()=>{await new Promise(resolve=>setTimeout(resolve,80));});}
async function click(text:string){const b=[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()===text);assert.ok(b,text);await act(async()=>b.click());await settle();}
async function change(selector:string,value:string){const c=document.querySelector<HTMLInputElement|HTMLTextAreaElement>(selector);assert.ok(c,selector);const prototype=c.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;await act(async()=>{Object.getOwnPropertyDescriptor(prototype,'value')?.set?.call(c,value);c.dispatchEvent(new window.Event('input',{bubbles:true}));});await settle();}
await render();await click('Owner proof');assert.equal(captures[0]?.id,A.id);assert.equal(captures[0]?.version,3);
mode='consent';await act(async()=>refresh());await click('Ghi nhận đồng thuận');await change('textarea','Opening A evidence');assert.equal(getDirtyUnsavedWork().length,1);const consentOpener=[...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()==='Ghi nhận đồng thuận');assert.ok(consentOpener);
await act(async()=>consentOpener.click());assert.equal(document.querySelector('textarea')?.value,'Opening A evidence');
await click('Ghi nhận');assert.equal(consentOpener.disabled,true);await act(async()=>{consentOpener.click();consentOpener.click();});assert.equal(document.querySelector('textarea')?.value,'Opening A evidence');assert.equal(captures.filter(c=>c.kind==='consent').length,1);assert.equal(discardDirtyUnsavedWork(),false);assert.equal(await saveDirtyUnsavedWork(),false);
await act(async()=>consentRelease?.());await settle();assert.equal(captures[1]?.kind,'consent');assert.equal(captures[1]?.id,A.id);assert.equal(captures[1]?.version,3);assert.equal(document.querySelector('textarea')?.value,'Opening A evidence');assert.ok(document.querySelector('[role=alert]'));
let consentSave: Promise<boolean> | undefined;
await act(async()=>{consentSave=saveDirtyUnsavedWork();});
assert.equal(captures.filter(c=>c.kind==='consent').length,2);
assert.equal(discardDirtyUnsavedWork(),false);
await act(async()=>{consentRelease?.();assert.equal(await consentSave,false);});
assert.equal(document.querySelector('textarea')?.value,'Opening A evidence');
assert.ok(document.querySelector('[role=alert]'));
mode='import';await act(async()=>refresh());const input=document.querySelector('input[type=file]');assert.ok(input);const file=new window.File(['name,email\nImported A,a@example.test'],'proof.csv',{type:'text/csv'});Object.defineProperty(file,'text',{value:async()=> 'name,email\nImported A,a@example.test'});Object.defineProperty(input,'files',{value:[file],configurable:true});await act(async()=>input.dispatchEvent(new window.Event('change',{bubbles:true})));await settle();assert.equal(getDirtyUnsavedWork().length,1);await click('Nhập toàn bộ');assert.equal(captures.at(-1)?.kind,'import');assert.equal(captures.at(-1)?.owner,'u1');assert.ok(document.querySelector('[role=alert]'));
mode='scope';await act(async()=>refresh());const opening=workspace.getWorkspaceContextSnapshot();const other=workspace.listWorkspaceMemberships().find(w=>w.workspaceId!==opening.workspaceId);assert.ok(other);
await act(async()=>{await workspace.switchWorkspaceContext(other.workspaceKey);});await click('Scope proof');assert.equal(called,0);assert.equal(open,true);assert.equal(await saveDirtyUnsavedWork(),false);
await act(async()=>{assert.equal(discardDirtyUnsavedWork(),true);});assert.equal(open,false);
await act(async()=>{await workspace.switchWorkspaceContext(opening.workspaceKey);open=true;dirty=false;refresh();});
await act(async()=>{await workspace.switchWorkspaceContext(other.workspaceKey);});await settle();assert.equal(open,false);
await act(async()=>root.unmount());assert.deepEqual(browserErrors,[]);
console.log('Auxiliary command-port PASS: real Owner hook / Consent panel / CSV Import dialog call real public application paths; A/version/owner captured, failure drafts retained, SAFE_FAIL Save, workspace mismatch refuses local submit, dirty retained/discard and clean switch closes.');
