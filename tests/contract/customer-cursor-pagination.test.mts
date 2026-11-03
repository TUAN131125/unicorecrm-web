import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useServerPagedCollection, type ServerPagedCollectionState } from "@/shared/operations/useServerPagedCollection";
import type { AuthoritativePage, ModuleListQuery } from "@/shared/application";

const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost" });
Object.defineProperties(globalThis, { window: { value: dom.window, configurable: true }, document: { value: dom.window.document, configurable: true }, IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true } });
let current: ServerPagedCollectionState<number> | undefined;
let totalCount: number | undefined;
const reads: ModuleListQuery[] = [];
const project = () => {};
const loadPage = async (query: ModuleListQuery): Promise<AuthoritativePage<number>> => {
  reads.push(query);
  const page = query.cursor === "second" ? 2 : query.cursor === "third" ? 3 : 1;
  return { items: Array.from({ length: page === 3 ? 20 : 25 }, (_, i) => (page - 1) * 25 + i),
    pageInfo: { hasNextPage: page < 3, ...(page < 3 ? { nextCursor: page === 1 ? "second" : "third" } : {}), ...(totalCount === undefined ? {} : { totalCount }) },
    authority: "backend", loadedAt: new Date().toISOString() };
};
function Harness() {
  current = useServerPagedCollection({ connected: true, scopeKey: "one", project, loadPage, errorCodePrefix: "CONTRACT" });
  return null;
}
const element = dom.window.document.getElementById("root");
assert.ok(element);
const root = createRoot(element);
const state = () => { assert.ok(current); return current; };
const settle = async (action: () => void) => { await act(async () => { action(); }); await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); }); };
try {
  await settle(() => root.render(React.createElement(Harness)));
  assert.equal(state().page, 1);
  await settle(() => state().setPage(2));
  assert.equal(state().page, 2, "An unknown total must not clamp cursor page two to page one.");
  assert.equal(state().items[0], 25);
  await settle(() => state().setPage(3));
  assert.equal(state().page, 3);
  assert.equal(state().items.length, 20);
  assert.equal(state().hasNextPage, false);
  assert.deepEqual(reads.map(read => read.cursor), [undefined, "second", "third"]);
  totalCount = 25;
  await settle(() => { void state().refresh(); });
  assert.equal(state().page, 1, "An authoritative reduced total still clamps a stale page.");
  console.log("PASS cursor pages without totalCount and authoritative count clamp regression");
} finally { await act(async () => root.unmount()); dom.window.close(); }
