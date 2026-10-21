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
let canRelated = true, hiddenProfile = false;
let actor = initialAccount, revision = 1, canRead = true, scope = "WORKSPACE", restrictive = false;
ac.configureAccessGovernanceRuntime({ ...binding,
  getState: () => ({ ...binding.getState(), workspaceId: binding.getState().workspaceId ?? initialWorkspaceId, authorityRevision: revision }),
  getEffectiveAccess: () => ({ ...baselineAccess, accountId: actor, can: capability => capability === ac.CAPABILITIES.TASKS_READ ? canRead : (capability === ac.CAPABILITIES.CUSTOMERS_VIEW || capability === ac.CAPABILITIES.ORGANIZATIONS_READ) ? canRelated : true,
    getDataScope: () => scope === "OWN" ? "OWN" : "WORKSPACE", getFieldAccess: (resource, field) => hiddenProfile && resource === "contacts" && field === "department" ? "HIDDEN" : "READ_WRITE" }),
  subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
});
const { ApplicationError } = await import("@/shared/domain");
const { configureTaskApplication, getTaskApplicationServices } = await import("@/modules/tasks/application/composition/taskApplicationServices");
const original = getTaskApplicationServices();
const { I18nProvider } = await import("@/i18n");
const { ContactOverviewTab } = await import("@/modules/contacts/presentation/detail/tabs/ContactOverviewTab");
const { MemoryRouter, useLocation } = await import("react-router-dom");
const contactServices = await import("@/modules/contacts/application/composition/contactApplicationServices");
const originalContact = contactServices.getContactApplicationServices();
const at="2026-10-19T10:20:30Z";
const contact: import("@/modules/contacts").Contact={id:"overview-contact",name:"HEADER-ONLY-NAME",fullName:"HEADER-ONLY-NAME",email:"header-only@example.invalid",phone:"000",department:"HIDDEN-DEPARTMENT",title:"Finance manager",createdAt:at,status:"active"};
let mode="empty", hasMore=false;
let release: ((value: import("@/modules/contacts/application/ports/ContactApiRuntime").ContactRelationshipSummary)=>void) | undefined;
const summary=():import("@/modules/contacts/application/ports/ContactApiRuntime").ContactRelationshipSummary=>({contact,organizationIds:[],customerIds:[],linkedRecords:[],linkedRecordCounts:{tasks:999,activities:999,deals:999,quotes:999,orders:999,invoices:999,payments:999,shipping:999,returns:999,supportCases:999},allowedActions:[],projectionVersion:1,generatedAt:at,
 organizationRelationships:mode==="linked" ? [{id:"org-rel",organizationAccountId:"org-exact",organizationLabel:"AUTHORIZED ORG",role:"employee",isPrimaryRepresentative:false,isPrimaryAffiliation:true,effectiveFrom:at,createdAt:at}] : [],
 customerRelationships:mode==="linked" ? [{id:"customer-rel",customerId:"customer-exact",customerLabel:"AUTHORIZED CUSTOMER",role:"primary_contact",effectiveFrom:at,createdAt:at}] : []});
contactServices.configureContactApplication({...originalContact,api:{...originalContact.api,mode:"connected",queries:{...originalContact.api.queries,async getRelationshipSummary(){if(mode==="delay")return new Promise(resolve=>{release=resolve;});if(mode==="error")throw new ApplicationError({code:"NETWORK_ERROR",category:"NETWORK",message:"SECRET-DIAGNOSTIC"});return summary();}}}});
configureTaskApplication({...original,api:{...original.api,mode:"connected",queries:{...original.api.queries,async list(){return {items:[],authority:"backend",loadedAt:at,pageInfo:{hasNextPage:hasMore,...(hasMore?{nextCursor:"more"}:{})}};}}}});
let currentPath = "";
function LocationProbe() { currentPath = useLocation().pathname; return null; }
const calls:string[]=[];const container=document.getElementById("root");assert.ok(container);const root=createRoot(container);
const render=async()=>act(async()=>root.render(React.createElement(MemoryRouter,null,React.createElement(LocationProbe),React.createElement(I18nProvider,null,React.createElement(ContactOverviewTab,{contact,locale:"vi",onSelectTab:(tab,sub)=>calls.push(`${tab}:${sub}`)})))));
const update=async(fn:()=>void)=>act(async()=>{fn();revision++;listeners.forEach(f=>f());});
try {
 await render();assert.match(container.textContent??"",/Tình trạng quan hệ/);assert.match(container.textContent??"",/Chưa liên kết hồ sơ khách hàng/);assert.doesNotMatch(container.textContent??"",/AI|HEADER-ONLY-NAME|header-only@example|999/);
 assert.match(container.textContent??"",/Công việc đang mở0/);
 const metric=Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(b=>b.textContent?.includes("Công việc đang mở"));assert.ok(metric);await act(async()=>metric.click());assert.equal(calls.pop(),"work:tasks");
 await update(()=>{mode="linked";});assert.match(container.textContent??"",/AUTHORIZED ORG/);assert.match(container.textContent??"",/AUTHORIZED CUSTOMER/);assert.match(container.textContent??"",/Quan hệ chính/);
 const orgButton=Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(b=>b.textContent === "AUTHORIZED ORG");assert.ok(orgButton);await act(async()=>orgButton.click());assert.equal(currentPath,"/organizations/org-exact");
 const customerButton=Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(b=>b.textContent === "AUTHORIZED CUSTOMER");assert.ok(customerButton);await act(async()=>customerButton.click());assert.equal(currentPath,"/customers/customer-exact");
 await update(()=>{canRelated=false;});assert.doesNotMatch(container.textContent??"",/AUTHORIZED ORG|AUTHORIZED CUSTOMER/);assert.match(container.textContent??"",/chưa khả dụng với quyền/);
 await update(()=>{hiddenProfile=true;hasMore=true;});assert.doesNotMatch(container.textContent??"",/HIDDEN-DEPARTMENT/);assert.match(container.textContent??"",/Chưa có tổng số đáng tin cậy/);
 await update(()=>{mode="error";});assert.match(container.textContent??"",/Không thể tải quan hệ/);assert.doesNotMatch(container.textContent??"",/SECRET-DIAGNOSTIC/);
 await update(()=>{mode="delay";});assert.match(container.textContent??"",/Đang tải quan hệ/);const late=release;assert.ok(late);
 await update(()=>{mode="linked";canRelated=true;actor="B";});await update(()=>{actor=initialAccount;});await act(async()=>late({...summary(),customerRelationships:[{...summary().customerRelationships[0],customerLabel:"OLD-SUMMARY-CANARY"}]}));assert.doesNotMatch(container.textContent??"",/OLD-SUMMARY-CANARY/);
 console.log("Contact Overview PASS: factual sections, no fake AI/duplicate identity or stale snapshot metrics, scoped complete Task total, unknown pagination total, KPI navigation, authorized exact relationships, related access denial, HIDDEN profile, loading/error and late ABA summary retirement.");
} finally {await act(async()=>root.unmount());contactServices.configureContactApplication(originalContact);configureTaskApplication(original);ac.configureAccessGovernanceRuntime(binding);dom.window.close();}
