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



const { OrganizationCreateModal } = await import("@/modules/organizations/presentation/list/OrganizationCreateModal");
const { OrganizationEditModal } = await import("@/modules/organizations/presentation/detail/OrganizationEditModal");
const { ExistingCustomerOnboardingModal } = await import("@/modules/customers/presentation/list/ExistingCustomerOnboardingModal");
const { OrganizationAccountFormModal } = await import("@/modules/organizations/presentation/components/OrganizationAccountFormModal");
const { CustomerEditModal, createCustomerEditDraft } = await import("@/modules/customers/presentation/detail/CustomerEditModal");
const { buildCustomer360ReadModel } = await import("@/modules/customers/presentation/model/customer360ReadModel");
const { getCustomersSnapshot } = await import("@/modules/customers");
const { getOrganizationAccountsSnapshot } = await import("@/modules/organizations");
const { getDirtyUnsavedWork, discardDirtyUnsavedWork, saveDirtyUnsavedWork } = await import("@/platform/unsaved-work");
const { ApplicationError } = await import("@/shared/domain");
const { createMemoryRouter, RouterProvider } = await import("react-router-dom");
const { AppShell } = await import("@/app/shell/layout/AppShell");
const accountSeed = getOrganizationAccountsSnapshot()[0]; assert.ok(accountSeed);
const customerSeed = getCustomersSnapshot()[0]; assert.ok(customerSeed);
let account = { ...accountSeed, id: "org-A", displayName: "Organization A", resourceVersion: 3 };
let model = buildCustomer360ReadModel({ ...customerSeed, id: "customer-A", resourceVersion: 4 });
let createWrapperMode=false;
let wrapperMode = false; let onboardingMode = false;
let open = true; let customerMode = false; let refresh = () => {}; let held: (() => void) | undefined;
let hold = false; let fail = false;
const calls: { id: string; version: number | undefined; value: string }[] = [];
function close() { open = false; refresh(); }
function Probe() {
  const [, update] = React.useReducer(value => value + 1, 0); refresh = update;
  if (createWrapperMode) return React.createElement(OrganizationCreateModal, {isOpen:open,onClose:close,actorId:"u1",onCreated:()=>{}});
  if (wrapperMode) return React.createElement(OrganizationEditModal, { isOpen: open, account, representatives: [], actorId: "u1", onClose: close, onSaved: () => {} });
  if (onboardingMode) return React.createElement(ExistingCustomerOnboardingModal, { isOpen: open, actorId: "u1", isVi: true, onClose: close, onCompleted: () => {} });
  if (customerMode) return React.createElement(CustomerEditModal, { isOpen: open, model, isVi: true, customerFieldsOnly: true, onClose: close,
    onSave: async (draft, opening) => { calls.push({ id: opening.customer.id, version: opening.customer.resourceVersion, value: draft.segment });
      if (hold) await new Promise<void>(resolve => { held = resolve; });
      if (fail) throw new ApplicationError({ code: "TEST_FIELD", category: "VALIDATION", message: "private", fieldErrors: { segment: ["private"] } });
    } });
  return React.createElement(OrganizationAccountFormModal, { isOpen: open, mode: "edit", account, connected: true, onClose: close,
    onSubmit: async (draft, opening) => { assert.ok(opening); calls.push({ id: opening.id, version: opening.resourceVersion, value: draft.displayName });
      if (hold) await new Promise<void>(resolve => { held = resolve; });
      if (fail) throw new ApplicationError({ code: "TEST_FIELD", category: "VALIDATION", message: "private", fieldErrors: { displayName: ["private"] } });
    } });
}
const openingWorkspace=workspace.getWorkspaceContextSnapshot();
const start=`/w/${openingWorkspace.workspaceKey}/crm/organizations`;
const destination=`/w/${openingWorkspace.workspaceKey}/crm/leads`;
const router=createMemoryRouter([{path:'/w/:workspaceKey/crm/*',element:React.createElement(I18nProvider,null,
  React.createElement(PlatformStateProvider,null,React.createElement(GuidanceProvider,null,React.createElement(AppShell,{children:React.createElement(Routes,null,
    React.createElement(Route,{path:'organizations',element:React.createElement(Probe)}),React.createElement(Route,{path:'leads',element:React.createElement('p',{id:'destination'},'Leads')}) )}))))}],{initialEntries:[start]});
const rootElement = document.getElementById("root"); assert.ok(rootElement); const root = createRoot(rootElement);
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 120)); }); }
async function render() { await act(async () => { root.render(React.createElement(RouterProvider,{router})); refresh(); }); await settle(); }
async function click(text:string) { const button=Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(item=>item.textContent?.trim()===text);assert.ok(button,text);await act(async()=>button.click());await settle(); }
async function change(selector: string, value: string) {
 const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector); assert.ok(input, selector);
 await act(async () => { Object.getOwnPropertyDescriptor(input instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype, "value")?.set?.call(input, value); input.dispatchEvent(new window.Event("input", { bubbles: true })); }); await settle();
}
async function submit(times = 1) { const form = document.querySelector("form"); assert.ok(form);
 await act(async () => { for (let i=0;i<times;i++) form.dispatchEvent(new window.Event("submit", { bubbles:true, cancelable:true })); }); await settle(); }
await render();
assert.equal(getDirtyUnsavedWork().length, 0);
await change("#organization-edit-displayName", "Organization draft A");
assert.equal(getDirtyUnsavedWork().length, 1);
const staleOrganizationEntry=getDirtyUnsavedWork()[0];assert.ok(staleOrganizationEntry);
await change("#organization-edit-displayName", "Organization A"); assert.equal(getDirtyUnsavedWork().length, 0);
await change("#organization-edit-displayName", "Organization draft A");
account = { ...account, displayName: "Refreshed A", resourceVersion: 7 }; await render();
assert.equal(document.querySelector<HTMLInputElement>("#organization-edit-displayName")?.value, "Organization draft A");
account = { ...account, id: "org-B", displayName: "Organization B", resourceVersion: 9 }; await render();
assert.equal(document.querySelector("form")?.getAttribute("data-organization-target-id"), "org-A");
hold = true; fail = true; await submit(2); assert.equal(calls.length, 1); assert.deepEqual(calls[0], { id: "org-A", version: 3, value: "Organization draft A" });
assert.equal(discardDirtyUnsavedWork(), false);
assert.equal(await saveDirtyUnsavedWork(), false);
const nextWorkspace=workspace.listWorkspaceMemberships().find(item=>item.status==='active' && item.workspaceKey!==openingWorkspace.workspaceKey);assert.ok(nextWorkspace);
const workspaceButton=Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(button=>button.title.startsWith('Không gian làm việc:') || button.title.startsWith('Workspace:'));assert.ok(workspaceButton);
await act(async()=>workspaceButton.click());await settle();await click(nextWorkspace.name);await click('Bỏ thay đổi');
assert.equal(workspace.getWorkspaceContextSnapshot().workspaceKey,openingWorkspace.workspaceKey);assert.equal(router.state.location.pathname,start);
assert.equal(document.querySelector('form')?.getAttribute('data-organization-target-id'),'org-A');assert.equal(calls.length,1);
await act(async()=>{void router.navigate(destination);});await settle();await click('Bỏ thay đổi');assert.equal(router.state.location.pathname,start);

await act(async () => held?.()); await settle();
assert.equal(document.activeElement?.id, "organization-edit-displayName"); assert.ok(document.querySelector('[role="alert"]'));
assert.equal(document.querySelector<HTMLInputElement>("#organization-edit-displayName")?.value, "Organization draft A");
await act(async () => { assert.equal(discardDirtyUnsavedWork(), true); }); await settle(); assert.equal(open, false);
open=true; hold=false; fail=false; await render(); assert.equal(document.querySelector<HTMLInputElement>("#organization-edit-displayName")?.value, "Organization B");
assert.equal(await staleOrganizationEntry.save(),false);assert.equal(calls.length,1);
// Clean switch follows B -> C, while same-id refresh remains an opening snapshot.
account={...account,id:"org-C",displayName:"Organization C"}; await render(); assert.equal(document.querySelector<HTMLInputElement>("#organization-edit-displayName")?.value,"Organization C");
open=false; await render(); customerMode=true; open=true; await render();
const segmentSelector='[data-customer-field="segment"]';
const initialSegment=createCustomerEditDraft(model).segment;
await change(segmentSelector,"Customer draft A"); assert.equal(getDirtyUnsavedWork().length,1);
await change(segmentSelector,initialSegment); assert.equal(getDirtyUnsavedWork().length,0);
await change(segmentSelector,"Customer draft A");
model={...model,customer:{...model.customer,resourceVersion:8}}; await render();
model={...model,customer:{...model.customer,id:"customer-B",resourceVersion:10}}; await render();
assert.equal(document.querySelector('form')?.getAttribute('data-customer-target-id'),"customer-A");
hold=true; fail=true; await submit(2); assert.equal(calls.length,2); assert.deepEqual(calls[1],{id:"customer-A",version:4,value:"Customer draft A"});
assert.equal(discardDirtyUnsavedWork(),false);
await act(async()=>held?.()); await settle();
assert.equal(document.querySelector<HTMLInputElement>(segmentSelector)?.value,"Customer draft A");
assert.equal(document.activeElement?.getAttribute('data-customer-field'),"segment");
await act(async()=>{assert.equal(discardDirtyUnsavedWork(),true);}); await settle();
open=true;hold=false;fail=false;await render();assert.equal(document.querySelector('form')?.getAttribute('data-customer-target-id'),"customer-B");
assert.equal(getDirtyUnsavedWork().length,0);
// Programmatic save is truthful and owns successful close after persistence.
await change(segmentSelector,"Saved Customer B"); let saved=false;
await act(async()=>{ saved=await saveDirtyUnsavedWork(); }); await settle();assert.equal(saved,true);assert.equal(open,false);
// A late result cannot reset a forcibly replaced opening cycle (normal navigation is protected by veto).
open=true;model={...model,customer:{...model.customer,id:"customer-late-A",resourceVersion:20}};await render();
await change(segmentSelector,"Pending A");hold=true;await submit();
open=false;await render();open=true;model={...model,customer:{...model.customer,id:"customer-late-B",segment:"Fresh B",resourceVersion:21}};await render();
await change(segmentSelector,"Independent B draft");await act(async()=>held?.());await settle();
assert.equal(open,true);assert.equal(document.querySelector('form')?.getAttribute('data-customer-target-id'),"customer-late-B");
assert.equal(document.querySelector<HTMLInputElement>(segmentSelector)?.value,"Independent B draft");
await act(async()=>{assert.equal(discardDirtyUnsavedWork(),true);});await settle();
// Intercept the actual Organization public API command port, proving the wrapper sends the opening version.
open=false; await render(); customerMode=false; wrapperMode=true;
const organizationServices = await import("@/modules/organizations/application/composition/organizationApplicationServices");
const services = organizationServices.getOrganizationApplicationServices();
const commands = services.api.commands;
const actualUpdates: import("@/modules/organizations/application/ports/OrganizationApiRuntime").OrganizationUpdateCommand[] = [];
organizationServices.configureOrganizationApplication({ ...services, api: { ...services.api, mode: "connected", commands: { create: async () => { throw new Error("Unexpected create"); }, archive: async () => { throw new Error("Unexpected archive"); }, ...commands, update: async input => { actualUpdates.push(input); if (hold) await new Promise<void>(resolve => { held=resolve; }); throw new ApplicationError({code:"TEST_UPDATE_FAILURE",category:"CONFLICT",message:"private"}); } } } });
account={...account,id:"org-port-A",displayName:"Port A",legalName:"Old legal",notes:"Old notes",resourceVersion:11};open=true;await render();
await change("#organization-edit-legalName","");await change("#organization-edit-notes","");
await change("#organization-edit-displayName","Bound public command");account={...account,id:"org-port-B",resourceVersion:19};await render();hold=true;await submit(2);
assert.equal(actualUpdates[0]?.legalName,"");assert.equal(actualUpdates[0]?.notes,"");assert.equal(actualUpdates.length,1);assert.equal(actualUpdates[0]?.organizationId,"org-port-A");assert.equal(actualUpdates[0]?.expectedVersion,11);assert.equal(discardDirtyUnsavedWork(),false);
await act(async()=>held?.());await settle();assert.equal(open,true);assert.ok(document.body.textContent?.includes("Bản ghi đã được cập nhật"));await act(async()=>{assert.equal(discardDirtyUnsavedWork(),true);});await settle();assert.equal(open,false);
// Connected Organization create is the actual public command, with unsupported representative inputs absent.
open=false;await render();wrapperMode=false;createWrapperMode=true;hold=true;open=true;
const organizationCreateKeys:(string | undefined)[]=[];
const actualCreates:import("@/modules/organizations/application/ports/OrganizationApiRuntime").OrganizationCreateCommand[]=[];
organizationServices.configureOrganizationApplication({...services,api:{...services.api,mode:"connected",commands:{
create:async (input,options)=>{actualCreates.push(input);organizationCreateKeys.push(options?.idempotencyKey);await new Promise<void>(resolve=>{held=resolve;});throw new ApplicationError({code:"TEST_CREATE_ORG",category:"NETWORK",message:"private"});},
update:async()=>{throw new Error("Unexpected update");},archive:async()=>{throw new Error("Unexpected archive");}}}});
await render();assert.equal(document.getElementById('organization-create-representativeName'),null);
await change('#organization-create-displayName','Created Organization');await submit(2);assert.equal(actualCreates.length,1);assert.equal(actualCreates[0]?.displayName,'Created Organization');
assert.equal('representativeName' in (actualCreates[0] ?? {}),false);assert.equal(discardDirtyUnsavedWork(),false);
await act(async()=>held?.());await settle();assert.equal(open,true);assert.equal(document.querySelector<HTMLInputElement>('#organization-create-displayName')?.value,'Created Organization');
await submit();assert.equal(actualCreates.length,2);assert.ok(organizationCreateKeys[0]);assert.equal(organizationCreateKeys[0],organizationCreateKeys[1]);await act(async()=>held?.());await settle();
await act(async()=>{assert.equal(discardDirtyUnsavedWork(),true);});await settle();open=true;await render();assert.equal(document.querySelector<HTMLInputElement>('#organization-create-displayName')?.value,'');
open=false;await render();createWrapperMode=false;
organizationServices.configureOrganizationApplication(services);
// Onboarding uses the real createCustomerCommand and cannot retarget its submitted source.
wrapperMode=false;onboardingMode=true;hold=false;open=true;await render();
const customerServices=await import("@/modules/customers/application/composition/customerApplicationServices");const cs=customerServices.getCustomerApplicationServices();
const createKeys: string[]=[];
const createdSources: import("@/modules/customers/application/ports/CustomerApiRuntime").CreateCustomerRequest[]=[];
customerServices.configureCustomerApplication({...cs,api:{...cs.api,commands:{...cs.api.commands,create:async (input,options)=>{createdSources.push(input);createKeys.push(options.idempotencyKey);await new Promise<void>(resolve=>{held=resolve;});throw new ApplicationError({code:"TEST_CREATE_FAILURE",category:"VALIDATION",message:"private"});}}}});
const source=document.getElementById('customer-onboarding-source');assert.ok(source);
await act(async()=>source.click());await settle();
const choices=Array.from(document.querySelectorAll<HTMLButtonElement>('[role="listbox"] button'));
const sourceChoice=choices.find(option => option.textContent?.trim() && !option.textContent.includes('Chọn bản ghi'));assert.ok(sourceChoice);
await act(async()=>sourceChoice.click());await settle();
assert.equal(getDirtyUnsavedWork().length,1);await submit(2);assert.equal(createdSources.length,1);const sourceId=createdSources[0]?.relationshipRef.id;assert.ok(sourceId);assert.equal(discardDirtyUnsavedWork(),false);
await act(async()=>held?.());await settle();assert.equal(open,true);assert.ok(document.getElementById("customer-onboarding-source")?.textContent?.trim());
await submit();assert.equal(createdSources.length,2);assert.equal(createKeys[0],createKeys[1]);await act(async()=>held?.());await settle();
assert.ok(document.body.textContent?.includes('Hãy kiểm tra'));assert.equal(document.body.textContent?.includes('private'),false);
await act(async()=>{assert.equal(discardDirtyUnsavedWork(),true);});await settle();
open=true;await render();assert.ok(document.getElementById("customer-onboarding-source")?.textContent?.includes("Chọn bản ghi"));assert.equal(getDirtyUnsavedWork().length,0);
customerServices.configureCustomerApplication(cs);
onboardingMode=false;customerMode=true;open=true;hold=false;fail=false;await render();await change(segmentSelector,'Route-protected Customer B');
const unload=new window.Event('beforeunload',{cancelable:true});window.dispatchEvent(unload);assert.equal(unload.defaultPrevented,true);
await act(async()=>{void router.navigate(destination);});await settle();await click('Tiếp tục chỉnh sửa');assert.equal(router.state.location.pathname,start);assert.equal(document.querySelector<HTMLInputElement>(segmentSelector)?.value,'Route-protected Customer B');
await act(async()=>{void router.navigate(destination);});await settle();await click('Bỏ thay đổi');assert.equal(router.state.location.pathname,destination);assert.equal(getDirtyUnsavedWork().length,0);
await act(async()=>root.unmount()); assert.equal(getDirtyUnsavedWork().length,0); assert.deepEqual(browserErrors,[]);router.dispose();
console.log("Organization/Customer real forms PASS: opening ID/version, same-target refresh, clean/dirty switch, dirty/revert, pending atomic veto, duplicate submit, error/focus, discard/reopen.");

// Real HTTP adapter/client: empty string intent survives transport; no null-clear semantics inferred.
const { FetchHttpClient } = await import("@/platform/api/client/FetchHttpClient");
const { CommercialApiClient } = await import("@/platform/api/generated/commercialApi");
const { OrganizationHttpCommandAdapter } = await import("@/modules/organizations/infrastructure/http/OrganizationHttpCommandAdapter");
const { validateOpenApiRequest } = await import("@/platform/api/contracts/openApiRuntimeValidation");
const emptyFields = { legalName:"", taxCode:"", industry:"", sizeBand:"", website:"", domain:"", phone:"", address:"", source:"", notes:"" };
const transmitted: unknown[] = [];
const httpAdapter = new OrganizationHttpCommandAdapter(new CommercialApiClient(new FetchHttpClient({
 baseUrl:"http://organization-parity.test", accessTokenProvider:{getAccessToken:()=>"fixture"}, workspaceIdProvider:{getWorkspaceId:()=>workspace.getWorkspaceContextSnapshot().workspaceId},
 fetchImplementation:async (url,init)=>{
  const create=init?.method==="POST";
  assert.equal(String(url),create?"http://organization-parity.test/organizations":"http://organization-parity.test/organizations/org-http");
  assert.equal(new Headers(init?.headers).get("Idempotency-Key"),"org-intent-stable");
  if(!create) assert.equal(new Headers(init?.headers).get("If-Match"),'"3"');
  const body:unknown=JSON.parse(String(init?.body));transmitted.push(body);
  assert.equal(validateOpenApiRequest(create?"createOrganization":"updateOrganization",body).valid,true);
  const now="2026-07-01T00:00:00Z";
  return new Response(JSON.stringify({commandId:"fixture",correlationId:"fixture-correlation",aggregateId:"org-http",aggregateType:"ORGANIZATION",version:4,occurredAt:now,outcome:"COMMITTED",warnings:[],emittedEventIds:[],auditEvidenceIds:[],result:{id:"org-http",workspaceId:workspace.getWorkspaceContextSnapshot().workspaceId,displayName:"HTTP Org",status:"active",version:4,createdAt:now,updatedAt:now}}),{status:200,headers:{"Content-Type":"application/json"}});
 }
})));
await httpAdapter.create({displayName:"HTTP Org"},{idempotencyKey:"org-intent-stable"});
await httpAdapter.update({organizationId:"org-http",expectedVersion:3,...emptyFields},{idempotencyKey:"org-intent-stable"});
assert.deepEqual(transmitted[1],emptyFields);
assert.equal(validateOpenApiRequest("updateOrganization",{email:""}).valid,false);
assert.equal(validateOpenApiRequest("updateOrganization",{displayName:""}).valid,false);
console.log("Organization real HTTP PASS: stable create/update keys, opening version header, allowed empty body values preserved, invalid email/displayName rejected.");
