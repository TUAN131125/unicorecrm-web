import { LegacyUiTranslationBridge } from "@/i18n/LegacyUiTranslationBridge";
import { ListStatePanel } from "@/components/crm/list-archetype/ListStatePanel";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { ConnectedCollectionProjection } from "@/app/composition/connected/connectedProjectionRepositories";
import { configureQuoteApplication, resetQuoteApplication } from "@/modules/quotes/application/composition/quoteApplicationServices";
import { createQuoteConnectedApiRuntime } from "@/modules/quotes/infrastructure/http/createQuoteConnectedApiRuntime";
import { useQuoteListQuery } from "@/modules/quotes/presentation/hooks/useQuoteListQuery";
import { QuoteStatus, type Quote } from "@/modules/quotes/domain/model/quote.types";
import type { HttpRequest } from "@/platform/api/client";
import { ApiClientError } from "@/platform/api/errors";

export async function verifyQuoteListPaging() {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost" });
  Object.defineProperties(globalThis, { window: { value: dom.window, configurable: true }, document: { value: dom.window.document, configurable: true }, IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true } });
  for (const key of ["Element", "Node", "MutationObserver"] as const) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
  const projection = new ConnectedCollectionProjection<Quote>("quotes", record => record.id);
  let scope = "one";
  let search = "";
  let fail = false;
  let completeSlow: (() => void) | undefined;
  const requests: HttpRequest[] = [];
  const runtime = createQuoteConnectedApiRuntime({ async request<T>(request: HttpRequest): Promise<T> {
    requests.push(request);
    if (fail) throw new ApiClientError({ code: "ACCESS_DENIED", message: "Denied", status: 403 });
    const owner = scope;
    if (request.query?.search === "slow") await new Promise<void>(resolve => { completeSlow = resolve; });
    const amount = { amount: "198000", currency: "VND" };
    const items = request.query?.search === "empty" ? [] : [{ id: `${owner}-${request.query?.cursor || "first"}`, quoteNumber: "Q-0000000001", quoteRevision: 1, rootQuoteId: "root", buyerRef: { type: "CONTACT", id: "buyer" }, sourcePath: "DEAL", sourceDealId: "deal-one", status: "DRAFT", title: "Mapped Quote", currency: "VND", lineItems: [], subtotal: amount, discountTotal: { ...amount, amount: "0" }, taxTotal: { ...amount, amount: "0" }, grandTotal: amount, actions: { accept: { allowed: false, blockerCodes: ["QUOTE_ACCEPTANCE_BLOCKED"] } }, resourceVersion: 3, createdAt: "2026-10-24T00:00:00Z", updatedAt: "2026-10-24T00:00:00Z" }];
    return { items, pageInfo: { hasNextPage: !request.query?.cursor && items.length > 0, nextCursor: "next", totalCount: items.length ? 26 : 0 } } as T;
  } });
  configureQuoteApplication({ api: runtime, repository: { list: () => projection.list(), getById: id => projection.getById(id), replace: records => projection.replace(records), subscribe: listener => projection.subscribe(listener) }, preferences: { get: (_key, fallback) => fallback, set: () => undefined, remove: () => undefined } });
  assert.throws(() => projection.replace([]), { code: "CONNECTED_LOCAL_WRITE_FORBIDDEN" }, "The original unscoped write must remain forbidden");
  let current: ReturnType<typeof useQuoteListQuery> | undefined;
  const onReset = () => undefined;
  function Harness() { current = useQuoteListQuery(scope, { search, filters: { status: QuoteStatus.DRAFT, sourceDealId: "deal-one" } }, onReset); return null; }
  const element = dom.window.document.getElementById("root");
  assert.ok(element);
  const root = createRoot(element);
  const state = () => { assert.ok(current); return current; };
  const settle = async (action: () => void) => { await act(async () => { action(); }); await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); }); };
  try {
    await settle(() => root.render(React.createElement(Harness)));
    assert.equal(state().error, undefined);
    assert.equal(state().items[0]?.grandTotal, 198000, "Money DTO must pass through the Quote HTTP mapper");
    assert.equal(projection.list()[0]?.dealId, "deal-one", "Mapped source Deal survives projection");
    assert.equal(requests[0]?.operationId, "listQuotes");
    assert.equal(requests[0]?.query?.status, "DRAFT");
    await settle(() => state().setPage(2));
    assert.equal(state().page, 2);
    assert.equal(state().items[0]?.id, "one-next");
    assert.equal(requests.at(-1)?.query?.cursor, "next");
    search = "empty";
    await settle(() => root.render(React.createElement(Harness)));
    assert.equal(state().items.length, 0);
    assert.equal(state().error, undefined, "A valid empty result is not a load failure");
    fail = true;
    await settle(() => { void state().refresh(); });
    assert.equal(state().error?.code, "ACCESS_DENIED", "Real failures must remain errors");
    fail = false;
    await settle(() => { void state().refresh(); });
    assert.equal(state().error, undefined);
    search = "slow";
    await settle(() => root.render(React.createElement(Harness)));
    scope = "two"; search = "";
    await settle(() => root.render(React.createElement(Harness)));
    assert.equal(state().page, 1);
    assert.equal(state().items[0]?.id, "two-first");
    await settle(() => completeSlow?.());
    assert.equal(projection.list()[0]?.id, "two-first", "Late old-Workspace response must not repopulate current projection");
    assert.throws(() => projection.replace([]), { code: "CONNECTED_LOCAL_WRITE_FORBIDDEN" }, "Read projection scope closes synchronously");
    const statePanel = (kind: "empty" | "error") => React.createElement(React.Fragment, null,
      React.createElement(LegacyUiTranslationBridge, { locale: "vi" }),
      React.createElement(ListStatePanel, { key: `quote-list-${kind}`, kind, title: kind === "empty" ? "Không có báo giá phù hợp" : "Không thể tải danh sách Báo giá", action: React.createElement("button", null, kind === "empty" ? "Tạo báo giá" : "Thử lại") }));
    await settle(() => root.render(statePanel("empty")));
    await settle(() => root.render(statePanel("error")));
    assert.equal(element.querySelector("button")?.textContent, "Thử lại", "Error identity must not retain the empty action label through legacy translation");
    console.log("PASS Quote typed HTTP paging, projection guard, empty/error/retry and Workspace race checks");
  } finally { await act(async () => root.unmount()); resetQuoteApplication(); dom.window.close(); }
}
