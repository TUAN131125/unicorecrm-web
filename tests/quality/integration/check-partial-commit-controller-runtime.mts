// @ts-nocheck -- Controller-level runtime contract for MA-07 partial-commit reporting.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

/**
 * MA-07 at the React caller (M11, DF-24).
 *
 * `quality.partial-commit-outcomes` proves each multi-command handler *calls* the reporter
 * and *mentions* its status, and `quality.partial-commit-semantics` proves the reporter's
 * own behaviour under failure injection. Neither runs a controller. A caller that computed
 * a perfectly correct `PARTIAL_SUCCESS` report and then dropped it — reported the whole
 * action as a failure, or left the committed items selected for a retry — passes both.
 *
 * This gate closes that gap by running the real controller: real demo composition, the real
 * `executeOrderCancellationCommand`, no stubbed partial-commit model. The partial outcome is
 * produced the way production produces one — a genuine mix of orders where some can cancel
 * and some cannot — and the assertions are made against what the controller actually exposes
 * to the user.
 */

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: "http://localhost/#/w/unicore-vietnam/crm/orders",
  pretendToBeVisual: true,
});
const { window } = dom;

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperties(globalThis, {
  window: { value: window, configurable: true },
  document: { value: window.document, configurable: true },
  navigator: { value: window.navigator, configurable: true },
  localStorage: { value: window.localStorage, configurable: true },
  HTMLElement: { value: window.HTMLElement, configurable: true },
  SVGElement: { value: window.SVGElement, configurable: true },
  Element: { value: window.Element, configurable: true },
  Node: { value: window.Node, configurable: true },
  Event: { value: window.Event, configurable: true },
  // The platform event bus publishes through CustomEvent; without the JSDOM constructor the
  // Node global is used and JSDOM rejects the foreign event object.
  CustomEvent: { value: window.CustomEvent, configurable: true },
  EventTarget: { value: window.EventTarget, configurable: true },
  MouseEvent: { value: window.MouseEvent, configurable: true },
  MutationObserver: { value: window.MutationObserver, configurable: true },
  ResizeObserver: { value: ResizeObserverStub, configurable: true },
  getComputedStyle: { value: window.getComputedStyle.bind(window), configurable: true },
  requestAnimationFrame: { value: window.requestAnimationFrame.bind(window), configurable: true },
  cancelAnimationFrame: { value: window.cancelAnimationFrame.bind(window), configurable: true },
  IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true },
});

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: () => ({
    matches: true,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() { return false; },
  }),
});
Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", { value: () => undefined, configurable: true });

const { signIn } = await import("../../../src/platform/identity-auth/index");
assert.equal(signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok, true, "Demo sign-in must create a session.");

const { initializeApplicationComposition } = await import("../../../src/app/composition");
await initializeApplicationComposition({ mode: "demo" });

// Runtime authorization is enforced whenever a `window` global and a session both exist, and
// the demo governance runtime denies every capability until it has loaded. The application
// loads it while entering a workspace; this gate has to do the same or every command below
// would fail on authorization instead of exercising the behaviour under test.
const { loadAccessGovernance } = await import("../../../src/platform/access-control");
const { getWorkspaceContextSnapshot } = await import("../../../src/platform/workspace-context");
const activeWorkspaceId = getWorkspaceContextSnapshot().workspaceId;
await loadAccessGovernance(activeWorkspaceId);

const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { MemoryRouter, Route, Routes } = await import("react-router-dom");
const { I18nProvider } = await import("../../../src/i18n/index");
const { PlatformStateProvider } = await import("../../../src/app/providers");
const ordersModule = await import("../../../src/modules/orders");
const { getPaymentsSnapshot } = await import("../../../src/modules/payments");
const { useOrderListController } = await import("../../../src/modules/orders/presentation/hooks/useOrderListController");

// One real cancellation succeeds while the completed order is rejected by the workflow.
const CANCELLABLE_ID = "order_partial_cancellable";
const COMPLETED_ID = "order_partial_completed";
const makeOrder = (id, state) => ({
  id, orderNumber: id, orderDate: new Date().toISOString(),
  buyerRef: { type: "CONTACT", id: "contact_partial_probe" },
  state, items: [{
    id: `${id}:line`, productId: "product_partial_probe", productNameSnapshot: "Probe service",
    fulfillmentKind: "SERVICE", quantity: 1, unitPriceSnapshot: 100000, discountPercent: 0,
    lineSubtotal: 100000, lineDiscountAmount: 0, lineTaxAmount: 0, lineTotal: 100000,
  }], totalAmount: 100000, grandTotal: 100000, currency: "VND",
  paymentAgreementSnapshot: {
    version: 1, kind: "FULL_PAYMENT", currency: "VND", policyVersion: "test/v1",
    lines: [{
      id: `${id}:agreement`, sequence: 1, label: "Full payment", purpose: "FULL",
      amountRule: { type: "REMAINDER" }, previewAmount: { amount: "100000", currency: "VND" },
      dueRule: { type: "EVENT_RELATIVE", event: "ORDER_CONFIRMED", offsetDays: 0, dayBasis: "CALENDAR" },
      allowedMethodCodes: ["bank-transfer"], fulfillmentGate: "BEFORE_COMPLETION",
    }],
  },
  ...(state === "COMPLETED" ? {
    completedAt: new Date().toISOString(),
    completion: { policyVersion: "test/v1", correlationId: id, evidenceId: `${id}:evidence`, occurredAt: new Date().toISOString() },
  } : {}),
});
ordersModule.replaceOrderList([
  makeOrder(CANCELLABLE_ID, "DRAFT"),
  makeOrder(COMPLETED_ID, "COMPLETED"),
]);
const { can } = await import("../../../src/platform/access-control");
assert.equal(can("orders.update"), true, "The probe must exercise workflow state rejection, not authorization failure.");

// ---------------------------------------------------------------------------
// 2. Mount the real controller on the real route.
// ---------------------------------------------------------------------------

let controller = null;
const Harness = () => {
  controller = useOrderListController({ payments: getPaymentsSnapshot(), shippingBookings: [] });
  return null;
};

/**
 * The controller clears its toast on a timer, so a pending `setTimeout` outlives the
 * assertions and the gate runner reports it as a retained handle. Track what the test
 * schedules and cancel it during teardown; nothing about the controller changes.
 */
const scheduledTimers = new Set();
const nativeSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((handler, delay, ...rest) => {
  const id = nativeSetTimeout(handler, delay, ...rest);
  scheduledTimers.add(id);
  return id;
}) as typeof globalThis.setTimeout;

const rootNode = window.document.getElementById("root");
const root = createRoot(rootNode);

try {
  await act(async () => {
    root.render(
      React.createElement(
        I18nProvider,
        null,
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/orders"] },
          React.createElement(
            PlatformStateProvider,
            null,
            React.createElement(
              Routes,
              null,
              React.createElement(Route, { path: "/orders", element: React.createElement(Harness) }),
            ),
          ),
        ),
      ),
    );
  });

  const settle = async (attempts = 20) => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
    }
  };

  await settle(3);
  assert.ok(controller, "The Order list controller must mount.");
  assert.equal(typeof controller.executeBulkAction, "function");
  await act(async () => { controller.setSelectedOrderIds([CANCELLABLE_ID, COMPLETED_ID]); });
  let outcome;
  await act(async () => { outcome = await controller.executeBulkAction("cancel"); });
  await settle(3);

  assert.equal(outcome, false, "A partial result must not acknowledge full success.");
  assert.equal(ordersModule.getOrderSnapshot(CANCELLABLE_ID).state, "CANCELLED", "The eligible order must actually commit.");
  assert.equal(ordersModule.getOrderSnapshot(COMPLETED_ID).state, "COMPLETED", "The rejected order must retain its state.");
  assert.deepEqual(controller.selectedOrderIds, [COMPLETED_ID], "Only the failed order may remain selected for retry.");
  const toast = controller.alertMessage?.text;
  assert.ok(toast, "A partial cancellation must tell the user what happened.");
  assert.equal(controller.alertMessage.type, "error", "The failed half must not appear as full success.");
  assert.match(toast, /Cancelled 1 of 2 orders|Đã hủy 1\/2 đơn hàng/u, "The committed half must be named.");
  assert.match(toast, /Not cancelled:|Chưa hủy được:/u, "The failed half must be named.");
  assert.ok(toast.includes(COMPLETED_ID), "The user must be able to identify the failed order.");

  // And the failure text itself must be safe copy, not the raw domain diagnostic (MA-08
  // holding at the same surface).
  assert.doesNotMatch(
    toast,
    /Access denied|missing capability/u,
    "The failure half must be formatted product copy, not the raw authorization diagnostic.",
  );

  console.log(`quality.partial-commit-controller-runtime: PASS (real Order controller reported: ${toast})`);
} finally {
  await act(async () => root.unmount());
  globalThis.setTimeout = nativeSetTimeout;
  for (const id of scheduledTimers) clearTimeout(id);
  scheduledTimers.clear();
  window.close();
}
