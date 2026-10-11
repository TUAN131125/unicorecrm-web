import assert from "node:assert/strict";
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@/i18n";
import { PlatformStateProvider } from "@/app/providers";
import { GuidanceProvider } from "@/guidance/presentation/GuidanceProvider";
import { LeadListPage } from "@/modules/leads/presentation/pages/LeadListPage";
import { getLeadApplicationServices, configureLeadApplication } from "@/modules/leads/application/composition/leadApplicationServices";
import type { Lead } from "@/modules/leads";
import type { ModuleListQuery } from "@/shared/application";
import { getLeadPreference, setLeadPreference, removeLeadPreference } from "@/modules/leads/public/leads";
import { INITIAL_LEAD_FILTERS } from "@/modules/leads/presentation/hooks/useLeadFilters";
import { CONNECTED_LEAD_SORT, resolveConnectedLeadTableQuery } from "@/modules/leads/presentation/model/connectedLeadTableQuery";
import { useLeadConnectedTable } from "@/modules/leads/presentation/hooks/useLeadConnectedTable";
import { useLeadSelection } from "@/modules/leads/presentation/hooks/useLeadSelection";
import type { AuthoritativePage } from "@/shared/application";
import { getWorkspaceContextSnapshot, listWorkspaceMemberships, switchWorkspaceContext } from "@/platform/workspace-context";
import { configureDefaultAccessGovernanceRuntime, getAccessGovernanceRuntime, getAccessGovernanceState, refreshAccessGovernance } from "@/platform/access-control";

export async function checkLeadServerAuthoritativeTable() {
  const services = getLeadApplicationServices();
  const originalWorkspace = getWorkspaceContextSnapshot();
  const accessRuntime = getAccessGovernanceRuntime();
  const priorAuthorization = getAccessGovernanceState().snapshot?.authorization;
  assert.ok(priorAuthorization);
  let authorization = priorAuthorization;
  configureDefaultAccessGovernanceRuntime({ ...accessRuntime, queries:{ ...accessRuntime.queries,
    async getAuthorizationContext() { return authorization; },
  } });
  await React.act(async()=> { await refreshAccessGovernance(originalWorkspace.workspaceId); });
  const records: Lead[] = Array.from({ length: 120 }, (_, index) => ({
    id: `server-id-${120-index}`, name: `Server row ${index}`, title: "", companyName: "",
    phone: "+84 90-123-4567", email: "", source: "WEB", ownerId: "u1", score: index,
    leadWorkState: "NEW", interestedProducts: [], activities: [], resourceVersion: 1,
    createdAt: new Date(Date.UTC(2026, 0, index+1)).toISOString(),
  }));
  const calls: ModuleListQuery[] = [];
  const priorViews = getLeadPreference<unknown>("centrix_custom_misa_views", undefined);
  const snapshot = { version: 1, searchTerm: "", filters: INITIAL_LEAD_FILTERS, sort: CONNECTED_LEAD_SORT,
    orderedColumnIds: ["name","phone"], layout: "table", ownershipScope: "ALLOWED" };
  setLeadPreference("centrix_custom_misa_views", [
    { key: "custom_supported", labelKey: "Supported fixture", isShared: false, presentation: snapshot },
    { key: "custom_source", labelKey: "Source fixture", isShared: false, presentation: { ...snapshot, filters: { ...INITIAL_LEAD_FILTERS, source: "WEB" } } },
    { key: "custom_sort", labelKey: "Created fixture", isShared: false, presentation: { ...snapshot, sort: { field: "createdAt", direction: "desc" } } },
    { key: "custom_team", labelKey: "Team fixture", isShared: false, presentation: { ...snapshot, ownershipScope: "TEAM" } },
  ]);
  let deferred: ((page: AuthoritativePage<Lead>) => void) | undefined;
  let holdSearch: string | undefined;
  let deferredSignal: AbortSignal | undefined;
  let deny = false;
  const response = (items: Lead[], totalCount = items.length, nextCursor?: string): AuthoritativePage<Lead> => ({
    items, authority: "backend", loadedAt: new Date().toISOString(),
    pageInfo: { totalCount, hasNextPage: nextCursor !== undefined, ...(nextCursor ? { nextCursor } : {}) },
  });
  configureLeadApplication({ ...services, api: { ...services.api, mode: "connected", queries: {
    ...services.api.queries,
    async list(query = {}, signal) {
      calls.push(query);
      if (deny) throw { code: "FORBIDDEN", category: "authorization", httpStatus: 403 };
      if (query.search === holdSearch && holdSearch !== undefined) {
        deferredSignal = signal;
        return new Promise<AuthoritativePage<Lead>>(resolve => { deferred = resolve; });
      }
      const start = Number(query.cursor ?? 0);
      const matches = query.search ? [{ ...records[0], phone: "" }] : records;
      const items = matches.slice(start, start+(query.limit ?? 50));
      const hasNextPage = start+items.length < matches.length;
      return { items, authority: "backend", loadedAt: new Date().toISOString(), pageInfo: {
        totalCount: matches.length, hasNextPage, ...(hasNextPage ? { nextCursor: String(start+items.length) } : {}),
      } };
    },
  } } });
  const element = document.createElement("div"); document.body.append(element);
  const root = createRoot(element);
  try {
    await React.act(async () => root.render(React.createElement(I18nProvider, null,
      React.createElement(MemoryRouter, { initialEntries: ["/leads"] },
        React.createElement(PlatformStateProvider, null, React.createElement(GuidanceProvider, null,
          React.createElement(Routes, null, React.createElement(Route, { path: "/leads", element: React.createElement(LeadListPage) }))))))));
    const rows = () => Array.from(element.querySelectorAll("tbody tr"));
    const names = () => rows().map(row => records.find(record => [...row.querySelectorAll("*")]
      .some(node => node.textContent?.trim() === record.name))?.id);
    const click = async (button: Element | null | undefined) => {
      assert.ok(button instanceof window.HTMLElement);
      await React.act(async () => button.click());
    };
    const view = async (label: string) => {
      await click(element.querySelector("#misa-view-dropdown-trigger"));
      const option = [...document.querySelectorAll("button")].find(node => node.id !== "misa-view-dropdown-trigger" && node.textContent?.includes(label));
      await click(option);
    };
    const changeSearch = async (value: string) => {
      const search = element.querySelector<HTMLInputElement>('input[type="text"]'); assert.ok(search);
      await React.act(async () => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value")?.set?.call(search, value);
        search.dispatchEvent(new window.Event("input", { bubbles: true }));
      });
    };
    assert.equal(rows().length, 50);
    assert.ok(rows()[0]?.textContent?.includes(records[0].name), "Server ordering must survive contrary createdAt ordering");
    const allNames: Array<string | undefined> = [...names()];
    assert.ok(element.querySelector("nav[aria-label]")?.textContent?.includes("1–50"));
    for (const [cursor, count, range] of [["50",50,"51–100"],["100",20,"101–120"]] as const) {
      await click(element.querySelector('button[aria-label="Trang sau"],button[aria-label="Next page"]'));
      assert.equal(calls.at(-1)?.cursor, cursor);
      assert.equal(rows().length, count);
      assert.ok(element.querySelector("nav[aria-label]")?.textContent?.includes(range));
      assert.ok(element.querySelector("nav[aria-label]")?.textContent?.includes("120"));
      allNames.push(...names());
    }
    assert.deepEqual(allNames, records.map(record => record.id), "120 rows retain server membership/order with no duplicates");
    await changeSearch(records[0].id);
    assert.equal(calls.at(-1)?.search, records[0].id);
    assert.equal(calls.at(-1)?.cursor, undefined, "Search resets the cursor to page one");
    assert.equal(rows().length, 1, "Backend ID match with FLS-withheld phone cannot be removed by a local predicate");
    assert.ok(rows()[0]?.textContent?.includes(records[0].name));
    assert.ok(!element.textContent?.includes(records[0].phone), "No hidden phone projection is used");
    await changeSearch("84901234567");
    assert.ok(rows()[0]?.textContent?.includes(records[0].name), "Digit-normalized backend phone match is retained");
    await view("Supported fixture");
    assert.equal(rows().length, 50);
    for (const label of ["Source fixture","Created fixture","Team fixture"]) {
      const before = calls.length;
      await view(label);
      assert.ok(element.querySelector("[data-lead-table-unavailable]"));
      assert.equal(element.querySelector("tbody"), null, "Unavailable is not a zero-result table or cached page");
      assert.equal(calls.length, before, "Unsupported saved intent never creates a partial query");
    }
    const saved = getLeadPreference<unknown>("centrix_custom_misa_views", []);
    assert.equal(JSON.stringify(saved).includes('"createdAt"'), true, "Unsupported stored sort is preserved");
    await click(element.querySelector("[data-lead-table-unavailable] button"));
    assert.equal(rows().length, 50);
    holdSearch = "deferred-A";
    await changeSearch(holdSearch);
    assert.equal(element.querySelector("tbody"), null, "Previous rows disappear during a different query");
    await changeSearch("B");
    assert.equal(deferredSignal?.aborted, true);
    await React.act(async () => deferred?.(response([{ ...records[0], name: "Late A secret" }])));
    assert.ok(!element.textContent?.includes("Late A secret"));
    holdSearch = "deferred-unsupported";
    await changeSearch(holdSearch);
    await view("Source fixture");
    await React.act(async () => deferred?.(response([{ ...records[0], name: "Late unsupported secret" }])));
    assert.ok(element.querySelector("[data-lead-table-unavailable]"));
    assert.ok(!element.textContent?.includes("Late unsupported secret"));
    console.log("Lead actual Table: 120 rows, ID/phone/FLS matches, saved views, unavailable intents and delayed responses PASS");
    await React.act(async () => root.render(null));
    // Pure capability resolution covers every filter, distinct work-state/view intent,
    // invalid combinations and old saved ordering without reimplementing SQL search.
    const defaults = { search: "", filters: INITIAL_LEAD_FILTERS, sort: CONNECTED_LEAD_SORT, activeView: "all", canReadQueue: true, memberId: "u1" };
    for (const key of ["source","campaignId","nextFollowUpAt","qualificationOutcome","recontactAt","converted","overdue","duplicate"] as const) {
      const value = key === "overdue" || key === "duplicate" ? false : "chosen";
      assert.equal(resolveConnectedLeadTableQuery({ ...defaults, filters: { ...INITIAL_LEAD_FILTERS, [key]: value } }).kind,"unavailable",key);
    }
    for (const activeView of ["team_leads","contact_today","converted","default","overdue","nurture","disqualified","duplicates"]) {
      assert.equal(resolveConnectedLeadTableQuery({ ...defaults, activeView }).kind,"unavailable",activeView);
    }
    for (const field of ["createdAt","name","score","nextFollowUpAt"] as const) {
      assert.equal(resolveConnectedLeadTableQuery({ ...defaults, sort: { field, direction: "desc" } }).kind,"unavailable",field);
    }
    assert.equal(resolveConnectedLeadTableQuery({ ...defaults, activeView:"unassigned", filters:{...INITIAL_LEAD_FILTERS,ownerId:"u1"} }).kind,"unavailable");
    assert.equal(resolveConnectedLeadTableQuery({ ...defaults, activeView:"new", filters:{...INITIAL_LEAD_FILTERS,status:"CLOSED"} }).kind,"unavailable");
    assert.equal(resolveConnectedLeadTableQuery({ ...defaults, filters:{...INITIAL_LEAD_FILTERS,status:"NURTURE"} }).kind,"unavailable");
    for (const status of ["NEW","CONTACTING","VERIFYING","CLOSED"]) {
      const result=resolveConnectedLeadTableQuery({...defaults,filters:{...INITIAL_LEAD_FILTERS,status,ownerId:"u1"}});
      assert.equal(result.kind,"supported"); if(result.kind==="supported") assert.deepEqual(result.query.filters,{workState:status,ownerId:"u1"});
    }
    let intent = "allowed";
    let search = "";
    let current: ReturnType<typeof useLeadConnectedTable> | undefined;
    let selection: ReturnType<typeof useLeadSelection> | undefined;
    function Harness() {
      current = useLeadConnectedTable({enabled:true,intent,resolution:resolveConnectedLeadTableQuery({...defaults,search})});
      selection = useLeadSelection(current.scopeKey);
      return React.createElement("output",null,current.items.map(row=>row.name).join("|"));
    }
    const renderHarness = async () => React.act(async () => root.render(React.createElement(Harness)));
    await renderHarness();
    await React.act(async () => selection?.toggleSelection(records[0].id,true));
    assert.equal(selection?.selectedLeadIds.length,1);
    await React.act(async () => current?.setPage(2));
    assert.equal(selection?.selectedLeadIds.length,1,"Legitimate same-query cross-page selection is preserved");
    holdSearch="authority-pending"; search=holdSearch;
    await renderHarness();
    assert.equal(selection?.selectedLeadIds.length,0,"Query changes invalidate selection");
    intent="new-authority"; search=""; await renderHarness();
    await React.act(async()=>deferred?.(response([{...records[0],name:"Old scope secret"}])));
    assert.ok(!element.textContent?.includes("Old scope secret"));
    holdSearch="principal-pending"; search=holdSearch; await renderHarness();
    const beforeRevision = current?.scopeKey;
    authorization = { ...priorAuthorization, accountId:"second-principal",membershipId:"second-membership",memberId:"second-member",
      dataScopes:{...priorAuthorization.dataScopes,leads:"OWN"},fieldSecurity:{...priorAuthorization.fieldSecurity,leads:{phone:"HIDDEN"}} };
    search="";
    await React.act(async()=> { await refreshAccessGovernance(originalWorkspace.workspaceId); });
    await renderHarness();
    assert.notEqual(current?.scopeKey,beforeRevision);
    await React.act(async()=>deferred?.(response([{...records[0],name:"Prior principal secret"}])));
    assert.ok(!element.textContent?.includes("Prior principal secret"));
    await React.act(async()=>selection?.toggleSelection(records[0].id,true));
    await React.act(async()=> { await refreshAccessGovernance(originalWorkspace.workspaceId); });
    assert.equal(selection?.selectedLeadIds.length,0,"Authority revision clears old record selection even within one workspace");
    holdSearch="workspace-pending"; search=holdSearch; await renderHarness();
    const other = listWorkspaceMemberships().find(member=>member.status==="active" && member.workspaceKey!==originalWorkspace.workspaceKey);
    assert.ok(other);
    await React.act(async()=> { await switchWorkspaceContext(other.workspaceKey); });
    search=""; await renderHarness();
    await React.act(async()=>deferred?.(response([{...records[0],name:"Prior workspace secret"}])));
    assert.ok(!element.textContent?.includes("Prior workspace secret"));
    await React.act(async()=> { await switchWorkspaceContext(originalWorkspace.workspaceKey); });
    deny=true;
    await React.act(async()=>current?.refresh());
    assert.equal(current?.items.length,0,"403 cannot retain readable rows");
    assert.ok(current?.error);
    let localRecords = [...records];
    const localRepository: typeof services.repository = {
      list: () => [...localRecords], getById: id => localRecords.find(record => record.id === id),
      replace: next => { localRecords = [...next]; },
      replaceProjection: updater => { localRecords = updater([...localRecords]); },
      subscribe: () => () => {},
    };
    configureLeadApplication({ ...services, repository: localRepository, api: { ...services.api, mode: "demo" } });
    const localRequests = calls.length;
    search = "local search"; intent = "local-query";
    await renderHarness();
    assert.equal(localRecords.length, records.length, "Local/demo query changes must not evict the admitted local collection");
    search = "other local search"; intent = "other-local-query";
    await renderHarness();
    assert.equal(localRecords.length, records.length, "Local collection survives consecutive filter/scope resets");
    assert.equal(calls.length, localRequests, "Local mode never falls back to a connected server request");
    console.log("Lead server-authoritative Table runtime: PASS");
  } finally {
    await React.act(async () => root.unmount()); element.remove(); configureLeadApplication(services);
    configureDefaultAccessGovernanceRuntime(accessRuntime);
    await React.act(async()=> { if(getWorkspaceContextSnapshot().workspaceKey!==originalWorkspace.workspaceKey) await switchWorkspaceContext(originalWorkspace.workspaceKey); await refreshAccessGovernance(originalWorkspace.workspaceId); });
    if (priorViews === undefined) removeLeadPreference("centrix_custom_misa_views"); else setLeadPreference("centrix_custom_misa_views",priorViews);
  }
}
