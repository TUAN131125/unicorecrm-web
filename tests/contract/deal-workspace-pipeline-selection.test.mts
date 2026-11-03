import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import type { HttpClient, HttpRequest } from "@/platform/api";
import type { DealStageWindowQuery } from "@/modules/deals/presentation/hooks/useDealStageWindows";

const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost" });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "SVGElement", "Element", "Node", "Event", "CustomEvent", "EventTarget", "MutationObserver"] as const)
  Object.defineProperty(globalThis, key, { value: key === "window" ? dom.window : dom.window[key], configurable: true });
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { configureModuleDataAuthorityRegistry } = await import("@/shared/application");
const { createHttpModuleDataAuthorityRegistry } = await import("@/platform/api");
const { CONNECTED_MODULE_QUERY_RESPONSE_MAPPERS } = await import("@/app/composition/connectedModuleQueryResponseMappers");
const { useDealStageWindows } = await import("@/modules/deals/presentation/hooks/useDealStageWindows");
const { signIn } = await import("@/platform/identity-auth");
assert.equal(signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok, true);
const reads: HttpRequest[] = [];
const client: HttpClient = { async request<T>(request: HttpRequest): Promise<T> {
  reads.push(request);
  const pipelineId = request.query?.pipelineId;
  const cursor = request.query?.cursor;
  assert.ok(pipelineId === "historical-a" || pipelineId === "historical-b");
  const row = { id: `${pipelineId}-${cursor ? "second" : "first"}`, pipelineId, name: String(pipelineId), buyerRef: { type: "CONTACT", id: "contact" },
    stageCode: "CUSTOM_REVIEW", stageCategory: "OPEN", amount: { amount: "100", currency: "VND" }, opportunityScore: "20",
    ownerId: "member", expectedCloseDate: "2027-01-01", interestedProductIds: [], lineItems: [], resourceVersion: 1,
    createdAt: "2026-10-24T00:00:00Z", updatedAt: "2026-10-24T00:00:00Z" };
  return { items: [row], pageInfo: { hasNextPage: !cursor, totalCount: 2, ...(!cursor ? { nextCursor: `${pipelineId}-cursor` } : {}) } } as T;
} };
configureModuleDataAuthorityRegistry(createHttpModuleDataAuthorityRegistry(client, undefined, CONNECTED_MODULE_QUERY_RESPONSE_MAPPERS));
const snapshots = new Map<string, DealStageWindowQuery>();
const stages = ["CUSTOM_REVIEW"];
function Probe({ id }: { id: string }) {
  const query = useDealStageWindows({ enabled: true, pipelineId: id, pipelineVersion: 2, stages, publishToRepository: false });
  snapshots.set(id, query);
  return null;
}
const element = document.getElementById("root"); assert.ok(element);
const root = createRoot(element);
try {
  // No Deal repository is configured: local-only boards must not invoke any shared projection.
  await React.act(async () => { root.render(React.createElement(React.Fragment, null,
    React.createElement(Probe, { id: "historical-a" }), React.createElement(Probe, { id: "historical-b" }))); });
  assert.equal(reads.length, 2);
  assert.deepEqual(snapshots.get("historical-a")?.items.map(deal => deal.id), ["historical-a-first"]);
  assert.deepEqual(snapshots.get("historical-b")?.items.map(deal => deal.id), ["historical-b-first"]);
  await React.act(async () => { await snapshots.get("historical-a")?.loadMore("CUSTOM_REVIEW"); });
  assert.equal(reads.at(-1)?.query?.cursor, "historical-a-cursor");
  assert.deepEqual(snapshots.get("historical-a")?.items.map(deal => deal.id), ["historical-a-first", "historical-a-second"]);
  assert.deepEqual(snapshots.get("historical-b")?.items.map(deal => deal.id), ["historical-b-first"]);
  // Loading one assigned board never advances another board's cursor.
  assert.equal(snapshots.get("historical-a")?.hasMore("CUSTOM_REVIEW"), false);
  assert.equal(snapshots.get("historical-b")?.hasMore("CUSTOM_REVIEW"), true);
  const page = fs.readFileSync(new URL("../../src/modules/deals/presentation/pages/DealPipelinePage.tsx", import.meta.url), "utf8");
  const controller = fs.readFileSync(new URL("../../src/modules/deals/presentation/hooks/useDealPipelineController.ts", import.meta.url), "utf8");
  const form = fs.readFileSync(new URL("../../src/modules/deals/presentation/components/DealFormModal.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /setPipelineId|<Select label="Pipeline"/);
  assert.match(controller, /useDealStages\(\)/);
  assert.match(controller, /next\.delete\("pipeline"\)/);
  assert.match(controller, /useDeals\(\{ loadAuthoritative: viewMode !== "kanban" \}\)/);
  assert.match(controller, /isDealConnectedMode\(\) \? \{\} : \{ pipelineId: selectedPipelineId \}/);
  assert.match(form, /Workspace pipeline/);
  assert.doesNotMatch(form, /<Select id=\{`deal-\$\{mode\}-pipeline`\}/);
  console.log("PASS Workspace default pipeline authority, no user selector, all-pipeline table, isolated historical boards and independent cursors (test runtime)");
} finally { await React.act(async () => root.unmount()); dom.window.close(); }
