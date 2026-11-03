import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import type { RelationshipRef } from "@/platform/identity";
import type { AuthoritativePage } from "@/shared/application";
import type { Deal } from "@/modules/deals";

const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost", pretendToBeVisual: true });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "Element", "Node", "Event", "CustomEvent", "EventTarget", "MutationObserver"] as const)
  Object.defineProperty(globalThis, key, { value: key === "window" ? dom.window : dom.window[key], configurable: true });
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
const React = await import("react"), { act } = React;
const { createRoot } = await import("react-dom/client");
const { signIn } = await import("@/platform/identity-auth");
assert.ok(signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok);
const { initializeApplicationComposition } = await import("@/app/composition");
await initializeApplicationComposition({ mode: "demo" });
const { loadAccessGovernance } = await import("@/platform/access-control");
const { getWorkspaceContextSnapshot } = await import("@/platform/workspace-context");
await loadAccessGovernance(getWorkspaceContextSnapshot().workspaceId);
const { getDealApplicationServices, configureDealApplication } = await import("@/modules/deals/application/composition/dealApplicationServices");
const original = getDealApplicationServices();
const fixture = original.repository.list()[0]; assert.ok(fixture);
const snapshot = structuredClone(original.repository.list());
const reads: { buyerType?: string; buyerId?: string; cursor?: string; limit?: number; signal?: AbortSignal }[] = [];
let release: ((page: AuthoritativePage<Deal>) => void) | undefined;
let failure = false;
const page = (subject: RelationshipRef, next = false): AuthoritativePage<Deal> => ({ items: [{ ...fixture, id: `${subject.id}-${next ? 2 : 1}`, buyerRef: subject }, { ...fixture, id: "wrong-buyer", buyerRef: { type: "CONTACT", id: "unrelated" } }],
  pageInfo: { hasNextPage: !next, ...(!next ? { nextCursor: "next" } : {}) }, loadedAt: new Date().toISOString(), authority: "backend" });
configureDealApplication({ ...original, api: { ...original.api, mode: "connected", queries: { ...original.api.queries,
  async list(query = {}, signal) {
    reads.push({ ...query.filters, cursor: query.cursor, limit: query.limit, signal });
    if (query.filters?.buyerId === "first") return new Promise(resolve => { release = resolve; });
    if (failure) throw new Error("Unavailable");
    return page({ type: "ORGANIZATION_ACCOUNT", id: "second" }, query.cursor === "next");
  },
} } });
const { useCustomerRelatedDeals } = await import("@/modules/customers/presentation/hooks/useCustomerRelatedDeals");
let current: ReturnType<typeof useCustomerRelatedDeals> | undefined;
function Probe({ subject }: { subject: RelationshipRef }) { current = useCustomerRelatedDeals(subject); return null; }
const element = document.getElementById("root"); assert.ok(element);
const root = createRoot(element);
const state = () => { assert.ok(current); return current; };
async function settle(action: () => void) { await act(async () => { action(); await new Promise(resolve => setTimeout(resolve, 0)); }); }
try {
  await settle(() => root.render(React.createElement(Probe, { subject: { type: "CONTACT", id: "first" } })));
  assert.equal(state().permitted, true); assert.equal(state().query.loading, true);
  await settle(() => root.render(React.createElement(Probe, { subject: { type: "ORGANIZATION_ACCOUNT", id: "second" } })));
  assert.equal(reads[0]?.signal?.aborted, true, "Retiring a Customer subject must cancel its owner query.");
  await settle(() => release?.(page({ type: "CONTACT", id: "first" })));
  assert.deepEqual(state().items.map(deal => deal.id), ["second-1"], "A late prior subject response cannot replace current Customer deals; unrelated buyers are excluded.");
  await settle(() => state().nextPage());
  assert.deepEqual(state().items.map(deal => deal.id), ["second-2"]);
  assert.deepEqual(reads.map(read => [read.buyerType, read.buyerId, read.cursor, read.limit]), [
    ["CONTACT", "first", undefined, 20], ["ORGANIZATION_ACCOUNT", "second", undefined, 20], ["ORGANIZATION_ACCOUNT", "second", "next", 20],
  ]);
  failure = true;
  await settle(() => { void state().query.refresh(); });
  assert.ok(state().query.error); assert.deepEqual(state().items, [], "An owner query failure must not masquerade as a retained successful page.");
  assert.deepEqual(original.repository.list(), snapshot, "Related reads cannot replace the shared Deal projection.");
  console.log("PASS related Deal owner paging, canonical Customer buyer filters, retired response isolation, failure safety, and no shared projection writes (in-process port evidence).");
} finally { await act(async () => root.unmount()); configureDealApplication(original); dom.window.close(); }
