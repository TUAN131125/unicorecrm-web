import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import type { Task } from "@/modules/tasks";
const dom = new JSDOM('<!doctype html><div id="root"></div>', {url:"http://localhost",pretendToBeVisual:true});
for(const key of ["window","document","navigator","localStorage","HTMLElement","Element","Node","Event","CustomEvent","EventTarget","MutationObserver"] as const) Object.defineProperty(globalThis,key,{value:key === "window" ? dom.window : dom.window[key],configurable:true});
Object.defineProperty(globalThis,"IS_REACT_ACT_ENVIRONMENT",{value:true,configurable:true});
Object.defineProperty(dom.window,"matchMedia",{value:()=>({matches:true,addEventListener(){},removeEventListener(){}})});
const React=await import("react"),{act}=React;
const {createRoot}=await import("react-dom/client");
const auth=await import("@/platform/identity-auth");assert.ok(auth.signIn({email:"admin@unicorecrm.local",password:"admin123"}).ok);
const {initializeApplicationComposition}=await import("@/app/composition");await initializeApplicationComposition({mode:"demo"});
const ac=await import("@/platform/access-control");const ws=await import("@/platform/workspace-context");await ac.loadAccessGovernance(ws.getWorkspaceContextSnapshot().workspaceId);
const binding=ac.getAccessGovernanceRuntimeBinding(),baseline=ac.resolveEffectiveAccess();let readable=true;
ac.configureAccessGovernanceRuntime({...binding,getState:()=>binding.getState(),getRuntime:()=>binding.getRuntime(),subscribe:fn=>binding.subscribe(fn),load:(...args)=>binding.load(...args),refresh:(...args)=>binding.refresh(...args),applyMutation:(...args)=>binding.applyMutation(...args),clear:()=>binding.clear(),getEffectiveAccess:()=>({...baseline,can:c=>c === "tasks.read" ? readable : baseline.can(c),getDataScope:()=>"WORKSPACE",getFieldAccess:()=>"READ_WRITE"})});
const services=await import("@/modules/tasks/application/composition/taskApplicationServices");const original=services.getTaskApplicationServices();
const {ApplicationError}=await import("@/shared/domain");const at="2026-10-20T10:00:00Z";
const task=(id:string):Task=>({id,title:id,status:"OPEN",priority:"NORMAL",assigneeId:baseline.memberId,dueAt:at,createdAt:at,updatedAt:at,recordRef:{moduleKey:"organizations",recordId:"org-A"}});
let mode:"data"|"empty"|"error"|"delay"="data";
let release:((value:import("@/shared/application").AuthoritativePage<Task>)=>void)|undefined;
const requests:unknown[]=[];
services.configureTaskApplication({repository:original.repository,api:{...original.api,mode:"connected",queries:{...original.api.queries,
 async list(query){requests.push(query);if(mode === "error")throw new ApplicationError({code:"NETWORK_ERROR",message:"SECRET_DIAGNOSTIC",category:"NETWORK"});if(mode === "delay")return new Promise(resolve=>{release=resolve;});return {items:mode === "empty"?[]:query?.cursor?[task("T49"),task("T50")]:Array.from({length:50},(_,i)=>task("T"+i)),pageInfo:{hasNextPage:mode === "data"&&!query?.cursor,...(mode === "data"&&!query?.cursor?{nextCursor:"cursor-2"}:{})},authority:"backend",loadedAt:at};},
 async listActivities(){return {items:[{id:"event-A",type:"NOTE",subject:"Authorized event",body:"Event body",actorId:baseline.memberId,occurredAt:at,recordRef:{moduleKey:"organizations",recordId:"org-A"}}],pageInfo:{hasNextPage:false},authority:"backend",loadedAt:at};},
}}});
const {OrganizationRelationshipPanel}=await import("@/modules/organizations/presentation/detail/OrganizationRelationshipPanel");const {I18nProvider}=await import("@/i18n");const {MemoryRouter}=await import("react-router-dom");
const host=document.getElementById("root");if(!host)throw new Error("fixture root");const root=createRoot(host);let generation=0;
async function render(id="org-A"){await act(async()=>root.render(React.createElement(I18nProvider,null,React.createElement(MemoryRouter,null,React.createElement(OrganizationRelationshipPanel,{key:++generation,recordId:id,visible:true})))));}
async function click(text:string){const b=[...document.querySelectorAll("button")].find(b=>b.textContent === text);assert.ok(b,text);await act(async()=>b.click());}
await render();assert.equal(document.querySelectorAll("[data-organization-task-id]").length,50);await click("Tải thêm công việc");assert.equal(document.querySelectorAll("[data-organization-task-id]").length,51);assert.match(JSON.stringify(requests),/recordModuleKey.*organizations/);
await click("Lịch sử");assert.equal(document.querySelectorAll("[data-history-id]").length,1);const event=document.querySelector<HTMLButtonElement>("[data-history-id] button");assert.ok(event);await act(async()=>event.click());assert.match(document.body.textContent??"",/Event body/);
mode="empty";await render();assert.match(document.body.textContent??"",/Không có công việc gắn trực tiếp/);
mode="error";await render();assert.match(document.body.textContent??"",/Không thể tải dữ liệu/);assert.ok(!document.body.textContent?.includes("SECRET_DIAGNOSTIC"));mode="data";await click("Thử lại");assert.equal(document.querySelectorAll("[data-organization-task-id]").length,50);
readable=false;await render();assert.equal(document.querySelectorAll("[data-organization-task-id]").length,0);assert.match(document.body.textContent??"",/không có quyền/);readable=true;
mode="delay";await render();assert.match(document.body.textContent??"",/Đang tải/);mode="empty";await render("org-B");await act(async()=>{release?.({items:[task("OLD-RESPONSE")],pageInfo:{hasNextPage:false},authority:"backend",loadedAt:at});});assert.ok(!document.body.textContent?.includes("OLD-RESPONSE"));await act(async()=>root.unmount());
console.log("PASS Organization: direct scope, 50+1 dedup pagination, Work/History, detail, empty/error/retry, denial, loading and retirement");
