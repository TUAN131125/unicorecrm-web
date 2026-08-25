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
  url: "http://localhost/#/w/unicore-vietnam/crm/leads",
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
const leadsModule = await import("../../../src/modules/leads");
const { getTaskActivitySnapshot } = await import("../../../src/modules/tasks");
const { useLeadDetailController } = await import("../../../src/modules/leads/presentation/hooks/useLeadDetailController");

// ---------------------------------------------------------------------------
// 1. Arrange a genuine partial commit out of real behaviour.
//
// Nothing here stubs the partial-commit model or injects a synthetic rejection. The
// follow-up Task is created with `assigneeId: lead.ownerId`, and the Task domain refuses a
// blank assignee ("Task assignee is required."). A lead with no owner therefore produces
// exactly the M9 hazard in the real command path: the call activity commits, and the
// follow-up Task that depends on it fails afterwards.
// ---------------------------------------------------------------------------

// The lead is seeded explicitly rather than taken from the demo fixture: under a JSDOM
// global the Lead repository hydrates from browser storage, so the fixture is not reliably
// present.
const LEAD_ID = "lead_m11_partial_commit_probe";
leadsModule.saveLeadSnapshot({
  id: LEAD_ID,
  name: "M11 partial-commit probe",
  title: "Operations",
  companyName: "M11 Probe Co.",
  email: "probe@m11.local",
  phone: "0900000000",
  source: "Website",
  score: 50,
  leadWorkState: "NEW",
  ownerId: "u1",
  createdAt: new Date().toISOString(),
  activities: [],
});

// The failure lever is a real permission boundary, not an injected rejection: a member may
// log a call on a Lead but not create Tasks. That is an ordinary role configuration, and it
// makes the SECOND authoritative command fail after the FIRST has already committed —
// exactly the M9 hazard, produced by production code paths end to end.
const {
  getAccessControlSnapshot,
  updateRoleCapabilities,
  refreshAccessGovernance,
  can,
} = await import("../../../src/platform/access-control");

const accessSnapshot = getAccessControlSnapshot(activeWorkspaceId);
const taskCreatingRoles = accessSnapshot.roles.filter((role) => role.capabilities.includes("tasks.create"));
assert.ok(taskCreatingRoles.length > 0, "The demo workspace must grant tasks.create to at least one role.");
for (const role of taskCreatingRoles) {
  updateRoleCapabilities(role.roleId, role.capabilities.filter((capability) => capability !== "tasks.create"), activeWorkspaceId);
}
await refreshAccessGovernance(activeWorkspaceId);
assert.equal(can("tasks.create"), false, "The probe role must no longer be allowed to create Tasks.");
assert.equal(can("leads.update"), true, "The probe role must still be allowed to log Lead activity, or nothing commits.");

const preparedLead = leadsModule.getLeadSnapshot(LEAD_ID);
assert.ok(preparedLead, "The probe lead must exist in the Lead projection.");

const activitiesBefore = (preparedLead.activities ?? []).length;
const tasksBefore = getTaskActivitySnapshot().tasks.length;

// ---------------------------------------------------------------------------
// 2. Mount the real controller on the real route.
// ---------------------------------------------------------------------------

let controller = null;
const Harness = () => {
  controller = useLeadDetailController({});
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
          { initialEntries: [`/leads/${LEAD_ID}`] },
          React.createElement(
            PlatformStateProvider,
            null,
            React.createElement(
              Routes,
              null,
              React.createElement(Route, { path: "/leads/:leadId", element: React.createElement(Harness) }),
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

  assert.ok(controller, "The Lead detail controller must mount.");
  assert.ok(controller.lead, `The controller must resolve lead ${LEAD_ID} from the route.`);
  assert.equal(typeof controller.handleSavePhoneCall, "function", "The controller must expose the call handler.");

  // ---------------------------------------------------------------------------
  // 3. Run the two-command action and read what the user is actually told.
  // ---------------------------------------------------------------------------

  await act(async () => {
    await controller.handleSavePhoneCall({
      subject: "M11 partial-commit probe",
      body: "Controller-level MA-07 verification.",
      direction: "outbound",
      result: "connected",
      recipient: "0900000000",
      durationMinutes: 5,
      createFollowUpTask: true,
      nextFollowUpAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
  });
  await settle(3);

  // The partial commit must be real, not merely reported: the activity committed and the
  // Task did not. If this fails the scenario stopped reproducing and the message assertions
  // below would be meaningless.
  const leadAfter = leadsModule.getLeadSnapshot(LEAD_ID);
  assert.equal(
    (leadAfter.activities ?? []).length,
    activitiesBefore + 1,
    "The call activity must actually commit, otherwise this is a total failure and not a partial commit.",
  );
  assert.equal(
    getTaskActivitySnapshot().tasks.length,
    tasksBefore,
    "The follow-up Task must actually fail, otherwise this is a full success and not a partial commit.",
  );

  const toast = controller.toastMessage;
  assert.ok(toast, "An action whose second command failed must tell the user something.");

  // The MA-07 property, asserted at the surface the user reads: the committed half must be
  // named. A caller that computed the report and then rendered only the error text — the
  // exact M9 defect — leaves this sentence out.
  assert.match(
    toast,
    /The call log was saved|Cuộc gọi đã được lưu/u,
    "A PARTIAL_SUCCESS must be surfaced as a partial result that names what committed. Reporting only the failure "
      + `makes the committed call log invisible and invites the user to log it twice. Got: ${toast}`,
  );
  assert.match(
    toast,
    /did not complete|chưa hoàn tất/u,
    `The failed step must also be named, so the user knows what still needs doing. Got: ${toast}`,
  );

  // And the failure text itself must be safe copy, not the raw domain diagnostic (MA-08
  // holding at the same surface).
  assert.doesNotMatch(
    toast,
    /Access denied|missing capability/u,
    "The failure half must be formatted product copy, not the raw authorization diagnostic.",
  );

  console.log(`quality.partial-commit-controller-runtime: PASS (real Lead controller reported: ${toast})`);
} finally {
  await act(async () => root.unmount());
  globalThis.setTimeout = nativeSetTimeout;
  for (const id of scheduledTimers) clearTimeout(id);
  scheduledTimers.clear();
  window.close();
}
