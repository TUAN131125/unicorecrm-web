import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { runBrowserIsolated } from "../../fixtures/runtime/run-browser-isolated.mts";

await runBrowserIsolated(import.meta.url, async () => {

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
const { QuoteDeliveryConfirmationModal } = await import('@/modules/quotes/presentation/components/QuoteDeliveryConfirmationModal');
const activity = await import('@/modules/tasks/presentation/components/ActivityCreateModals');
const { useLeadAuxiliaryLifecycle } = await import('@/modules/leads/presentation/hooks/useLeadAuxiliaryLifecycle');
const { useLeadDetailDialogs } = await import('@/modules/leads/presentation/hooks/useLeadDetailDialogs');
const { getDirtyUnsavedWork, saveDirtyUnsavedWork, discardDirtyUnsavedWork } = await import('@/platform/unsaved-work');
const element=document.getElementById('root'); assert(element); const root=createRoot(element);
let open=true, name='Opening', target='A', enabled=false, proof: boolean | undefined=true, throws=false, calls=0, localCalls=0, hold=false;
let release: (()=>void) | undefined;
const original=workspace.getWorkspaceContextSnapshot();
const other=workspace.listWorkspaceMemberships().find(item=>item.status==='active' && item.workspaceKey!==original.workspaceKey); assert(other);
let mode: 'name'|'quote'|'activity'|'aux'|'detail'='name';
let activityKind: 'Call'|'Meeting'|'Email'|'Sms'|'Note'='Call';
let dirty=true, restricted=false;
let detail: ReturnType<typeof useLeadDetailDialogs> | undefined;
let auxiliary: ReturnType<typeof useLeadAuxiliaryLifecycle> | undefined;
const captures: Array<{target:string;value:unknown}>=[];
const deliveryIds: string[] = [];
async function command(value: unknown, captured=target): Promise<boolean> { calls++; captures.push({target:captured,value}); if(hold) await new Promise<void>(resolve=>{release=resolve;}); if(throws) throw new Error('private server diagnostic'); return proof as boolean; }
function close(){open=false; renderNow();}
function Auxiliary(){const lifecycle=useLeadAuxiliaryLifecycle(open,'adapter-proof',dirty,()=>{dirty=false;},close,false,target); auxiliary=lifecycle; if(enabled) lifecycle.bindSave(()=>command('aux')); return React.createElement(React.Fragment,null,lifecycle.confirmation);}
const lead: import('@/modules/leads').Lead={id:'A',name:'A',title:'',companyName:'A',phone:'',email:'',source:'WEB',score:0,ownerId:'u1',leadWorkState:'NEW',interestedProducts:[],activities:[],resourceVersion:3,createdAt:'2026-07-01T00:00:00Z'};
function Detail(){detail=useLeadDetailDialogs(lead,target); if(enabled) detail.bindSave(()=>command('detail')); return null;}
function renderNow(){
 const captured=target;
 const shared={isOpen:open,onClose:close,targetId:target};
 const defaults={subject:'Call',recipient:'0901234567',occurredAt:'2026-10-06T09:00',title:'Meeting',startAt:'2026-10-06T09:00',to:'a@example.test',body:'Body',phone:'0901234567'};
 let component: React.ReactNode;
 if(mode==='name') component=React.createElement(SavedViewNameModal,{...shared,mode:'edit',name,onNameChange(value){name=value;renderNow();},onSubmit(){localCalls++;},onSave:enabled ? value=>command(value,captured):undefined,formId:'adapter-name'});
 else if(mode==='quote') component=React.createElement(QuoteDeliveryConfirmationModal,{isOpen:open,onClose:close,quoteNumber:target,locale:'en',initialRecipient:'Recipient',onConfirm(){localCalls++;},onSave:enabled ? (value,id)=>{deliveryIds.push(id);return command(value,captured);}:undefined});
 else if(mode==='activity') {
  const props={...shared,defaults,formId:'adapter-activity',contactPolicy:{restricted},onSubmit(){localCalls++;},onSave:enabled ? (value:unknown)=>command(value,captured):undefined};
  const componentType=activity[activityKind+'ActivityCreateModal' as keyof typeof activity];
  component=React.createElement(componentType as React.ComponentType<typeof props>,props);
 } else component=React.createElement(mode==='aux'?Auxiliary:Detail);
 root.render(React.createElement(I18nProvider,null,component));
}
async function render(){await act(async()=>renderNow());}
async function value(id:string,text:string){const input=document.getElementById(id);assert(input,id);const proto=input instanceof window.HTMLTextAreaElement?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;await act(async()=>{Object.getOwnPropertyDescriptor(proto,'value')?.set?.call(input,text);input.dispatchEvent(new window.Event('input',{bubbles:true}));});}
async function save(expected:boolean){await act(async()=>assert.equal(await saveDirtyUnsavedWork(),expected,mode+activityKind+JSON.stringify(getDirtyUnsavedWork().map(e=>e.id))));}
async function reopen(){open=false;await render();open=true;await render();}
await render(); await value('adapter-name-name','Changed'); await save(false); assert.equal(localCalls,0);assert.equal(calls,0);
enabled=true; await reopen(); await value('adapter-name-name','Next'); proof=false;await save(false);assert(open);assert.equal(name,'Next');
proof=undefined; await save(false);assert(open); throws=true;await save(false);assert(open);assert(!document.body.textContent?.includes('private server diagnostic'));throws=false;
proof=true;hold=true;let inFlight:Promise<boolean> | undefined;
await act(async()=>{inFlight=saveDirtyUnsavedWork();});const pendingCalls=calls;await save(false);assert.equal(calls,pendingCalls);assert.equal(discardDirtyUnsavedWork(),false);
await act(async()=>{release?.();assert.equal(await inFlight,true);});assert(!open);hold=false;
await reopen();await value('adapter-name-name','Stale');const staleName=getDirtyUnsavedWork()[0];assert(staleName);await render();assert.equal(await staleName.save(),false);
target='B';await render();const before=calls;await save(false);assert.equal(calls,before);target='A';await render();
await act(async()=>{await workspace.switchWorkspaceContext(other.workspaceKey);});await save(false);assert.equal(calls,before);await act(async()=>{await workspace.switchWorkspaceContext(original.workspaceKey);});
await act(async()=>{root.render(null);});
mode='quote';open=true;target='A';await render();await value('quote-delivery-note','Evidence');proof=false;await save(false);assert(open);await save(false);assert.equal(deliveryIds.at(-1), deliveryIds.at(-2), 'Retry retains its delivery identity');proof=true;
await value('quote-delivery-recipient','');const invalidCalls=calls;await save(false);assert.equal(calls,invalidCalls);assert.equal(document.activeElement?.id,'quote-delivery-recipient');await value('quote-delivery-recipient','Recipient');await save(true);assert(!open);
await act(async()=>root.render(null));
mode='activity';
for(const kind of ['Call','Meeting','Email','Sms','Note'] as const){activityKind=kind;open=true;proof=false;await render();await value(kind==='Call'?'adapter-activity-subject':kind==='Meeting'||kind==='Note'?'adapter-activity-title':'adapter-activity-body','Changed');await save(false);assert(open);proof=true;await save(true);assert(!open,kind);await act(async()=>root.render(null));}
activityKind='Call';restricted=true;open=true;await render();await value('adapter-activity-subject','Restricted');const policyCalls=calls;await save(false);assert.equal(calls,policyCalls,'global save respects contact policy');await act(async()=>root.render(null));restricted=false;
open=true;target='A';hold=true;await render();await value('adapter-activity-subject','Opening target');
await act(async()=>{inFlight=saveDirtyUnsavedWork();});const activityCalls=calls;await save(false);assert.equal(calls,activityCalls);assert.equal(discardDirtyUnsavedWork(),false);
target='B';await render();await act(async()=>{release?.();assert.equal(await inFlight,false,'target change cannot prove success for a new record');});assert(open);assert.equal(captures.at(-1)?.target,'A');hold=false;
await act(async()=>root.render(null));target='A';
mode='quote';open=true;hold=true;await render();await value('quote-delivery-note','Pending opening');await act(async()=>{inFlight=saveDirtyUnsavedWork();});
open=false;await render();open=true;await render();await act(async()=>{release?.();assert.equal(await inFlight,false,'forced close/reopen invalidates pending completion');});hold=false;await act(async()=>root.render(null));
mode='aux';open=true;dirty=true;proof=false;await render();await save(false);assert(open);proof=true;const staleAux=getDirtyUnsavedWork()[0];assert(staleAux);await save(true);assert(!open);assert.equal(await staleAux.save(),false);open=true;dirty=true;await render();
target='B';await render();const blockedCalls=calls;await save(false);assert.equal(calls,blockedCalls);await act(async()=>root.render(null));
mode='detail';target='A';enabled=false;await render();await act(async()=>detail?.setShowDisqualifyModal(true));await act(async()=>detail?.setDisqualifyReasonText('Evidence'));await save(false);enabled=true;await render();proof=false;await save(false);assert(detail?.showDisqualifyModal);proof=true;await save(true);assert.equal(detail?.activeForm,null);
enabled=false;await render();await act(async()=>detail?.setShowDisqualifyModal(true));await act(async()=>detail?.setDisqualifyReasonText('New opening'));await render(); // Previous cycle's binding must never be reused.
const previousCalls=calls;await save(false);assert.equal(calls,previousCalls);
await act(async()=>root.render(null));
const { checkSafeSaveConsumers } = await import('../../fixtures/runtime/check-safe-save-consumers.mts');
await checkSafeSaveConsumers(root, value);
const { checkSafeContactOwner } = await import('../../fixtures/runtime/check-safe-contact-owner.mts');
await checkSafeContactOwner(root);
const { checkSafeRelationshipOwners } = await import('../../fixtures/runtime/check-safe-relationship-owners.mts');
await checkSafeRelationshipOwners(root, value);
const { checkSafeDealOwner } = await import('../../fixtures/runtime/check-safe-deal-owner.mts');
await checkSafeDealOwner(root, value);
await act(async()=>root.unmount());assert.equal(getDirtyUnsavedWork().length,0);
const { getQuoteApplicationServices, configureQuoteApplication } = await import('@/modules/quotes/application/composition/quoteApplicationServices');
const { replaceQuotes } = await import('@/modules/quotes/public/quotes');
const { saveQuoteDeliveryEvidence } = await import('@/modules/quotes/presentation/services/saveQuoteDeliveryEvidence');
const quoteServices = getQuoteApplicationServices();
const seedQuote = quoteServices.repository.list()[0]; assert(seedQuote);
const openingQuote = { ...seedQuote, resourceVersion: 7 }; replaceQuotes([openingQuote]);
const sendOptions: Array<{ expectedVersion: number; idempotencyKey: string; deliveryId: string }> = [];
configureQuoteApplication({ ...quoteServices, api: { ...quoteServices.api, commands: { ...quoteServices.api.commands,
 async recordSendEvidence(id, input, options) {
  sendOptions.push({ expectedVersion: options.expectedVersion, idempotencyKey: options.idempotencyKey, deliveryId: input.deliveryId });
  return { quote: { ...openingQuote, resourceVersion: 8 }, evidence: { authority: 'backend', commandId: 'delivery-proof', correlationId: 'delivery-proof', aggregateId: id, aggregateType: 'quote', version: 8, occurredAt: '2026-10-07T00:00:00Z', outcome: sendOptions.length === 1 ? 'COMMITTED' : 'REPLAYED', warnings: [], emittedEventIds: [], auditEvidenceIds: [] } };
 }
} } });
const deliveryValue = { channel: 'ZALO' as const, recipient: 'Recipient', sentAt: '2026-10-07T00:00:00Z' };
assert.equal(await saveQuoteDeliveryEvidence(openingQuote.id, undefined, deliveryValue, 'stable-delivery', 'u1'), false);
assert.equal(sendOptions.length, 0, 'Missing opening version refuses before command');
assert.equal(await saveQuoteDeliveryEvidence(openingQuote.id, 7, deliveryValue, 'stable-delivery', 'u1'), true);
assert.equal(await saveQuoteDeliveryEvidence(openingQuote.id, 7, deliveryValue, 'stable-delivery', 'u1'), true);
assert.deepEqual(sendOptions[0], sendOptions[1], 'Replay carries the original version and idempotency key after projection refresh');
console.log('SAFE_FAIL adapters PASS: opt-in boolean promise proof, retained refusals/errors, shared Activity policy/validation, pending duplicate/discard veto, stale entries, target/workspace refusal, cycle binding and explicit successful close.');
window.close();
});
