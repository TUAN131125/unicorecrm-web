import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost", pretendToBeVisual: true });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "Element", "Node", "Event", "CustomEvent", "EventTarget", "MutationObserver"] as const)
  Object.defineProperty(globalThis, key, { value: key === "window" ? dom.window : dom.window[key], configurable: true });
Object.defineProperties(globalThis, { IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true }, getComputedStyle: { value: dom.window.getComputedStyle.bind(dom.window), configurable: true } });
Object.defineProperty(dom.window, "matchMedia", { value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) });
const React = await import("react"), { act } = React;
const { createRoot } = await import("react-dom/client");
const auth = await import("@/platform/identity-auth");
assert.ok(auth.signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok);
const { initializeApplicationComposition } = await import("@/app/composition");
await initializeApplicationComposition({ mode: "demo" });
const ac = await import("@/platform/access-control"), ws = await import("@/platform/workspace-context");
await ac.loadAccessGovernance(ws.getWorkspaceContextSnapshot().workspaceId);
const deals = await import("@/modules/deals/public/deals");
const quotes = await import("@/modules/quotes/public/quotes");
const { QuoteStatus } = await import("@/modules/quotes/domain/model/quote.types");
const qservices = await import("@/modules/quotes/application/composition/quoteApplicationServices");
const tservices = await import("@/modules/tasks/application/composition/taskApplicationServices");
const qoriginal = qservices.getQuoteApplicationServices(), toriginal = tservices.getTaskApplicationServices();
const seed = quotes.getQuotesSnapshot()[0]; assert.ok(seed);
const deal = { id: "deal_quote_outcome", name: "Quote outcome", stage: "PROPOSAL", amount: 100, currency: "VND", ownerId: ac.resolveEffectiveAccess().memberId, buyerRef: { type: "CONTACT" as const, id: "contact_fixture" }, expectedCloseDate: "2026-12-01", interestedProducts: [], opportunityScore: 10, createdAt: "2026-10-21", updatedAt: "2026-10-21", lineItems: [], activities: [], resourceVersion: 1 };
const opening = { ...seed, id: "quote_outcome", sourceDealId: deal.id, status: QuoteStatus.SENT, resourceVersion: 2 };
let persisted = structuredClone(opening), calls = 0, commits = 0, activityCalls = 0, fail = false, hold = false, release: (() => void) | undefined;
const { ApplicationError } = await import("@/shared/domain");
qservices.configureQuoteApplication({ ...qoriginal, api: { ...qoriginal.api, mode: "test", commands: { ...qoriginal.api.commands,
  async reject(id, _input, options) {
    calls++; assert.equal(id, opening.id); assert.equal(options.expectedVersion, 2);
    if (hold) await new Promise<void>(resolve => { release = resolve; });
    if (fail) throw new ApplicationError({ code: "VERSION_CONFLICT", category: "CONFLICT", message: "Private rejection diagnostic", retryable: false });
    persisted = { ...persisted, status: QuoteStatus.REJECTED, resourceVersion: 3 }; commits++;
    return { quote: structuredClone(persisted), evidence: { authority: "test", commandId: "quote-command", correlationId: "quote-outcome-test", aggregateId: id, aggregateType: "QUOTE", version: 3, occurredAt: "2026-10-21T00:00:00Z", outcome: "COMMITTED", warnings: [], emittedEventIds: ["quote-rejected-event"], auditEvidenceIds: ["quote-rejected-audit"] } };
  },
} } });
tservices.configureTaskApplication({ ...toriginal, api: { ...toriginal.api, commands: { ...toriginal.api.commands,
  async logActivity() { activityCalls++; throw new ApplicationError({ code: "VALIDATION_FAILED", category: "VALIDATION", message: "SYSTEM forbidden", retryable: false }); },
} } });
const { useDealDetailController } = await import("@/modules/deals/presentation/hooks/useDealDetailController");
const { I18nProvider } = await import("@/i18n"), { MemoryRouter, Routes, Route } = await import("react-router-dom");
let model: ReturnType<typeof useDealDetailController> | undefined;
function Probe() { model = useDealDetailController({ customers: [], contacts: [], setCustomers() {} }); return React.createElement("output", null, model.toast?.type); }
const host = document.getElementById("root"); assert.ok(host); const root = createRoot(host);
async function reset() { persisted = structuredClone(opening); await act(async () => { deals.replaceDeals([deal]); quotes.replaceQuotes([opening]); }); }
try {
  await reset();
  await act(async () => root.render(React.createElement(I18nProvider, null, React.createElement(MemoryRouter, { initialEntries: [`/deals/${deal.id}`] }, React.createElement(Routes, null, React.createElement(Route, { path: "/deals/:dealId", element: React.createElement(Probe) }))))));
  await reset(); assert.ok(model);
  await act(async () => { await model?.handleUpdateQuoteStatus(opening.id, QuoteStatus.REJECTED); });
  assert.equal(commits, 1); assert.equal(persisted.status, QuoteStatus.REJECTED); assert.equal(activityCalls, 0);
  assert.equal(model?.toast?.type, "success", "confirmed Quote transition must report success independently of forbidden SYSTEM activity");
  const beforeRetry = calls;
  await act(async () => { await model?.handleUpdateQuoteStatus(opening.id, QuoteStatus.REJECTED); });
  assert.equal(calls, beforeRetry, "retry of already-confirmed status must not send a conflicting transition");
  await reset(); fail = true; const priorCommits = commits;
  await act(async () => { await model?.handleUpdateQuoteStatus(opening.id, QuoteStatus.REJECTED); });
  assert.equal(commits, priorCommits); assert.equal(persisted.status, QuoteStatus.SENT); assert.equal(model?.toast?.type, "error");
  assert.ok(!model?.toast?.text.includes("Private rejection diagnostic"));
  await reset(); fail = false; hold = true; const beforePending = calls;
  let first: Promise<void> | undefined;
  await act(async () => { first = model?.handleUpdateQuoteStatus(opening.id, QuoteStatus.REJECTED); await model?.handleUpdateQuoteStatus(opening.id, QuoteStatus.REJECTED); });
  assert.equal(calls, beforePending + 1, "in-flight duplicate must send one command");
  await act(async () => { release?.(); await first; });
  assert.equal(model?.toast?.type, "success"); assert.equal(activityCalls, 0);
  console.log("PASS real Deal controller + Quote command port: commit/success, real rejection/error, exact-status retry, pending duplicate, no manual SYSTEM Activity. In-process port evidence; not SQL commit proof.");
} finally { await act(async () => root.unmount()); }
