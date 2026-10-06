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



const { ContactEditModal, buildContactEditCommand } = await import('@/modules/contacts/presentation/detail/ContactEditModal');
const { createContactFormDraft } = await import('@/modules/contacts/presentation/components/ContactFormModal');
const { ContactQuickNoteModal } = await import('@/modules/contacts/presentation/detail/actions/ContactQuickNoteModal');
const { ContactCreateModal } = await import('@/modules/contacts/presentation/list/ContactCreateModal');
const { getDirtyUnsavedWork, discardDirtyUnsavedWork } = await import('@/platform/unsaved-work');
const { AppShell } = await import('@/app/shell/layout/AppShell');
const { createMemoryRouter, RouterProvider } = await import('react-router-dom');
const { ApplicationError } = await import('@/shared/domain');
const { validateOpenApiRequest } = await import('@/platform/api/contracts/openApiRuntimeValidation');
type Contact = import('@/modules/contacts').Contact;
type Command = import('@/modules/contacts/application/ports/ContactApiRuntime').ContactUpdateCommand;
const A: Contact = { id: 'contact-A', status: 'active', name: 'A Name', fullName: 'A Name', email: 'a@example.test', workEmail: 'a@example.test', notes: 'A note', ownerId: 'u1', tags: ['A'], createdAt: '2026-07-01T00:00:00Z', resourceVersion: 3 };
const B: Contact = { ...A, id: 'contact-B', name: 'B Name', fullName: 'B Name', notes: 'B note', resourceVersion: 9 };
let contact = A;
let open = true;
let create = false;
let held: (() => void) | undefined;
let hold = false;
let fail = false;
const commands: Command[] = [];
const commandIntentIds: Array<string | undefined> = [];
const { configureContactApplication, getContactApplicationServices } = await import('@/modules/contacts/application/composition/contactApplicationServices');
const { updateContactViaApi, createContactViaApi } = await import('@/modules/contacts');
const { buildContactCreateCommand } = await import('@/modules/contacts/presentation/model/contactFormCommands');
const services = getContactApplicationServices();
configureContactApplication({ ...services, api: { ...services.api, commands: {
  ...services.api.commands,
  async update(command, options) {
    commandIntentIds.push(options?.idempotencyKey);
    commands.push(command);
    const { contactId: _id, expectedVersion: _version, ...body } = command;
    assert.equal(validateOpenApiRequest('updateContact', body).valid, true);
    if (hold) await new Promise<void>(resolve => { held = resolve; });
    if (fail) throw new ApplicationError({ code: 'TEST_FIELDS', category: 'VALIDATION', message: 'private diagnostic', fieldErrors: { fullName: ['Fix supplied name'] } });
    return { ...(command.contactId === A.id ? A : B), resourceVersion: command.expectedVersion + 1 };
  },
  async create(input) { creates++; return { ...A, id: 'new-contact', fullName: input.fullName, name: input.fullName }; },
  async archive() { throw new Error('Unexpected archive'); },
  async createOrganizationRelationship() { throw new Error('Unexpected relationship'); },
  async updateOrganizationRelationship() { throw new Error('Unexpected relationship'); },
  async endOrganizationRelationship() { throw new Error('Unexpected relationship'); },
  async createCustomerRelationship() { throw new Error('Unexpected relationship'); },
  async updateCustomerRelationship() { throw new Error('Unexpected relationship'); },
  async endCustomerRelationship() { throw new Error('Unexpected relationship'); },
} } });
const { configureTaskApplication, getTaskApplicationServices } = await import('@/modules/tasks/application/composition/taskApplicationServices');
const taskServices = getTaskApplicationServices();
const activities: Array<{target: string | undefined; key: string}> = [];
let activityRelease: (() => void) | undefined;
configureTaskApplication({...taskServices,api:{...taskServices.api,commands:{...taskServices.api.commands,
 async logActivity(input, options) {
  activities.push({target:input.recordRef?.recordId,key:options.idempotencyKey});
  await new Promise<void>(resolve=>{activityRelease=resolve;});
  return taskServices.api.commands.logActivity(input,options);
 }
}}});
let creates = 0;
let refresh = () => {};
function Probe() {
  const [, update] = React.useReducer(value => value + 1, 0);
  refresh = () => update();
  return create ? React.createElement(ContactCreateModal, { show: open, onClose: () => { open = false; rerender(); }, onSave: async (draft, options) => { await createContactViaApi(buildContactCreateCommand(draft), options); } }) :
    React.createElement(ContactEditModal, { isOpen: open, contact, onClose: () => { open = false; rerender(); }, onSave: async (command: Command, options) => {
      await updateContactViaApi(command, options);
    } });
}
const { useContactDetailController } = await import('@/modules/contacts/presentation/hooks/useContactDetailController');
const { replaceContacts } = await import('@/modules/contacts');
const detailRef: { current: ReturnType<typeof useContactDetailController> } = { current: null };
function DetailProbe() {
 const controller = useContactDetailController({customers:[],deals:[],quotes:[],orders:[],taskActivity:{tasks:[],activities:[]},careCases:[]});
 detailRef.current=controller;
 return controller ? React.createElement(React.Fragment,null,
  React.createElement('button',{type:'button',id:'open-detail-edit',onClick:()=>controller.setShowEditModal(true)},'Open detail edit'),
  React.createElement(ContactEditModal,{isOpen:controller.showEditModal,contact:controller.contact,onClose:()=>controller.setShowEditModal(false),onSave:controller.handleSaveContact}),
  React.createElement(ContactQuickNoteModal,{isOpen:controller.showQuickNoteModal,targetId:controller.contact.id,onClose:()=>controller.setShowQuickNoteModal(false),onSave:controller.handleSaveQuickNote})) : null;
}
const workspaceKey = workspace.getWorkspaceContextSnapshot().workspaceKey;
const start = `/w/${workspaceKey}/crm/contacts`;
const target = `/w/${workspaceKey}/crm/leads`;
const router = createMemoryRouter([{ path: '/w/:workspaceKey/crm/*', element: React.createElement(I18nProvider, null, React.createElement(PlatformStateProvider, null, React.createElement(GuidanceProvider, null, React.createElement(AppShell, { children: React.createElement(Routes, null,
  React.createElement(Route, { path: 'contacts', element: React.createElement(Probe) }), React.createElement(Route, {path:'contacts/:contactId',element:React.createElement(DetailProbe)}), React.createElement(Route, { path: 'leads', element: React.createElement('p', { id: 'destination' }, 'Leads') })) })))) }], { initialEntries: [start] });
const rootElement = document.getElementById('root'); assert.ok(rootElement); const root = createRoot(rootElement);
function rerender() { root.render(React.createElement(RouterProvider, { router })); refresh(); }
const settle = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 130)); });
async function render() { await act(async () => rerender()); await settle(); }
async function change(selector: string, value: string) {
 const control = document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector); assert.ok(control, selector);
 const proto = control.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : control.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
 await act(async () => { Object.getOwnPropertyDescriptor(proto,'value')?.set?.call(control,value); control.dispatchEvent(new window.Event(control.tagName==='SELECT'?'change':'input',{bubbles:true})); }); await settle();
}
async function click(text: string) { const b=[...document.querySelectorAll<HTMLButtonElement>('button')].find(x=>x.textContent?.trim()===text); assert.ok(b,text); await act(async()=>b.click()); await settle(); }
async function submit(times=1) { const form=document.querySelector('form'); assert.ok(form); await act(async()=>{for(let i=0;i<times;i++) form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));}); await settle(); }
function dirty() { const entries=getDirtyUnsavedWork(); assert.equal(entries.length,1); const e=entries[0]; assert.ok(e); return e; }
const { FetchHttpClient } = await import('@/platform/api/client/FetchHttpClient');
const { CommercialApiClient } = await import('@/platform/api/generated/commercialApi');
const { ContactHttpCommandAdapter } = await import('@/modules/contacts/infrastructure/http/ContactHttpCommandAdapter');
const transmitted: unknown[] = [];
const adapter = new ContactHttpCommandAdapter(new CommercialApiClient(new FetchHttpClient({
 baseUrl: 'http://contact-parity.test', accessTokenProvider: { getAccessToken: () => 'fixture' },
 workspaceIdProvider: { getWorkspaceId: () => workspace.getWorkspaceContextSnapshot().workspaceId },
 fetchImplementation: async (url, init) => {
  assert.equal(String(url),'http://contact-parity.test/contacts/contact-A'); assert.equal(init?.method,'PATCH');
  assert.equal(init?.headers && new Headers(init.headers).get('If-Match'),'"3"');
  assert.equal(new Headers(init?.headers).get('Idempotency-Key'),'contact-intent-A');
  const body: unknown = JSON.parse(String(init?.body)); transmitted.push(body);
  assert.equal(validateOpenApiRequest('updateContact',body).valid,true);
  const now='2026-07-01T00:00:00Z';
  return new Response(JSON.stringify({ commandId:'fixture-command', correlationId:'fixture-correlation', aggregateId:A.id,
   aggregateType:'CONTACT', version:4, occurredAt:now, outcome:'COMMITTED', warnings:[], emittedEventIds:[], auditEvidenceIds:[],
   result:{contact:{id:A.id,workspaceId:workspace.getWorkspaceContextSnapshot().workspaceId,fullName:A.fullName,status:'active',version:4,createdAt:now,updatedAt:now}} }),
   {status:200,headers:{'Content-Type':'application/json'}});
 }
})));
const name=()=>document.querySelector<HTMLInputElement>('#contact-edit-name')?.value;
try {
 await adapter.update({contactId:A.id,expectedVersion:3,notes:null,ownerId:null},{idempotencyKey:'contact-intent-A'}); assert.deepEqual(transmitted,[{notes:null,ownerId:null}]);
 await render(); assert.equal(name(),'A Name'); assert.equal(getDirtyUnsavedWork().length,0);
 await change('#contact-edit-name','  A Name  '); assert.equal(getDirtyUnsavedWork().length,0,'trim-equivalent business values are clean'); await change('#contact-edit-name','A Name');
 await change('#contact-edit-name','A changed'); dirty(); await change('#contact-edit-name','A Name'); assert.equal(getDirtyUnsavedWork().length,0);
 const notes=document.querySelector('textarea'); assert.ok(notes); notes.id='proof-notes'; await change('#proof-notes','Updated note');
 contact={...A,fullName:'A refreshed',resourceVersion:7,notes:'server refresh'}; await render(); assert.equal(name(),'A Name'); assert.equal(document.querySelector<HTMLTextAreaElement>('textarea')?.value,'Updated note');
 contact=B; await render(); assert.equal(name(),'A Name'); dirty();
 hold=true; fail=true; await submit(2); assert.equal(commands.length,1); assert.deepEqual(commands[0],{contactId:A.id,expectedVersion:3,notes:'Updated note'});
 assert.equal(dirty().canDiscard?.(),false); assert.equal(discardDirtyUnsavedWork(),false);
 const currentWorkspace = workspace.getWorkspaceContextSnapshot();
 const nextWorkspace = workspace.listWorkspaceMemberships().find(item => item.status === 'active' && item.workspaceKey !== currentWorkspace.workspaceKey); assert.ok(nextWorkspace);
 const workspaceButton = [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.title.startsWith('Không gian làm việc:') || button.title.startsWith('Workspace:')); assert.ok(workspaceButton);
 await act(async()=>workspaceButton.click()); await settle(); await click(nextWorkspace.name); await click('Bỏ thay đổi');
 assert.equal(workspace.getWorkspaceContextSnapshot().workspaceKey,currentWorkspace.workspaceKey); assert.equal(router.state.location.pathname,start); assert.equal(name(),'A Name'); assert.equal(commands.length,1);
 await act(async()=>{void router.navigate(target);}); await settle(); await click('Bỏ thay đổi'); assert.equal(router.state.location.pathname,start); assert.equal(name(),'A Name');
 assert.ok(held); await act(async()=>held?.()); await settle(); hold=false;
 assert.equal(name(),'A Name'); dirty(); assert.ok(commandIntentIds[0]); assert.equal(document.activeElement?.id,'contact-edit-name'); assert.ok(document.body.textContent?.includes('Fix supplied name'));
 hold=false; await submit(); assert.equal(commandIntentIds[1],commandIntentIds[0],'same failed A intent retries with same idempotency key');
 await act(async()=>{assert.equal(discardDirtyUnsavedWork(),true);}); await settle(); open=true; await render(); assert.equal(name(),'B Name'); assert.equal(getDirtyUnsavedWork().length,0);
 contact={...B,notes:'B note',resourceVersion:9}; await render();
 const clearNotes=document.querySelector('textarea'); assert.ok(clearNotes); clearNotes.id='proof-notes'; await change('#proof-notes','');
 assert.equal(document.querySelector<HTMLButtonElement>('#contact-edit-ownerId')?.disabled,true,'canonical runtime denies unadmitted contacts.assign capability; do not bypass');
 const before=createContactFormDraft(B,'');
 const ownerClear=buildContactEditCommand({...before,ownerId:''},{contact:B,draft:before});
 assert.deepEqual(ownerClear,{contactId:B.id,expectedVersion:9,ownerId:null});
 assert.equal(validateOpenApiRequest('updateContact',{ownerId:ownerClear.ownerId}).valid,true);

 fail=false; await submit(); assert.deepEqual(commands[2],{contactId:B.id,expectedVersion:9,notes:null});
 await change('#contact-edit-name',''); let invalidSaved=true; await act(async()=>{invalidSaved=await dirty().save();}); assert.equal(invalidSaved,false); await submit(); assert.equal(commands.length,3); assert.equal(document.activeElement?.id,'contact-edit-name'); dirty();
 await act(async()=>{void router.navigate(target);}); await settle(); await click('Tiếp tục chỉnh sửa'); assert.equal(router.state.location.pathname,start); assert.equal(name(),'');
 await act(async()=>{void router.navigate(target);}); await settle(); await click('Bỏ thay đổi'); assert.equal(router.state.location.pathname,target); assert.equal(getDirtyUnsavedWork().length,0);
 open=true; create=true; await act(async()=>{void router.navigate(start);}); await settle(); assert.equal(document.querySelector<HTMLInputElement>('#contact-create-name')?.value,'');
 await change('#contact-create-name','New Contact'); dirty(); await click('Hủy'); await click('Tiếp tục chỉnh sửa'); assert.equal(creates,0);
 await submit(2); assert.equal(creates,1); assert.equal(getDirtyUnsavedWork().length,0);
 // Actual detail controller snapshots the target and rejects coexistence of mutable actions.
 await act(async()=>replaceContacts([A,B]));
 await act(async()=>{void router.navigate(`${start}/${A.id}`);}); await settle();
 await click('Open detail edit'); assert.equal(name(),'A Name'); assert.ok(detailRef.current);
 await act(async()=>detailRef.current?.setShowMeetingModal(true)); await settle(); assert.equal(detailRef.current?.showMeetingModal,false);
 await act(async()=>replaceContacts([{...A,fullName:'A refresh later',resourceVersion:11},B])); await settle(); assert.equal(name(),'A Name');
 await act(async()=>{void router.navigate(`${start}/${B.id}`);}); await settle(); assert.equal(detailRef.current?.showEditModal,false,'clean A cycle ends before B');
 await click('Open detail edit'); assert.equal(name(),'B Name'); await change('#contact-edit-notes','B bound note');
 hold=true; const beforeCommandCount=commands.length; await submit(2); assert.equal(commands.length,beforeCommandCount+1); assert.equal(commands.at(-1)?.contactId,B.id); assert.equal(commands.at(-1)?.expectedVersion,9);
 await act(async()=>{void router.navigate(`${start}/${A.id}`);}); await settle(); await click('Bỏ thay đổi'); assert.equal(router.state.location.pathname,`${start}/${B.id}`);
 assert.ok(held); await act(async()=>held?.()); await settle(); hold=false; assert.equal(detailRef.current?.showEditModal,false);
 await click('Open detail edit'); await change('#contact-edit-notes','Truthful global save');
 const savedCommands=commands.length;
 await act(async()=>{void router.navigate(target);}); await settle(); await click('Lưu và tiếp tục');
 assert.equal(router.state.location.pathname,target); assert.equal(commands.length,savedCommands+1); assert.equal(commands.at(-1)?.contactId,B.id); assert.equal(getDirtyUnsavedWork().length,0);
 // Contact note uses the actual Tasks public command port, owned by the opening Contact.
 await act(async()=>{void router.navigate(`${start}/${A.id}`);}); await settle();
 await act(async()=>detailRef.current?.setShowQuickNoteModal(true)); await settle();
 const noteSubject=document.querySelector<HTMLInputElement>('form input:not([type="checkbox"]):not([type="datetime-local"])'); assert.ok(noteSubject); noteSubject.id='contact-note-subject';
 await change('#contact-note-subject','A target note');
 const noteBody=document.querySelector('form textarea'); assert.ok(noteBody); noteBody.id='contact-note-body'; await change('#contact-note-body','A note body');
 await submit(2); assert.equal(activities.length,1); assert.equal(activities[0]?.target,A.id); assert.ok(activities[0]?.key.includes(A.id));
 assert.equal(discardDirtyUnsavedWork(),false);
 await act(async()=>{void router.navigate(`${start}/${B.id}`);}); await settle(); await click('Bỏ thay đổi');
 assert.equal(router.state.location.pathname,`${start}/${A.id}`); assert.equal(activities.length,1);
 assert.ok(activityRelease); await act(async()=>activityRelease?.()); await settle();
 assert.equal(detailRef.current?.showQuickNoteModal,false);
 assert.deepEqual(browserErrors,[]);
 console.log('B2 Contact real form PASS: create/edit init, refresh snapshot, dirty/revert, target A/B, delta/null/owner mapping, runtime request authority, first invalid/server fields, route keep/discard, pending veto/duplicate/failure.');
} finally { await act(async()=>root.unmount()); router.dispose(); configureTaskApplication(taskServices); window.close(); }
