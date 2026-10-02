import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import type { Lead } from "@/modules/leads";
import type { LeadDocument } from "@/platform/api/generated/commercialApi";

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

const { signIn } = await import("@/platform/identity-auth");
assert.equal(signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok, true);
const { initializeApplicationComposition } = await import("@/app/composition");
await initializeApplicationComposition({ mode: "demo" });
const workspace = await import("@/platform/workspace-context");
const { loadAccessGovernance } = await import("@/platform/access-control");
await loadAccessGovernance(workspace.getWorkspaceContextSnapshot().workspaceId);
const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { MemoryRouter, Routes, Route } = await import("react-router-dom");
const { I18nProvider } = await import("@/i18n");
const { PlatformStateProvider } = await import("@/app/providers");
const { GuidanceProvider } = await import("@/guidance/presentation/GuidanceProvider");
const { ApplicationError } = await import("@/shared/domain");
const { createAuthoritativeResource, invalidateModuleQueries } = await import("@/shared/application");
const { configureLeadApplication, getLeadApplicationServices } = await import("@/modules/leads/application/composition/leadApplicationServices");
const { getLeadDetailResource, getLeadCollectionResource } = await import("@/modules/leads/application/vertical-slice/leadAuthoritativeQueries");
const { LeadDetailPage } = await import("@/modules/leads/presentation/pages/LeadDetailPage");
const { handoverLeadWithTasksViaApi } = await import("@/modules/leads/application/commands/leadApiCommands");
const { InMemoryLeadRepository } = await import("@/modules/leads/infrastructure/InMemoryLeadRepository");
const { createWorkspaceScopedRepository } = await import("@/platform/workspace-scope/createWorkspaceScopedRepository");
const { BrowserEventBus } = await import("@/platform/events");
const { mapLeadDocumentToApplication } = await import("@/modules/leads/infrastructure/http/LeadApiMapper");

const lead: Lead = { id: "lead-confidentiality", name: "Protected Profile Sentinel", title: "", companyName: "Protected Company Sentinel", phone: "0901234567", email: "protected@example.test", source: "WEB", score: 0, ownerId: "u1", leadWorkState: "NEW", interestedProducts: [], activities: [], activitiesAuthority: "NOT_INCLUDED", resourceVersion: 3, createdAt: "2026-07-01T00:00:00Z" };
let records: Lead[] = [lead];
const base = getLeadApplicationServices();
let failure: InstanceType<typeof ApplicationError> | undefined;
configureLeadApplication({
  ...base,
  repository: { list: () => [...records], getById: (id) => records.find(record => record.id === id), replace: (next) => { records = next; }, subscribe: () => () => {} },
  api: { ...base.api, mode: "connected", queries: { ...base.api.queries, async get() {
    if (failure) throw failure;
    return lead;
  } } },
});
const resource = getLeadDetailResource(lead.id);
const rootElement = window.document.getElementById("root");
assert.ok(rootElement);
const root = createRoot(rootElement);
const render = async () => act(async () => root.render(React.createElement(I18nProvider, null,
  React.createElement(MemoryRouter, { initialEntries: [`/leads/${lead.id}`] },
    React.createElement(PlatformStateProvider, null, React.createElement(GuidanceProvider, null,
      React.createElement(Routes, null, React.createElement(Route, { path: "/leads/:leadId", element: React.createElement(LeadDetailPage) }))))))));
const text = () => rootElement.textContent ?? "";

try {
  await render();
  assert.equal(resource.getSnapshot().data?.email, lead.email);
  assert.ok(text().includes(lead.name), "Actual page initially renders protected Lead");

  for (const error of [
    new ApplicationError({ code: "SERVER_UNAVAILABLE", message: "temporary", status: 500 }),
    new ApplicationError({ code: "NETWORK_ERROR", message: "temporary", category: "NETWORK" }),
  ]) {
    failure = error;
    await act(async () => { await invalidateModuleQueries({ moduleKeys: ["leads"], commandType: "lead.handover", aggregateId: lead.id, occurredAt: lead.createdAt }); });
    assert.equal(resource.getSnapshot().data?.email, lead.email, "Transient failures retain detail data");
    assert.ok(text().includes(lead.name), "Transient failures retain rendered detail");
  }

  for (const error of [
    new ApplicationError({ code: "ACCESS_DENIED", message: "denied", status: 403 }),
    new ApplicationError({ code: "RESOURCE_NOT_FOUND", message: "missing", status: 404 }),
    new ApplicationError({ code: "ACCESS_DENIED", message: "denied", category: "AUTHORIZATION" }),
    new ApplicationError({ code: "RESOURCE_NOT_FOUND", message: "missing", category: "NOT_FOUND" }),
    new ApplicationError({ code: "HTTP_REQUEST_FAILED", message: "denied", status: 403, category: "UNKNOWN" }),
    new ApplicationError({ code: "HTTP_REQUEST_FAILED", message: "missing", status: 404, category: "UNKNOWN" }),
  ]) {
    failure = undefined;
    await act(async () => { await resource.refresh(); });
    assert.ok(text().includes(lead.name));
    // Commit through the actual command boundary. Its normal invalidation triggers
    // the current-authority GET; the receipt must still succeed after OWN access ends.
    let backendOwner = lead.ownerId;
    let committed = false;
    let deniedReads = 0;
    configureLeadApplication({ ...getLeadApplicationServices(), api: { ...getLeadApplicationServices().api,
      commands: { ...base.api.commands, async handoverLeadWithTasks(id, input, options) {
        assert.equal(id, lead.id);
        assert.equal(options.expectedVersion, lead.resourceVersion);
        assert.ok(options.idempotencyKey);
        backendOwner = input.nextOwnerId;
        committed = true;
        failure = error;
        return {
          evidence: { authority: "backend", commandId: "confidential-handover", correlationId: "confidential-correlation", aggregateId: id, aggregateType: "LEAD", version: 4, occurredAt: lead.createdAt, outcome: "COMMITTED", warnings: [], emittedEventIds: [], auditEvidenceIds: [] },
          reassignedTaskIds: ["transferred-task"], handoverTaskId: "takeover-task", handoverTaskVersion: 1,
          handoverTaskDueAt: "2026-10-04T00:00:00Z", resolvedHandoverAcceptanceSlaHours: 24,
        };
      } },
      queries: { ...base.api.queries, async get() {
        assert.equal(committed, true, "Refresh occurs after backend commit");
        assert.equal(backendOwner, "recipient-owner", "Current OWN reader has lost ownership");
        deniedReads += 1;
        throw failure;
      } },
    } });
    await act(async () => {
      const receipt = await handoverLeadWithTasksViaApi(lead.id, { nextOwnerId: "recipient-owner", reason: "Transfer coverage" }, { idempotencyKey: crypto.randomUUID(), expectedVersion: 3 });
      assert.equal(receipt.evidence.outcome, "COMMITTED", "Successful command remains resolvable despite refresh denial");
      assert.equal(receipt.handoverTaskId, "takeover-task");
      assert.equal("lead" in receipt, false, "Receipt must not include a full Lead");
      for (const secret of [lead.name, lead.companyName, lead.phone, lead.email]) {
        assert.ok(!JSON.stringify(receipt).includes(secret), "Receipt contains no protected profile fields");
      }
    });
    assert.equal(backendOwner, "recipient-owner");
    assert.equal(deniedReads, 1, "Real command invalidation reacquires the detail exactly once");
    assert.equal(resource.getSnapshot().state, "ERROR");
    assert.equal(resource.getSnapshot().data, undefined, "Denial evicts all protected detail fields");
    assert.ok(records.some(record => record.email === lead.email), "Stale repository deliberately remains available to catch fallback");
    for (const secret of [lead.name, lead.companyName, lead.phone, lead.email]) {
      assert.ok(!rootElement.innerHTML.includes(secret), `Actual page must hide ${secret}`);
    }
    assert.equal(rootElement.querySelector('[data-authoritative-query-boundary]'), null, "Page uses blocking error boundary rather than stale detail");
    // Retrying after denial must not resurrect repository data during loading.
    let release: (() => void) | undefined;
    const denied = failure;
    configureLeadApplication({ ...getLeadApplicationServices(), api: { ...getLeadApplicationServices().api, queries: { ...base.api.queries, async get() {
      await new Promise<void>(resolve => { release = resolve; });
      throw denied;
    } } } });
    let retry: Promise<Lead | undefined> | undefined;
    await act(async () => { retry = resource.refresh(); });
    assert.equal(resource.getSnapshot().state, "LOADING");
    assert.equal(resource.getSnapshot().data, undefined);
    for (const secret of [lead.name, lead.companyName, lead.phone, lead.email]) {
      assert.ok(!rootElement.innerHTML.includes(secret), `Loading retry must hide ${secret}`);
    }
    const releaseRetry = release;
    assert.ok(releaseRetry);
    await act(async () => { releaseRetry(); await retry; });
    configureLeadApplication({ ...getLeadApplicationServices(), api: { ...base.api, mode: "connected", queries: { ...base.api.queries, async get() { if (failure) throw failure; return lead; } } } });
  }

  const defaultResource = createAuthoritativeResource<Lead>(async () => { throw new ApplicationError({ code: "ACCESS_DENIED", message: "denied", status: 403 }); });
  defaultResource.replace(lead);
  await defaultResource.refresh();
  assert.equal(defaultResource.getSnapshot().data, lead, "Generic default retention remains unchanged");

  failure = undefined;
  const richer = { ...lead, name: "Newer rich authoritative profile", resourceVersion: 9 };
  records = [richer];
  await act(async () => { await resource.refresh(); });
  assert.equal(records[0]?.resourceVersion, 9, "Detail projection preserves newer cache version");
  assert.equal(resource.getSnapshot().data?.resourceVersion, 3, "Detail output remains the current server read");
  configureLeadApplication({ ...getLeadApplicationServices(), api: { ...getLeadApplicationServices().api, queries: { ...getLeadApplicationServices().api.queries,
    async list() { return { items: [lead], pageInfo: { hasNextPage: false }, loadedAt: lead.createdAt, authority: "backend" }; },
  } } });
  await act(async () => { await getLeadCollectionResource().refresh(); });
  assert.equal(records[0]?.resourceVersion, 9, "Collection projection preserves newer cache version");
  assert.equal(getLeadCollectionResource().getSnapshot().data?.items[0]?.resourceVersion, 3, "Collection output remains the current server read");

  // Local governance still permits these cached fields. Server field revocation
  // at the same aggregate version must control the resource and rendered page.
  const richEqualVersion = { ...lead, resourceVersion: 8 };
  const stored = new InMemoryLeadRepository([richEqualVersion], new BrowserEventBus());
  const scoped = createWorkspaceScopedRepository({ resourceKey: "leads", createRepository: () => stored });
  const redactedDocument: LeadDocument = { id: lead.id, displayName: lead.name, ownerId: lead.ownerId ?? null, version: 8, createdAt: lead.createdAt, updatedAt: lead.createdAt, leadWorkState: "NEW", score: 0, interestedProducts: [], activityProjection: "NOT_INCLUDED" };
  assert.equal("email" in redactedDocument, false);
  assert.equal("phone" in redactedDocument, false);
  const redacted = mapLeadDocumentToApplication(redactedDocument);
  let serverRecord: Lead = richEqualVersion;
  configureLeadApplication({ ...getLeadApplicationServices(), repository: scoped, api: { ...getLeadApplicationServices().api, queries: { ...base.api.queries,
    async get() { return serverRecord; },
    async list() { return { items: [serverRecord], pageInfo: { hasNextPage: false }, loadedAt: lead.createdAt, authority: "backend" }; },
  } } });
  assert.equal(scoped.getById(lead.id)?.email, lead.email, "Local governance permits cached email");
  assert.equal(scoped.getById(lead.id)?.phone, lead.phone, "Local governance permits cached phone");
  await act(async () => { await resource.refresh(); });
  assert.ok(rootElement.innerHTML.includes(lead.email), "Actual page initially exposes the permitted rich email");
  serverRecord = redacted;
  await act(async () => { await resource.refresh(); await getLeadCollectionResource().refresh(); });
  assert.equal(stored.getById(lead.id)?.resourceVersion, 8);
  assert.equal(scoped.getById(lead.id)?.email, lead.email, "Equal-version rich cache remains available to detect resurrection");
  assert.deepEqual(resource.getSnapshot().data, redacted, "Detail uses server redaction rather than richer cache");
  assert.deepEqual(getLeadCollectionResource().getSnapshot().data?.items, [redacted], "Collection uses server redaction rather than richer cache");
  assert.ok(!rootElement.innerHTML.includes(lead.email), "Actual page does not resurrect revoked email");
  assert.ok(!rootElement.innerHTML.includes(lead.phone), "Actual page does not resurrect revoked phone");
  assert.equal(rootElement.querySelector('a[href^="tel:"]'), null);
  assert.equal(rootElement.querySelector('a[href^="mailto:"]'), null);

  const attempts: Array<{ id: string; input: { nextOwnerId: string; reason: string }; idempotencyKey: string; expectedVersion: number }> = [];
  let receiptLost = true;
  let receiptPermissionDenied = false;
  let queryDenied = false;
  let committedOwner = lead.ownerId;
  serverRecord = richEqualVersion;
  configureLeadApplication({ ...getLeadApplicationServices(), api: { ...getLeadApplicationServices().api,
    queries: { ...base.api.queries, async get() {
      if (queryDenied) throw new ApplicationError({ code: "RESOURCE_NOT_FOUND", message: "current OWN read denied", status: 404 });
      return serverRecord;
    } },
    commands: { ...base.api.commands, async handoverLeadWithTasks(id, input, options) {
      attempts.push({ id, input: { ...input }, idempotencyKey: options.idempotencyKey, expectedVersion: options.expectedVersion });
      committedOwner = input.nextOwnerId;
      if (receiptPermissionDenied) throw new ApplicationError({ code: "ACCESS_DENIED", message: "private receipt diagnostics", status: 403 });
      if (receiptLost) {
        queryDenied = true;
        throw new ApplicationError({ code: "NETWORK_ERROR", message: "receipt lost after commit", category: "NETWORK" });
      }
      return { evidence: { authority: "backend", commandId: "retained-command", correlationId: "retained-correlation", aggregateId: id, aggregateType: "LEAD", version: 9, occurredAt: lead.createdAt, outcome: "REPLAYED", warnings: [], emittedEventIds: [], auditEvidenceIds: [] }, reassignedTaskIds: [], handoverTaskId: "retained-takeover", handoverTaskVersion: 1, handoverTaskDueAt: "2026-10-04T00:00:00Z", resolvedHandoverAcceptanceSlaHours: 24 };
    } },
  } });
  await act(async () => { await resource.refresh(); });
  const more = rootElement.querySelector<HTMLButtonElement>("#header-more-actions-btn");
  assert.ok(more);
  await act(async () => more.click());
  const handoverAction = [...window.document.querySelectorAll<HTMLButtonElement>("button")].find(button => /^(Bàn giao|Handover)/.test(button.textContent?.trim() ?? ""));
  assert.ok(handoverAction, "Actual page exposes Handover action");
  await act(async () => handoverAction.click());
  const ownerSelect = window.document.querySelector<HTMLSelectElement>("#lead-handover-form select");
  assert.ok(ownerSelect);
  const recipient = [...ownerSelect.options].find(option => option.value && option.value !== lead.ownerId);
  assert.ok(recipient);
  await act(async () => { ownerSelect.value = recipient.value; ownerSelect.dispatchEvent(new window.Event("change", { bubbles: true })); });
  const reasonInput = window.document.querySelector<HTMLTextAreaElement>("#lead-handover-form textarea");
  assert.ok(reasonInput);
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set?.call(reasonInput, "Retain original transfer");
    reasonInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  const submitHandover = async () => {
    const button = window.document.querySelector<HTMLButtonElement>('button[form="lead-handover-form"]');
    assert.ok(button);
    assert.equal(button.disabled, false);
    await act(async () => button.click());
  };
  await submitHandover();
  assert.equal(attempts.length, 1);
  assert.equal(committedOwner, recipient.value, "Backend committed before the network reply was lost");
  assert.equal(window.document.querySelector<HTMLTextAreaElement>("#lead-handover-form textarea")?.disabled, true, "Actual controller retains ambiguous intent");
  await act(async () => { await resource.refresh(); });
  assert.equal(resource.getSnapshot().data, undefined);
  assert.ok(!rootElement.innerHTML.includes(lead.email));
  assert.equal(window.document.getElementById("lead-handover-form"), null, "Protected dialog disappears during denial");
  receiptLost = false;
  receiptPermissionDenied = true;
  const retryReceipt = async () => {
    const button = rootElement.querySelector<HTMLButtonElement>("[data-lead-handover-receipt-retry] button");
    assert.ok(button, "Receipt-only retry stays accessible without Lead read access");
    assert.equal(button.disabled, false);
    await act(async () => button.click());
    for (const secret of [lead.name, lead.companyName, lead.phone, lead.email, "Retain original transfer", "private receipt diagnostics"]) {
      assert.ok(!rootElement.innerHTML.includes(secret), `Receipt-only panel must not expose ${secret}`);
    }
    assert.equal(resource.getSnapshot().data, undefined);
    assert.equal(window.document.getElementById("lead-handover-form"), null);
  };
  await retryReceipt();
  assert.equal(attempts.length, 2);
  assert.deepEqual(attempts[1], attempts[0], "Denied receipt retry keeps the original key, version and payload");
  receiptPermissionDenied = false;
  await retryReceipt();
  assert.equal(attempts.length, 3);
  assert.deepEqual(attempts[2], attempts[0], "Restored command disclosure replays original intent while Lead GET still returns 404");
  assert.equal(queryDenied, true);
  assert.equal(resource.getSnapshot().error?.status, 404);
  assert.equal(rootElement.querySelector("[data-lead-handover-receipt-retry]"), null, "Successful receipt resolves the retained attempt");
  console.log("Lead detail resource and actual page confidentiality regression PASS");
} finally {
  await act(async () => root.unmount());
  // Let the existing controller toast timers finish before the gate checks open handles.
  await new Promise((resolve) => setTimeout(resolve, 3100));
  resource.reset();
  getLeadCollectionResource().reset();
  configureLeadApplication(base);
  dom.window.close();
}
