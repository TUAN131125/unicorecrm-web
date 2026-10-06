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



const { ContactCustomerRelationshipsPanel } = await import('@/modules/contacts/presentation/detail/ContactCustomerRelationshipsPanel');
const { ContactOrganizationRelationshipsPanel } = await import('@/modules/contacts/presentation/detail/ContactOrganizationRelationshipsPanel');
const { getContactRelationshipSummaryResource } = await import('@/modules/contacts/application/vertical-slice/contactAuthoritativeQueries');
const { acquireContactInteraction, releaseContactInteraction } = await import('@/modules/contacts/presentation/model/contactInteractionOwnership');
const { ApplicationError } = await import('@/shared/domain');
const { configureContactApplication, getContactApplicationServices } = await import('@/modules/contacts/application/composition/contactApplicationServices');
const { getDirtyUnsavedWork, discardDirtyUnsavedWork, registerUnsavedWork } = await import('@/platform/unsaved-work');
type Contact = import('@/modules/contacts').Contact;
type Summary = import('@/modules/contacts/application/ports/ContactApiRuntime').ContactRelationshipSummary;
const A: Contact = { id:'relationship-A', status:'active', fullName:'A', name:'A', resourceVersion:3, createdAt:'2026-01-01T00:00:00Z' };
const B: Contact = { ...A, id:'relationship-B', name:'B', resourceVersion:9 };
const counts = { tasks:0, activities:0, deals:0, quotes:0, orders:0, invoices:0, payments:0, shipping:0, returns:0, supportCases:0 };
const commands: Array<{ contactId:string; expectedVersion:number; endedReason?:string; customerId?:string; organizationId?:string; role?:string; effectiveFrom?:string }> = [];
let serverField: string | undefined;
function rejectField() { if(serverField) throw new ApplicationError({code:"VALIDATION_FAILED",category:"VALIDATION",message:"Private field diagnostic",fieldErrors:{[serverField]:["Rejected field"]}}); }
let holdCreate = false;
let serverVersion = 3;
let versionConflictMode = false;
let refreshFails = false;
let nonConflictCategory: 'AUTHORIZATION' | 'NETWORK' | undefined;
const summaryQueries: Array<{ id:string; workspaceId:string; version:number }> = [];
const committedIntents = new Map<string, string>();
function checkVersionAttempt(input: {contactId:string; expectedVersion:number; endedReason:string}, key: string | undefined) {
  if (!versionConflictMode) return;
  assert.ok(key);
  const fingerprint = JSON.stringify(input);
  const committed = committedIntents.get(key);
  if (committed && committed !== fingerprint) throw new ApplicationError({code:'IDEMPOTENCY_KEY_REUSED',category:'CONFLICT',message:'Private replay diagnostic'});
  if (nonConflictCategory) throw new ApplicationError({code:nonConflictCategory === 'NETWORK' ? 'NETWORK_REQUEST_FAILED' : 'AUTHORIZATION_DENIED',category:nonConflictCategory,message:'Private failure diagnostic'});
  if (input.expectedVersion !== serverVersion) throw new ApplicationError({code:'RESOURCE_VERSION_CONFLICT',category:'CONFLICT',status:409,message:'Private conflict diagnostic',details:{expectedVersion:input.expectedVersion,actualVersion:serverVersion}});
  committedIntents.set(key, fingerprint);
}
const idempotencyKeys: Array<string | undefined> = [];
let resolve: (() => void) | undefined;
let fail = false;
let contact = A;
let organization = false;
const services = getContactApplicationServices();
configureContactApplication({ ...services, api: { ...services.api,
  queries: { ...services.api.queries, async getRelationshipSummary(id):Promise<Summary> {
    summaryQueries.push({id,workspaceId:workspace.getWorkspaceContextSnapshot().workspaceId,version:id === A.id ? serverVersion : 9});
    if (refreshFails && id === A.id) throw new ApplicationError({code:'NETWORK_REQUEST_FAILED',category:'NETWORK',message:'Private refresh diagnostic'});
    const target = id === A.id ? {...A,resourceVersion:serverVersion} : B;
    return { contact:target, projectionVersion:target.resourceVersion ?? 0, generatedAt:'2026-01-01', organizationIds:[], customerIds:[], linkedRecords:[], linkedRecordCounts:counts,
      allowedActions:['createContactCustomerRelationship','updateContactCustomerRelationship','endContactCustomerRelationship','createContactOrganizationRelationship','updateContactOrganizationRelationship','endContactOrganizationRelationship'],
      customerRelationships:[{ id:'customer-rel', createdAt:'2026-01-01', customerId:'customer-1', role:'other', effectiveFrom:'2026-01-01' }],
      organizationRelationships:[{ id:'org-rel', createdAt:'2026-01-01', isPrimaryRepresentative:false, organizationAccountId:'org-1', role:'employee', isPrimaryAffiliation:false, effectiveFrom:'2026-01-01' }] };
  } },
  commands: { ...services.api.commands,
    async create(input) { return A; }, async update(input) { return A; }, async archive(input) { return A; },
    async createCustomerRelationship(input, options) { commands.push(input); idempotencyKeys.push(options?.idempotencyKey); rejectField(); if (holdCreate) await new Promise<void>(r => { resolve = r; }); return input.contactId === A.id ? A : B; }, async updateCustomerRelationship(input, options) { commands.push(input); idempotencyKeys.push(options?.idempotencyKey); rejectField(); return input.contactId === A.id ? A : B; },
    async createOrganizationRelationship(input, options) { commands.push(input); idempotencyKeys.push(options?.idempotencyKey); rejectField(); if (holdCreate) await new Promise<void>(r => { resolve = r; }); return input.contactId === A.id ? A : B; }, async updateOrganizationRelationship(input, options) { commands.push(input); idempotencyKeys.push(options?.idempotencyKey); rejectField(); return input.contactId === A.id ? A : B; },
    async endCustomerRelationship(input, options) { commands.push(input); idempotencyKeys.push(options?.idempotencyKey); await new Promise<void>(r => { resolve = r; }); checkVersionAttempt(input, options?.idempotencyKey); if (fail) throw new ApplicationError({ code:'RELATIONSHIP_TEST_FAILURE', category:'VALIDATION', message:'relationship validation failed', fieldErrors:{ endedReason:['Correct the relationship reason'] } }); return input.contactId === A.id ? A : B; },
    async endOrganizationRelationship(input, options) { commands.push(input); idempotencyKeys.push(options?.idempotencyKey); await new Promise<void>(r => { resolve = r; }); checkVersionAttempt(input, options?.idempotencyKey); if (fail) throw new ApplicationError({ code:'RELATIONSHIP_TEST_FAILURE', category:'VALIDATION', message:'relationship validation failed', fieldErrors:{ endedReason:['Correct the relationship reason'] } }); return input.contactId === A.id ? A : B; },
  } } });
const { configureCustomerApplication, getCustomerApplicationServices } = await import('@/modules/customers/application/composition/customerApplicationServices');
const customerServices = getCustomerApplicationServices();
configureCustomerApplication({ ...customerServices, api: { ...customerServices.api, queries: { ...customerServices.api.queries, async list() { return { items:[{ id:'customer-2', workspaceId:workspace.getWorkspaceContextSnapshot().workspaceId, customerCode:'Customer 2', type:'B2C', relationshipRef:{ type:'CONTACT', id:A.id }, status:'ACTIVE', health:null, firstPurchaseAt:null, lastPurchaseAt:null, tags:[], createdAt:'2026-01-01', updatedAt:'2026-01-01' }], pageInfo:{ hasNextPage:false }, loadedAt:'2026-01-01', authority:'demo' }; } } } });
const { configureOrganizationApplication, getOrganizationApplicationServices } = await import('@/modules/organizations/application/composition/organizationApplicationServices');
const organizationServices = getOrganizationApplicationServices();
configureOrganizationApplication({ ...organizationServices, api: { ...organizationServices.api, queries: { ...organizationServices.api.queries, async list() { return { items:[{ id:'org-2', workspaceId:workspace.getWorkspaceContextSnapshot().workspaceId, displayName:'Organization 2', contactRefs:[], createdAt:'2026-01-01' }], pageInfo:{ hasNextPage:false }, loadedAt:'2026-01-01', authority:'demo' }; } } } });
const container = document.getElementById('root'); assert.ok(container); const root = createRoot(container);
const render = () => root.render(React.createElement(I18nProvider, null, organization ? React.createElement(ContactOrganizationRelationshipsPanel, { contact, onOpenOrganization() {} }) : React.createElement(ContactCustomerRelationshipsPanel, { contact })));
async function flush(action: () => void = () => {}) { await act(async () => { action(); await new Promise(r => setTimeout(r, 30)); }); }
function button(label:string) { const found = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === label); assert.ok(found, `Missing button ${label}`); return found; }
async function reason(value:string) { const field=document.querySelector('textarea'); assert.ok(field); await flush(() => { Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value')?.set?.call(field,value); field.dispatchEvent(new window.Event('input',{bubbles:true})); }); }
for (const kind of ['Customer','Organization']) {
  organization = kind === 'Organization'; contact = A; await flush(render);
  await flush(() => button('Kết thúc').click());
  await reason('A reason'); assert.equal(getDirtyUnsavedWork().length,1);
  const savedAEntry = getDirtyUnsavedWork()[0]; assert.ok(savedAEntry); assert.ok(savedAEntry.id.startsWith(`contact-relationship:${kind.toLowerCase()}:`));
  await reason(''); assert.equal(getDirtyUnsavedWork().length,0);
  await reason('A reason');
  contact = { ...A, resourceVersion:7 }; await flush(render); assert.equal(document.querySelector('textarea')?.value,'A reason');
  contact = B; await flush(render); assert.equal(document.querySelector('textarea')?.value,'A reason');
  await flush(() => button('Hủy').click()); await flush(() => button('Tiếp tục chỉnh sửa').click()); assert.equal(document.querySelector('textarea')?.value,'A reason');
  const endButtons = [...document.querySelectorAll('button')].filter(b => b.textContent?.trim() === 'Kết thúc');
  const confirm = endButtons.at(-1); assert.ok(confirm);
  const before = commands.length; fail=true;
  await flush(() => { confirm.click(); confirm.click(); }); assert.equal(commands.length,before+1); assert.ok(idempotencyKeys[before]);
  assert.equal(commands.at(-1)?.contactId,A.id); assert.equal(commands.at(-1)?.expectedVersion,3);
  assert.equal(discardDirtyUnsavedWork(),false); assert.equal(document.querySelector('textarea')?.value,'A reason');
  const unrelatedField = document.createElement('textarea'); unrelatedField.id='unrelated-page-field'; document.body.prepend(unrelatedField);
  assert.ok(resolve); await flush(resolve); assert.equal(document.activeElement?.id,`${kind.toLowerCase()}-relationship-reason`,'field error focuses only the owning relationship surface'); unrelatedField.remove(); assert.equal(document.querySelector('textarea')?.value,'A reason'); assert.ok(document.body.textContent?.includes('RELATIONSHIP_TEST_FAILURE') || document.querySelector('.text-rose-700'));
  fail=false; await flush(() => [...document.querySelectorAll('button')].filter(b => b.textContent?.trim() === 'Kết thúc').at(-1)?.click());
  assert.ok(resolve); await flush(resolve); assert.equal(idempotencyKeys[before+1],idempotencyKeys[before]); assert.equal(document.querySelector('textarea'),null); assert.equal(getDirtyUnsavedWork().length,0);
  await flush(() => button('Kết thúc').click()); assert.equal(document.querySelector('textarea')?.value,'');
  await reason('B reason'); const beforeStaleSave = commands.length; assert.equal(await savedAEntry.save(),false); assert.equal(commands.length,beforeStaleSave); assert.equal(document.querySelector('textarea')?.value,'B reason'); await flush(() => { assert.equal(discardDirtyUnsavedWork(),true); }); assert.equal(document.querySelector('textarea'),null);
  await flush(() => button('Sửa').click()); assert.equal(document.querySelector('form')?.getAttribute('data-contact-target-id'),B.id);
  const roleSelect = document.querySelectorAll('form select')[1]; assert.ok(roleSelect);
  await flush(() => { Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value')?.set?.call(roleSelect, kind === 'Customer' ? 'billing' : 'buyer'); roleSelect.dispatchEvent(new window.Event('change',{bubbles:true})); });
  assert.equal(getDirtyUnsavedWork().length,1);
  contact=A; await flush(render); assert.equal(document.querySelector('form')?.getAttribute('data-contact-target-id'),B.id);
  await flush(() => document.querySelector('form')?.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(commands.at(-1)?.contactId,B.id); assert.equal(commands.at(-1)?.expectedVersion,9); assert.equal(document.querySelector('form'),null);
  await flush(() => button('Sửa').click()); contact=B; await flush(render); assert.equal(document.querySelector('form'),null); contact=A; await flush(render);
  const cleanProfileOwner = Symbol('clean-profile-interaction'); assert.equal(acquireContactInteraction(cleanProfileOwner),true);
  await flush(() => button('Liên kết').click()); assert.equal(document.querySelector('form'),null); releaseContactInteraction(cleanProfileOwner);
  const unregisterOther = registerUnsavedWork({ id:'contact-form:edit:other-contact', title:'Other Contact edit', isDirty:true, save:async () => false, discard() {} });
  await flush(() => button('Liên kết').click()); assert.equal(document.querySelector('form'),null); unregisterOther();
  await flush(() => button('Liên kết').click()); assert.equal(document.querySelector('form')?.getAttribute('data-contact-target-id'),A.id);
  const subject = document.querySelector<HTMLSelectElement>('form select[required]'); assert.ok(subject);
  await flush(() => { Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value')?.set?.call(subject,kind === 'Customer' ? 'customer-2' : 'org-2'); subject.dispatchEvent(new window.Event('change',{bubbles:true})); });
  assert.equal(getDirtyUnsavedWork().length,1);
  contact = B; await flush(render); assert.equal(document.querySelector('form')?.getAttribute('data-contact-target-id'),A.id);
  const createCount = commands.length;
  await flush(() => { const form = document.querySelector('form'); assert.ok(form); form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})); form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})); });
  assert.equal(commands.length,createCount+1); assert.ok(idempotencyKeys[createCount]); assert.notEqual(idempotencyKeys[createCount],idempotencyKeys[createCount-1]); assert.equal(commands.at(-1)?.contactId,A.id); assert.equal(commands.at(-1)?.expectedVersion,3);
  if (kind === 'Customer') { assert.equal(commands.at(-1)?.customerId,'customer-2'); assert.equal(commands.at(-1)?.role,'other'); }
  else { assert.equal(commands.at(-1)?.organizationId,'org-2'); assert.equal(commands.at(-1)?.role,'employee'); assert.ok(commands.at(-1)?.effectiveFrom); }
  assert.equal(document.querySelector('form'),null);

}
// Business field identity must not be inferred from the HTML control type.
for (const family of ['Organization','Customer']) {
  organization=family==='Organization'; contact=A; await flush(render);
  await flush(()=>button('Liên kết').click());
  const subjectId=`${family.toLowerCase()}-relationship-subject`;
  const subject=document.getElementById(subjectId); assert.ok(subject);
  const beforeLocal=commands.length;
  await flush(()=>document.querySelector('form')?.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(commands.length,beforeLocal); assert.equal(document.activeElement?.id,subjectId);
  await flush(()=>{Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value')?.set?.call(subject,organization?'org-2':'customer-2');subject.dispatchEvent(new window.Event('change',{bubbles:true}));});
  if(organization) {
    await flush(()=>document.getElementById('organization-relationship-effective-from')?.click());
    await flush(()=>button('Xóa').click());
    const beforeDate=commands.length;
    await flush(()=>document.querySelector('form')?.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
    assert.equal(commands.length,beforeDate,'invalid effectiveFrom must not mutate');
    assert.equal(document.activeElement?.id,'organization-relationship-effective-from');
    assert.equal(document.querySelector<HTMLSelectElement>('#organization-relationship-subject')?.value,'org-2');
    assert.equal(document.querySelector<HTMLInputElement>('form input[type=hidden]')?.value,'','invalid date draft remains unchanged');
  }
  await flush(()=>{assert.equal(discardDirtyUnsavedWork(),true);});
  for(const field of (organization?['organizationId','role','effectiveFrom']:['customerId','role'])) {
    await flush(()=>button('Liên kết').click());
    const picker=document.getElementById(subjectId); assert.ok(picker);
    await flush(()=>{Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value')?.set?.call(picker,organization?'org-2':'customer-2');picker.dispatchEvent(new window.Event('change',{bubbles:true}));});
    const draftBefore=Array.from(document.querySelectorAll<HTMLSelectElement|HTMLInputElement>('form select, form input')).map(element=>element.value);
    const registryId=getDirtyUnsavedWork()[0]?.id; const workspaceId=workspace.getWorkspaceContextSnapshot().workspaceId;
    contact=B; await flush(render); serverField=field; const before=commands.length;
    await flush(()=>document.querySelector('form')?.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
    assert.equal(commands.length,before+1,'server validation invokes one command');
    assert.equal(commands.at(-1)?.contactId,A.id); assert.equal(commands.at(-1)?.expectedVersion,3);
    assert.equal(getDirtyUnsavedWork()[0]?.id,registryId); assert.equal(workspace.getWorkspaceContextSnapshot().workspaceId,workspaceId);
    assert.deepEqual(Array.from(document.querySelectorAll<HTMLSelectElement|HTMLInputElement>('form select, form input')).map(element=>element.value),draftBefore);
    assert.equal(document.activeElement?.id,field==='role'?`${family.toLowerCase()}-relationship-role`:field==='effectiveFrom'?'organization-relationship-effective-from':subjectId);
    assert.ok(!document.body.textContent?.includes('Private field diagnostic'));
    serverField=undefined; await flush(()=>{assert.equal(discardDirtyUnsavedWork(),true);}); contact=A; await flush(render);
  }
}
// Exact Contact authority baaf150: version rejection precedes RecordCommit/AddIdempotency.
// Failed v3 has no committed fingerprint; an explicit v4 retry legally retains the key.
for (const family of ['Organization','Customer']) {
  organization = family === 'Organization'; contact = A; serverVersion = 3; fail = false;
  versionConflictMode = true; committedIntents.clear(); await flush(render);
  await flush(() => button('Kết thúc').click()); await reason(`${family} A draft`);
  const openingEntry = getDirtyUnsavedWork()[0]; assert.ok(openingEntry);
  const originalWorkspace = workspace.getWorkspaceContextSnapshot().workspaceId;
  contact = B; await flush(render);
  const queryStart = summaryQueries.length; const commandStart = commands.length;
  serverVersion = 4;
  await flush(() => [...document.querySelectorAll('button')].filter(b => b.textContent?.trim() === 'Kết thúc').at(-1)?.click());
  assert.equal(commands.length, commandStart + 1);
  assert.deepEqual({id:commands.at(-1)?.contactId,version:commands.at(-1)?.expectedVersion},{id:A.id,version:3});
  assert.ok(resolve); await flush(resolve);
  assert.equal(committedIntents.size,0,'structured version rejection does not reserve a committed fingerprint');
  assert.equal(document.querySelector('textarea')?.value,`${family} A draft`);
  assert.equal(getDirtyUnsavedWork()[0]?.id,openingEntry.id,'rebase retains the same target/cycle registry identity');
  assert.equal(workspace.getWorkspaceContextSnapshot().workspaceId,originalWorkspace);
  assert.deepEqual(summaryQueries.slice(queryStart),[{id:A.id,workspaceId:originalWorkspace,version:4}],'conflict queries opening A only; B9 is never borrowed');
  assert.equal(commands.length,commandStart+1,'refresh does not auto-resubmit');
  assert.ok(!document.body.textContent?.includes('Private conflict diagnostic'));
  let retry: Promise<boolean> | undefined;
  if (family === 'Customer') await flush(() => { retry = openingEntry.save(); });
  else await flush(() => [...document.querySelectorAll('button')].filter(b => b.textContent?.trim() === 'Kết thúc').at(-1)?.click());
  assert.equal(commands.length,commandStart+2,'explicit retry admits exactly one new command');
  assert.deepEqual({id:commands.at(-1)?.contactId,version:commands.at(-1)?.expectedVersion,reason:commands.at(-1)?.endedReason},{id:A.id,version:4,reason:`${family} A draft`});
  assert.equal(idempotencyKeys[commandStart+1],idempotencyKeys[commandStart],'uncommitted version rejection allows stable intent reuse');
  assert.ok(resolve); await flush(resolve); if(retry) assert.equal(await retry,true,'global Save uses the rebased opening version truthfully');
  assert.equal(document.querySelector('textarea'),null); assert.equal(getDirtyUnsavedWork().length,0);
  assert.equal(committedIntents.size,1);
  const committedKey=idempotencyKeys[commandStart+1]; assert.ok(committedKey);
  assert.throws(()=>checkVersionAttempt({contactId:A.id,expectedVersion:3,endedReason:`${family} A draft`},committedKey),error=>error instanceof ApplicationError && error.code==='IDEMPOTENCY_KEY_REUSED','changed fingerprints are forbidden after commit');
  // Refresh failure refuses mutation until a later explicit Save can authoritatively recover A.
  contact=A; serverVersion=3; await flush(render); await act(async()=>{await getContactRelationshipSummaryResource(A.id).refresh();}); await flush(()=>button('Kết thúc').click()); await reason('Refresh failure A draft');
  contact=B; await flush(render); serverVersion=4; refreshFails=true;
  const failureStart=commands.length;
  await flush(()=>[...document.querySelectorAll('button')].filter(b=>b.textContent?.trim()==='Kết thúc').at(-1)?.click()); assert.ok(resolve); await flush(resolve);
  assert.equal(document.querySelector('textarea')?.value,'Refresh failure A draft'); assert.equal(getDirtyUnsavedWork().length,1);
  assert.ok(!document.body.textContent?.includes('Private refresh diagnostic'));
  await act(async()=>{assert.equal(await getDirtyUnsavedWork()[0]?.save(),false);});
  assert.equal(commands.length,failureStart+1,'failed authoritative recovery never blindly resubmits stale v3');
  refreshFails=false; const retained=getDirtyUnsavedWork()[0]; assert.ok(retained);
  await flush(()=>{retry=retained.save();}); assert.equal(commands.at(-1)?.contactId,A.id); assert.equal(commands.at(-1)?.expectedVersion,4);
  assert.ok(resolve); await flush(resolve); assert.ok(retry); assert.equal(await retry,true); assert.equal(getDirtyUnsavedWork().length,0);
  for(const category of ['AUTHORIZATION','NETWORK'] as const) {
    contact=A; serverVersion=3; await flush(render); await act(async()=>{await getContactRelationshipSummaryResource(A.id).refresh();}); await flush(()=>button('Kết thúc').click()); await reason(`${category} draft`); contact=B; await flush(render);
    nonConflictCategory=category; const queriesBefore=summaryQueries.length;
    await flush(()=>[...document.querySelectorAll('button')].filter(b=>b.textContent?.trim()==='Kết thúc').at(-1)?.click()); assert.ok(resolve); await flush(resolve);
    assert.equal(summaryQueries.length,queriesBefore,'non-version failures do not rebase concurrency');
    assert.equal(document.querySelector('textarea')?.value,`${category} draft`); assert.equal(getDirtyUnsavedWork().length,1);
    assert.ok(!document.body.textContent?.includes('Private failure diagnostic'));
    nonConflictCategory=undefined;
    await flush(()=>[...document.querySelectorAll('button')].filter(b=>b.textContent?.trim()==='Kết thúc').at(-1)?.click()); assert.equal(commands.at(-1)?.expectedVersion,3); assert.equal(commands.at(-1)?.contactId,A.id); assert.ok(resolve); await flush(resolve);
    assert.equal(document.querySelector('textarea'),null);
  }
  versionConflictMode=false; serverVersion=3;
}
// A stale entry cannot report a successful Save after its component was replaced.
organization = true; contact = A; await flush(render); await flush(() => button('Liên kết').click());
const pendingSubject = document.querySelector<HTMLSelectElement>('form select[required]'); assert.ok(pendingSubject);
await flush(() => { Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value')?.set?.call(pendingSubject,'org-2'); pendingSubject.dispatchEvent(new window.Event('change',{bubbles:true})); });
const pendingEntry = getDirtyUnsavedWork()[0]; assert.ok(pendingEntry); holdCreate = true;
let pendingSave: Promise<boolean> | undefined;
await flush(() => { pendingSave = pendingEntry.save(); }); assert.ok(pendingSave); assert.equal(await pendingEntry.save(),false);
await flush(() => root.render(React.createElement('p',null,'Replaced interaction')));
assert.equal(await pendingEntry.save(),false); assert.equal(getDirtyUnsavedWork().length,0);
contact=B; await flush(render); await flush(() => button('Kết thúc').click()); await reason('New B lifecycle');
assert.ok(resolve); let staleResult: boolean | undefined;
await act(async () => { resolve?.(); staleResult = await pendingSave; });
assert.equal(staleResult,false); assert.equal(document.querySelector('textarea')?.value,'New B lifecycle');
await flush(() => { assert.equal(discardDirtyUnsavedWork(),true); });
// Exercise an external context change with the real workspace snapshot runtime.
const openingWorkspace = workspace.getWorkspaceContextSnapshot();
const alternateWorkspace = workspace.listWorkspaceMemberships().find(item => item.status === 'active' && item.workspaceId !== openingWorkspace.workspaceId); assert.ok(alternateWorkspace);
await flush(() => button('Liên kết').click()); assert.ok(document.querySelector('form'));
await act(async () => { await workspace.switchWorkspaceContext(alternateWorkspace.workspaceKey); }); await flush();
assert.equal(document.querySelector('form'),null,'clean workspace change ends the opening lifecycle');
await act(async () => { await workspace.switchWorkspaceContext(openingWorkspace.workspaceKey); }); await flush();
await flush(() => button('Kết thúc').click()); await reason('Opening workspace reason');
const workspaceEntry = getDirtyUnsavedWork()[0]; assert.ok(workspaceEntry);
await act(async () => { await workspace.switchWorkspaceContext(alternateWorkspace.workspaceKey); }); await flush();
assert.equal(document.querySelector('textarea')?.value,'Opening workspace reason'); assert.equal(getDirtyUnsavedWork().length,1);
const beforeWorkspaceSubmit = commands.length; assert.equal(await workspaceEntry.save(),false);
await flush(() => [...document.querySelectorAll('button')].filter(item => item.textContent?.trim() === 'Kết thúc').at(-1)?.click());
assert.equal(commands.length,beforeWorkspaceSubmit,'a changed workspace cannot receive the opening workspace command');
assert.ok(document.body.textContent?.includes('Không gian làm việc đã thay đổi'));
await act(async () => { await workspace.switchWorkspaceContext(openingWorkspace.workspaceKey); }); await flush();
await flush(() => { assert.equal(discardDirtyUnsavedWork(),true); });
await flush(() => root.unmount()); assert.equal(getDirtyUnsavedWork().length,0); assert.deepEqual(browserErrors,[]);
// The real HTTP adapter carries the bound version and provided intent key for all six commands.
const { FetchHttpClient } = await import('@/platform/api/client/FetchHttpClient');
const { CommercialApiClient } = await import('@/platform/api/generated/commercialApi');
const { ContactHttpCommandAdapter } = await import('@/modules/contacts/infrastructure/http/ContactHttpCommandAdapter');
const { validateOpenApiRequest } = await import('@/platform/api/contracts/openApiRuntimeValidation');
const operations = ['createContactCustomerRelationship','updateContactCustomerRelationship','endContactCustomerRelationship','createContactOrganizationRelationship','updateContactOrganizationRelationship','endContactOrganizationRelationship'];
let transportCount = 0;
const adapter = new ContactHttpCommandAdapter(new CommercialApiClient(new FetchHttpClient({
  baseUrl:'http://contact-relationship-parity.test', accessTokenProvider:{ getAccessToken:() => 'fixture' },
  workspaceIdProvider:{ getWorkspaceId:() => workspace.getWorkspaceContextSnapshot().workspaceId },
  fetchImplementation:async (url, init) => {
    assert.ok(String(url).includes(`/contacts/${A.id}/`));
    assert.equal(new Headers(init?.headers).get('If-Match'),'"3"');
    assert.equal(new Headers(init?.headers).get('Idempotency-Key'),`relationship-http-intent-${transportCount}`);
    const operation = operations[transportCount]; assert.ok(operation);
    assert.equal(validateOpenApiRequest(operation,JSON.parse(String(init?.body))).valid,true); transportCount++;
    const now='2026-01-01T00:00:00Z';
    return new Response(JSON.stringify({ commandId:'fixture-command', correlationId:'fixture-correlation', aggregateId:A.id, aggregateType:'CONTACT', version:4, occurredAt:now, outcome:'COMMITTED', warnings:[], emittedEventIds:[], auditEvidenceIds:[],
      result:{ contact:{ id:A.id, workspaceId:workspace.getWorkspaceContextSnapshot().workspaceId, fullName:A.fullName, status:'active', version:4, createdAt:now, updatedAt:now } } }), { status:200, headers:{ 'Content-Type':'application/json' } });
  },
})));
const httpCommands = [
  () => adapter.createCustomerRelationship({ contactId:A.id, expectedVersion:3, customerId:'customer-2', role:'other' }, { idempotencyKey:`relationship-http-intent-${transportCount}` }),
  () => adapter.updateCustomerRelationship({ contactId:A.id, expectedVersion:3, relationshipId:'customer-rel', role:'billing' }, { idempotencyKey:`relationship-http-intent-${transportCount}` }),
  () => adapter.endCustomerRelationship({ contactId:A.id, expectedVersion:3, relationshipId:'customer-rel', endedReason:'A reason' }, { idempotencyKey:`relationship-http-intent-${transportCount}` }),
  () => adapter.createOrganizationRelationship({ contactId:A.id, expectedVersion:3, organizationId:'org-2', role:'employee', isPrimaryAffiliation:false, effectiveFrom:'2026-01-01T00:00:00Z' }, { idempotencyKey:`relationship-http-intent-${transportCount}` }),
  () => adapter.updateOrganizationRelationship({ contactId:A.id, expectedVersion:3, relationshipId:'org-rel', role:'buyer', isPrimaryAffiliation:false }, { idempotencyKey:`relationship-http-intent-${transportCount}` }),
  () => adapter.endOrganizationRelationship({ contactId:A.id, expectedVersion:3, relationshipId:'org-rel', endedReason:'A reason' }, { idempotencyKey:`relationship-http-intent-${transportCount}` }),
];
for (const command of httpCommands) assert.equal((await command()).id,A.id);
assert.equal(transportCount,6);
console.log('Contact relationships PASS: real Customer/Organization create/edit/end commands, stable cycle idempotency and retry, all six real HTTP transport bodies/version/intent headers, shared clean/dirty exclusivity, stale save/completion refusal, opening workspace snapshot/refusal and scoped error focus, target/version snapshot, dirty/revert, refresh, local keep/discard, pending global veto, duplicate confirm, failure retry, clean target switch and fresh reopen.');
