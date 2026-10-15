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



// Supplemental behavior fixture. Real policy/HTTP/SQL acceptance is run separately.
const { ContactEditModal } = await import('@/modules/contacts/presentation/detail/ContactEditModal');
const { configureEffectiveRecordAccessAuthority } = await import('@/platform/access-control/application/effectiveRecordAccessBinding');
const { configureContactApplication, getContactApplicationServices } = await import('@/modules/contacts/application/composition/contactApplicationServices');
const services = getContactApplicationServices();
configureContactApplication({ ...services, api: { ...services.api, mode: 'connected' } });
type Contact = import('@/modules/contacts').Contact;
type Command = import('@/modules/contacts/application/ports/ContactApiRuntime').ContactUpdateCommand;
type FieldAccess = import('@/platform/access-control/domain/accessControl.types').FieldAccess;
let mode: FieldAccess = 'READ_ONLY';
let open = true;
let fail = false;
let calls = 0;
let release: (() => void) | undefined;
let hold = false;
let contact: Contact = { id: 'fls-1', name: 'Writable Name', fullName: 'Writable Name', status: 'active', notes: 'Readable notes', workEmail: 'readable@example.test', createdAt: '2026-10-15T00:00:00Z', resourceVersion: 3 };
const commands: Command[] = [];
configureEffectiveRecordAccessAuthority({ source: 'backend', async evaluate(request) {
 calls++;
 if (hold) await new Promise<void>(resolve => { release = resolve; });
 return { workspaceId: request.workspaceId, resourceKey: 'contacts', ...(request.recordId ? {recordId:request.recordId} : {}), canRead: true, canUpdate: true, canDelete: false, canExport: false, canApprove: false, allowedCommands: ['contact.update'], fieldAccess: Object.fromEntries((request.requestedFields ?? []).map(key => [key, key === 'notes' || key === 'workEmail' ? mode : 'READ_WRITE'])), decisionReasons: [], evaluatedAt: new Date().toISOString(), authority: 'backend' };
} });
function Probe() { return React.createElement(ContactEditModal, {isOpen:open, contact, onClose:()=>{}, onSave:async command=>{commands.push(command);if(fail)throw new Error('Simulated failed request');}}); }
const { MemoryRouter } = await import('react-router-dom');
const node = document.getElementById('root');assert.ok(node);const root = createRoot(node);
const settle = async()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,150));});
async function render(){await act(async()=>root.render(React.createElement(MemoryRouter,null,React.createElement(I18nProvider,null,React.createElement(PlatformStateProvider,null,React.createElement(GuidanceProvider,null,React.createElement(Probe)))))));await settle();}
async function change(id:string,value:string){const input=document.querySelector<HTMLInputElement|HTMLTextAreaElement>(id);assert.ok(input);const proto=input.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;await act(async()=>{Object.getOwnPropertyDescriptor(proto,'value')?.set?.call(input,value);input.dispatchEvent(new window.Event('input',{bubbles:true}));});await settle();}
async function submit(){const form=document.querySelector('form');assert.ok(form);await act(async()=>form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));await settle();}
async function reopen(next:FieldAccess){open=false;await render();mode=next;contact={...contact,id:'fls-'+(calls+2)};open=true;await render();}
await render();
const notes=document.querySelector<HTMLTextAreaElement>('#contact-edit-notes');assert.ok(notes);assert.equal(notes.value,'Readable notes');assert.ok(notes.matches(':disabled'));
const email=document.querySelector<HTMLInputElement>('#contact-edit-email');assert.ok(email?.matches(':disabled'),'field mapping applies beyond notes');
// Dispatch even a synthetic change against disabled controls: update guard must refuse it.
await change('#contact-edit-notes','Forbidden');await change('#contact-edit-name','Allowed Name');await submit();assert.equal(commands.length,1);assert.deepEqual(commands[0],{contactId:contact.id,expectedVersion:3,fullName:'Allowed Name'});
await reopen('HIDDEN');assert.equal(document.querySelector('#contact-edit-notes'),null);assert.equal(document.querySelector('#contact-edit-email'),null);assert.ok(!document.body.textContent?.includes('Readable notes'));
await change('#contact-edit-name','Hidden-safe Name');await submit();assert.ok(!('notes' in (commands.at(-1) ?? {})));
await reopen('READ_WRITE');await change('#contact-edit-notes','Updated notes');await submit();assert.equal(commands.at(-1)?.notes,'Updated notes');
await reopen('READ_WRITE');fail=true;await change('#contact-edit-name','Retained Draft');await submit();assert.equal(document.querySelector<HTMLInputElement>('#contact-edit-name')?.value,'Retained Draft');fail=false;
// Unconfirmed access cannot admit either control updates or a programmatic submit.
open=false;await render();contact={...contact,id:'fls-pending'};hold=true;open=true;await render();const before=commands.length;assert.equal(document.querySelector('#contact-edit-notes'),null);await submit();assert.equal(commands.length,before);hold=false;await act(async()=>release?.());await settle();assert.ok(document.querySelector('#contact-edit-notes'));
open=false;await render();
const { resetEffectiveRecordAccessAuthority } = await import('@/platform/access-control/application/effectiveRecordAccessBinding');
resetEffectiveRecordAccessAuthority();contact={...contact,id:'fls-missing-authority'};open=true;await render();const missingBefore=commands.length;assert.equal(document.querySelector('#contact-edit-name'),null);await submit();assert.equal(commands.length,missingBefore,'Connected mode must not use local permissions as backend authority');
assert.equal(browserErrors.length,0);await act(async()=>root.unmount());
dom.window.close();console.log('Contact FLS form PASS: mapped READ_WRITE/READ_ONLY/HIDDEN, forged disabled update, changed-field payload, failed draft and pending access refusal.');
