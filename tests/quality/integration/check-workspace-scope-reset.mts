// @ts-nocheck -- Runtime contract for connected workspace/scope cache reset.
//
// Invariant: switching workspace in connected mode evicts each module's cached read
// model and refetches. That eviction is a projection operation, not an authoritative
// business mutation, so it must not be rejected by the connected projection guard.
//
// Before the central fix, `useModuleAuthoritativeResource` / `useLeadAuthoritativeResource`
// invoked `onScopeChange` outside any projection scope, so every `replaceX([])` reset
// threw ConnectedProjectionWriteError (CONNECTED_LOCAL_WRITE_FORBIDDEN) from inside a
// layout effect and the resource was never reset.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: "http://localhost/#/w/unicore-vietnam/crm/contacts",
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
  MouseEvent: { value: window.MouseEvent, configurable: true },
  MutationObserver: { value: window.MutationObserver, configurable: true },
  ResizeObserver: { value: ResizeObserverStub, configurable: true },
  getComputedStyle: { value: window.getComputedStyle.bind(window), configurable: true },
  requestAnimationFrame: { value: window.requestAnimationFrame.bind(window), configurable: true },
  cancelAnimationFrame: { value: window.cancelAnimationFrame.bind(window), configurable: true },
  IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true },
});

const { signIn } = await import("../../../src/platform/identity-auth/index");
assert.equal(
  signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok,
  true,
  "Scope-reset contract needs an authenticated session so capability checks are exercised.",
);

// A connected composition binds the guarded projections and the module data authority
// registry, which is what makes `useModuleAuthoritativeResource` treat itself as connected.
const connectedClient = {
  async request() {
    throw new Error("SCOPE_RESET_CONTRACT_MUST_NOT_PERFORM_IO");
  },
};
const { initializeApplicationComposition } = await import("../../../src/app/composition");
await initializeApplicationComposition({ mode: "connected", http: { client: connectedClient } });

const { createAuthoritativeResource, runBackendProjection } = await import("../../../src/shared/application/index");
const { isModuleDataAuthorityRegistryConfigured } = await import("../../../src/shared/application/index");
assert.equal(isModuleDataAuthorityRegistryConfigured(), true, "Connected composition must configure the module data authority.");

const { getContactsSnapshot, replaceContacts } = await import("../../../src/modules/contacts/public/contacts");
const { getRetainedLeadsSnapshot, replaceLeads } = await import("../../../src/modules/leads/public/leads");

const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { useModuleAuthoritativeResource } = await import("../../../src/shared/operations/useModuleAuthoritativeResource");
const { useLeadAuthoritativeResource } = await import("../../../src/modules/leads/presentation/hooks/useLeadAuthoritativeResource");

const capturedErrors: string[] = [];
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => capturedErrors.push(args.map(String).join(" "));

/** Standing in for any module collection resource; the scope effect is resource-agnostic. */
function createProbeResource() {
  return createAuthoritativeResource(async () => ["loaded"]);
}

const contactResource = createProbeResource();
const leadResource = createProbeResource();

function ScopeProbe({ scopeKey }: { scopeKey: string }) {
  useModuleAuthoritativeResource(contactResource, {
    enabled: false,
    scopeKey,
    onScopeChange: () => replaceContacts([]),
  });
  useLeadAuthoritativeResource(leadResource, {
    enabled: false,
    scopeKey,
    onScopeChange: () => replaceLeads([]),
  });
  return React.createElement("div", { "data-scope": scopeKey });
}

// Seed both connected projections through the legitimate backend-projection scope so the
// reset has something real to evict.
runBackendProjection("contacts", () => replaceContacts([
  {
    id: "contact_scope_reset_probe",
    workspaceId: "workspace-a",
    name: "Scope Reset Probe",
    fullName: "Scope Reset Probe",
    status: "active",
    ownerId: "owner-1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  },
]));
assert.equal(getContactsSnapshot().length, 1, "Seeding must populate the connected contacts projection.");

const rootNode = window.document.getElementById("root");
const root = createRoot(rootNode);

try {
  await act(async () => {
    root.render(React.createElement(ScopeProbe, { scopeKey: "workspace-a" }));
  });
  assert.equal(getContactsSnapshot().length, 1, "Mounting must not evict the current workspace cache.");

  // The workspace switch. This is the exact transition that used to throw
  // ConnectedProjectionWriteError out of the layout effect.
  await act(async () => {
    root.render(React.createElement(ScopeProbe, { scopeKey: "workspace-b" }));
  });

  assert.deepEqual(
    getContactsSnapshot(),
    [],
    "A connected workspace switch must evict the previous workspace's cached Contacts.",
  );
  assert.deepEqual(
    getRetainedLeadsSnapshot(),
    [],
    "A connected workspace switch must evict the previous workspace's cached Leads.",
  );
  assert.equal(
    contactResource.getSnapshot().state,
    "IDLE",
    "The module resource must be reset so the new workspace refetches.",
  );
  assert.equal(
    leadResource.getSnapshot().state,
    "IDLE",
    "The Lead resource must be reset so the new workspace refetches.",
  );

  const forbiddenWrite = capturedErrors.find((message) => message.includes("CONNECTED_LOCAL_WRITE_FORBIDDEN")
    || message.includes("ConnectedProjectionWriteError")
    || message.includes("projection rejected"));
  assert.equal(
    forbiddenWrite,
    undefined,
    `Workspace scope reset must not be rejected as an unauthorized local business write: ${forbiddenWrite}`,
  );
} finally {
  await act(async () => root.unmount());
  console.error = originalConsoleError;
}

// The reset scope must be narrow: once the switch is over, an ordinary local business
// write is still refused. Otherwise the fix would have disabled the guard entirely.
assert.throws(
  () => replaceContacts([]),
  /CONNECTED_LOCAL_WRITE_FORBIDDEN|projection rejected/u,
  "Outside a workspace scope reset, a local projection write must still be refused.",
);

console.log("Workspace scope reset contracts: PASS");
