import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import type { Task } from "@/modules/tasks";

import type { Lead } from "@/modules/leads";


const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost", pretendToBeVisual: true });
const { window } = dom;
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

const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { signIn } = await import("@/platform/identity-auth");
assert.equal(signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok, true);
const { initializeApplicationComposition } = await import("@/app/composition");
await initializeApplicationComposition({ mode: "demo" });
const ac = await import("@/platform/access-control");
const ws = await import("@/platform/workspace-context");
await ac.loadAccessGovernance(ws.getWorkspaceContextSnapshot().workspaceId);
const binding = ac.getAccessGovernanceRuntimeBinding();
const baselineAccess = ac.resolveEffectiveAccess();
const initialWorkspaceId = ws.getWorkspaceContextSnapshot().workspaceId;
const listeners = new Set<() => void>();
const initialAccount = baselineAccess.accountId;
let ownerRestricted = false;
let ownerDisplay = "Authorized owner";
let actor = initialAccount, revision = 1, canRead = true, scope = "WORKSPACE", restrictive = false;
ac.configureAccessGovernanceRuntime({ ...binding,
  getState: () => ({ ...binding.getState(), workspaceId: binding.getState().workspaceId ?? initialWorkspaceId, authorityRevision: revision }),
  getEffectiveAccess: () => ({ ...baselineAccess, accountId: actor, can: capability => capability !== ac.CAPABILITIES.TASKS_READ || canRead,
    getDataScope: () => scope === "OWN" ? "OWN" : "WORKSPACE", getFieldAccess: (resource,field) => ownerRestricted && resource === "contacts" && field === "ownerId" ? "HIDDEN" : restrictive ? "HIDDEN" : "READ_WRITE" }),
  subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
});
const { ApplicationError } = await import("@/shared/domain");
const { configureTaskApplication, getTaskApplicationServices } = await import("@/modules/tasks/application/composition/taskApplicationServices");
const original = getTaskApplicationServices();
const { I18nProvider } = await import("@/i18n");
const { ContactRelationshipPanel } = await import("@/modules/contacts/presentation/detail/ContactRelationshipPanel");
const { useContactTasksQuery } = await import("@/modules/contacts/presentation/hooks/useContactTasksQuery");
const at = "2026-10-18T10:15:31Z";
const contact: import("@/modules/contacts").Contact = { id:"panel-contact",name:"Authorized Contact",fullName:"Authorized Contact",createdAt:at,status:"active",email:"contact@example.invalid" };
const task: Task = { id:"task-a",title:"Real overdue task",status:"OPEN",priority:"NORMAL",assigneeId:"member",dueAt:"2020-01-01T08:20:00Z",createdAt:at,updatedAt:at,recordRef:{moduleKey:"contacts",recordId:contact.id} };
let taskMode = "data", taskHasMore = false;
let recordId = contact.id;
let releaseTask: ((page: import("@/shared/application").AuthoritativePage<Task>) => void) | undefined;
const taskRequests: import("@/modules/tasks").TaskListQuery[] = [];
configureTaskApplication({ ...original, api:{...original.api,mode:"connected",queries:{...original.api.queries,
 async list(query = {}) { taskRequests.push(query); if(taskMode === "delay") return new Promise<import("@/shared/application").AuthoritativePage<Task>>(resolve => { releaseTask = resolve; }); if(taskMode === "error") throw new ApplicationError({code:"NETWORK_ERROR",message:"SECRET",category:"NETWORK"});return {items:taskMode === "empty" ? [] : [query.cursor ? {...task,id:"task-b",title:"Second task"} : task,{...task,id:"foreign",title:"FOREIGN-CANARY",recordRef:{moduleKey:"leads",recordId:contact.id}}],loadedAt:at,authority:"backend",pageInfo:{hasNextPage:taskHasMore && !query.cursor,...(taskHasMore && !query.cursor ? {nextCursor:"task-continuation"} : {})}}; },
 async listActivities() { return {items:[],loadedAt:at,authority:"backend",pageInfo:{hasNextPage:false}}; }
} }});
const calls: string[] = [];
let visible = true;
function Fixture() { const query = useContactTasksQuery(recordId); return React.createElement(ContactRelationshipPanel,{contact:{...contact,id:recordId},locale:"vi",ownerName:ownerDisplay,isVisible:visible,taskQuery:query,tasks:query.items,onOpenTask:id=>calls.push(id),onQuickAction:action=>calls.push(action)}); }
const container = document.getElementById("root");assert.ok(container);const root=createRoot(container);
const render = async()=>act(async()=>root.render(React.createElement(I18nProvider,null,React.createElement(Fixture))));
const click = async(label:string)=>act(async()=>{const b=Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(x=>(x.textContent?.trim()===label || x.getAttribute("aria-label")===label));assert.ok(b,label);b.click();});
try {
 await render();assert.match(container.textContent ?? "",/Công việc Contact/);assert.match(container.textContent ?? "",/Real overdue task/);assert.doesNotMatch(container.textContent ?? "",/FOREIGN-CANARY/);assert.equal(taskRequests[0]?.filters?.recordId,contact.id);
 assert.equal(container.querySelector('[aria-label="Thu gọn bảng quan hệ"]'),null);
 assert.match(container.textContent??"",/Chưa phân công/);
 contact.ownerId="owner-member";ownerDisplay="—";await render();assert.match(container.textContent??"",/Chưa xác định người phụ trách/);
 ownerDisplay="Authorized owner";await render();assert.match(container.querySelector('[data-work-owner]')?.textContent??"",/Authorized owner/);
 await act(async()=>{ownerRestricted=true;revision++;listeners.forEach(fn=>fn());});assert.match(container.textContent??"",/Không có quyền xem người phụ trách/);assert.doesNotMatch(container.querySelector('[data-work-owner]')?.textContent??"",/Authorized owner/);
 await act(async()=>{ownerRestricted=false;revision++;listeners.forEach(fn=>fn());});
 const nextTaskButton=container.querySelector<HTMLButtonElement>('[data-work-task="next"] button');assert.ok(nextTaskButton);await act(async()=>nextTaskButton.click());assert.equal(calls.pop(),task.id);


 await act(async()=>{taskHasMore=true;revision++;listeners.forEach(fn=>fn());});const beforeMore=taskRequests.length;
 assert.match(container.textContent??"",/chưa phải toàn bộ/);await click("Tải thêm công việc");assert.equal(taskRequests.length,beforeMore+1);assert.equal(taskRequests.at(-1)?.cursor,"task-continuation");assert.equal(taskRequests.at(-1)?.filters?.recordModuleKey,"contacts");assert.match(container.textContent??"",/Real overdue task/);
 await act(async()=>{taskHasMore=false;taskMode="delay";revision++;listeners.forEach(fn=>fn());});const lateTask=releaseTask;assert.ok(lateTask);assert.match(container.textContent??"",/Đang tải công việc/);
 await act(async()=>{actor="B";listeners.forEach(fn=>fn());});await act(async()=>{actor=initialAccount;taskMode="data";listeners.forEach(fn=>fn());});await act(async()=>lateTask({items:[{...task,title:"OLD-TASK-PRINCIPAL"}],authority:"backend",loadedAt:at,pageInfo:{hasNextPage:false}}));assert.doesNotMatch(container.textContent??"",/OLD-TASK-PRINCIPAL/);
 await act(async()=>{taskMode="delay";revision++;listeners.forEach(fn=>fn());});const lateRecord=releaseTask;assert.ok(lateRecord);recordId="record-b";taskMode="data";await render();recordId=contact.id;await render();await act(async()=>lateRecord({items:[{...task,title:"OLD-TASK-RECORD"}],authority:"backend",loadedAt:at,pageInfo:{hasNextPage:false}}));assert.doesNotMatch(container.textContent??"",/OLD-TASK-RECORD/);
 await click("Ghi chú nhanh");assert.equal(calls.pop(),"note");await click("Đặt lịch hẹn");assert.equal(calls.pop(),"meeting");
 await click("Lịch sử");assert.equal(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent,"Lịch sử");assert.match(container.textContent ?? "",/Không có hoạt động/);
 visible=false;await render();assert.equal(container.querySelector("aside"),null);visible=true;await render();assert.equal(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent,"Lịch sử");
 await click("Công việc");await act(async()=>{taskMode="empty";revision++;listeners.forEach(fn=>fn());});assert.match(container.textContent ?? "",/Chưa có công việc tiếp theo/);
 await act(async()=>{taskMode="error";revision++;listeners.forEach(fn=>fn());});assert.match(container.textContent ?? "",/Không thể tải công việc/);assert.doesNotMatch(container.textContent ?? "",/SECRET/);
 await act(async()=>{taskMode="data";canRead=false;revision++;listeners.forEach(fn=>fn());});assert.match(container.textContent ?? "",/không có quyền đọc công việc/);assert.doesNotMatch(container.textContent ?? "",/Real overdue task/);
 console.log("Contact panel checkpoint 3A PASS: scoped Tasks, bounded cursor/continuation, loading and principal/record ABA late response retirement, foreign binding rejection, overdue/next, empty/error/denied, Work default, History, mode/toggle retention, note/meeting callbacks, no internal collapse.");
} finally {await act(async()=>root.unmount());configureTaskApplication(original);ac.configureAccessGovernanceRuntime(binding);dom.window.close();}
