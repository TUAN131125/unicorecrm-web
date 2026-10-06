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



const { ContactActiveTasksTab } = await import('@/modules/contacts/presentation/detail/tabs/ContactActiveTasksTab');
const { configureTaskApplication, getTaskApplicationServices } = await import('@/modules/tasks/application/composition/taskApplicationServices');
const { rescheduleTaskCommand } = await import('@/modules/tasks');
const { getDirtyUnsavedWork, discardDirtyUnsavedWork } = await import('@/platform/unsaved-work');
const { acquireContactInteraction, releaseContactInteraction, getContactInteractionSnapshot } = await import('@/modules/contacts/presentation/model/contactInteractionOwnership');
type Contact = import('@/modules/contacts').Contact;
type Task = import('@/modules/tasks').Task;
const today = new Date(); today.setHours(0,0,0,0);
function dateKey(value:Date) { const local=new Date(value.getTime()-value.getTimezoneOffset()*60_000); return local.toISOString().slice(0,10); }
const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
const A:Contact={id:'inline-contact-A',fullName:'A',name:'A',status:'active',createdAt:'2026-01-01',resourceVersion:3};
const B:Contact={...A,id:'inline-contact-B',fullName:'B',name:'B',resourceVersion:9};
const taskA:Task={id:'inline-task-A',title:'A task',status:'OPEN',priority:'NORMAL',assigneeId:'u1',dueAt:`${dateKey(today)}T10:00:00Z`,createdAt:'2026-01-01',updatedAt:'2026-01-01',resourceVersion:7};
const taskB:Task={...taskA,id:'inline-task-B',title:'B task',resourceVersion:11};
const calls:Array<{id:string;dueAt:string;expectedVersion:number;idempotencyKey:string}>=[];
let release:(()=>void)|undefined; let fail=false; let unavailable=false;
const services=getTaskApplicationServices();
configureTaskApplication({...services,api:{...services.api,commands:{...services.api.commands,async rescheduleTask(id,input,options){
  calls.push({id,dueAt:input.dueAt,expectedVersion:options.expectedVersion,idempotencyKey:options.idempotencyKey}); await new Promise<void>(resolve=>{release=resolve;});
  if(fail) throw new Error('INLINE_RESCHEDULE_FAILED');
  const task=id===taskA.id?taskA:taskB;
  return {task:{...task,dueAt:input.dueAt},evidence:{authority:'test',commandId:'command',correlationId:'correlation',aggregateId:id,aggregateType:'TASK',version:options.expectedVersion+1,occurredAt:'2026-01-01',outcome:'COMMITTED',warnings:[],emittedEventIds:[],auditEvidenceIds:[]}};
}}}});
let contact=A; let task=taskA; const notifications:boolean[]=[];
const container=document.getElementById('root');assert.ok(container);const root=createRoot(container);
function render(){const openingTask=task; root.render(React.createElement(I18nProvider,null,React.createElement(ContactActiveTasksTab,{contact,tasks:[{id:task.id,title:task.title,status:'pending',priority:'MEDIUM',assignee:'Owner',dueDate:task.dueAt.slice(0,10)}],onCreateTask(){},onScheduleMeeting(){},onOpenModule(){},onCompleteTask(){},onModalStateChange(open){notifications.push(open);},onRescheduleTask:async(id,date,options)=>{if(unavailable)return false;await rescheduleTaskCommand(id,{dueAt:`${date}T10:00:00Z`,actorId:'u1',actorName:'Owner'},{expectedVersion:openingTask.resourceVersion,idempotencyKey:options?.idempotencyKey});return true;}})));}
async function flush(action:()=>void=()=>{}){await act(async()=>{action();await new Promise(resolve=>setTimeout(resolve,25));});}
function button(label:string){const found=[...document.querySelectorAll('button')].find(item=>item.textContent?.trim()===label);assert.ok(found,`Missing ${label}`);return found;}
async function click(label:string){await flush(()=>button(label).click());}
async function chooseDate(value:Date){const control=document.getElementById('contact-task-reschedule-date');assert.ok(control);await flush(()=>control.click());await click('Hiện tại');const label=new Intl.DateTimeFormat('vi-VN',{dateStyle:'full'}).format(value);const day=document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);assert.ok(day);await flush(()=>day.click());await click('Áp dụng');}
async function submit(){await flush(()=>document.querySelector('form')?.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));}
await flush(render);
const otherOwner=Symbol('profile');assert.equal(acquireContactInteraction(otherOwner,A),true);await click('Đổi lịch');assert.equal(document.querySelector('form'),null);releaseContactInteraction(otherOwner);
await click('Đổi lịch');assert.equal(getContactInteractionSnapshot()?.contact?.id,A.id);
await chooseDate(tomorrow);assert.equal(getDirtyUnsavedWork().length,1);await chooseDate(today);assert.equal(getDirtyUnsavedWork().length,0);
await chooseDate(tomorrow);contact={...A,resourceVersion:4};task={...taskA,dueAt:`${dateKey(today)}T12:00:00Z`};await flush(render);assert.equal(document.querySelector('form')?.getAttribute('data-task-target-id'),taskA.id);
contact=B;task=taskB;await flush(render);assert.equal(document.querySelector('form')?.getAttribute('data-contact-target-id'),A.id);
await click('Hủy');await click('Tiếp tục chỉnh sửa');assert.ok(document.querySelector('form'));
const entry=getDirtyUnsavedWork()[0];assert.ok(entry);fail=true;
await flush(()=>{const form=document.querySelector('form');assert.ok(form);form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));});
assert.equal(calls.length,1);assert.equal(calls[0]?.id,taskA.id);assert.equal(calls[0]?.expectedVersion,7);assert.ok(calls[0]?.idempotencyKey.startsWith('contact-task-reschedule-'));assert.equal(calls[0]?.dueAt,`${dateKey(tomorrow)}T10:00:00Z`);
assert.equal(discardDirtyUnsavedWork(),false);assert.equal(await entry.save(),false);assert.ok(document.querySelector('form'));
assert.ok(release);await flush(release);assert.ok(document.querySelector('[role="alert"]'));assert.equal(document.activeElement?.id,'contact-task-reschedule-date');
fail=false;await submit();assert.ok(release);await flush(release);assert.equal(calls[1]?.idempotencyKey,calls[0]?.idempotencyKey);assert.equal(document.querySelector('form'),null);assert.equal(getDirtyUnsavedWork().length,0);
await click('Đổi lịch');await chooseDate(tomorrow);const before=calls.length;assert.equal(await entry.save(),false);assert.equal(calls.length,before);
unavailable=true;await submit();assert.ok(document.querySelector('form'));assert.ok(document.querySelector('[role="alert"]'));assert.equal(calls.length,before);unavailable=false;
await click('Hủy');await click('Bỏ thay đổi');assert.equal(document.querySelector('form'),null);assert.equal(getDirtyUnsavedWork().length,0);
await click('Đổi lịch');contact=A;task=taskA;await flush(render);assert.equal(document.querySelector('form'),null,'clean target change closes');
await click('Đổi lịch');const control=document.getElementById('contact-task-reschedule-date');assert.ok(control);await flush(()=>control.click());await click('Xóa');await submit();assert.equal(calls.length,before);assert.equal(document.activeElement?.id,'contact-task-reschedule-date');
await chooseDate(tomorrow);let saved:Promise<boolean>|undefined;const pendingEntry=getDirtyUnsavedWork()[0];assert.ok(pendingEntry);await flush(()=>{saved=pendingEntry.save();});assert.ok(saved);assert.ok(release);
await flush(()=>root.render(React.createElement('p',null,'Replacement')));contact=B;task=taskB;await flush(render);await click('Đổi lịch');await chooseDate(tomorrow);
let result:boolean|undefined;await act(async()=>{release?.();result=await saved;});assert.equal(result,false);assert.equal(document.querySelector('form')?.getAttribute('data-contact-target-id'),B.id);
await flush(()=>{assert.equal(discardDirtyUnsavedWork(),true);});await flush(()=>root.unmount());assert.equal(getDirtyUnsavedWork().length,0);assert.deepEqual(browserErrors,[]);assert.ok(notifications.includes(true)&&notifications.includes(false));
console.log('Contact inline Task reschedule PASS: real component/public Task command, stable retry idempotency, opening callback/task/version/contact, dirty/revert, refresh, target switch, local keep/discard, registry/save/pending veto, duplicate/failure/retry, invalid date focus, unavailable false, stale completion and shared ownership.');
